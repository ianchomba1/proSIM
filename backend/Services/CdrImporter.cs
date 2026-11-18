using System.Globalization;
using Npgsql;
using NpgsqlTypes;

namespace ProSim.Api.Services
{
    /// <summary>
    /// Loads CDR data into UsageDaily and CallEvents. Used by the admin upload (POST /api/misuse/import) and by
    ///     dotnet run -- import-cdr "C:\Users\user\Downloads\cdr results" [--replace]
    /// Files (same format as the CDR generator):
    ///   daily  : one row per SIM per day (synthetic_cdr_daily_agg.csv columns)
    ///   events : calls and SMS (synthetic_cdr_sessions.csv columns; Data rows are ignored)
    /// Modes:
    ///   Merge   : new SIM-days are added, SIM-days already stored are updated, and their calls/SMS replaced
    ///   Replace : all usage data and calls/SMS are deleted first
    /// Everything is checked before anything is written; any error rolls the whole import back.
    /// A numeric sim_id (synthetic data) is stored as SimRef "SIM-0087"; any other value (MSISDN, ICCID) as given.
    /// </summary>
    public static class CdrImporter
    {
        public enum ImportMode { Merge, Replace }

        public record ImportResult(long SimDays, long Events, long EventsSkipped, int Sims, DateOnly From, DateOnly To,
                                   long SimDaysAdded, long SimDaysUpdated, List<string> Warnings, double Seconds);

        public class ImportException : Exception
        {
            public List<string> Errors { get; }
            public ImportException(List<string> errors) : base(string.Join("; ", errors)) => Errors = errors;
            public ImportException(string error) : this(new List<string> { error }) { }
        }

        private const int MaxErrors = 15;
        private static readonly string[] KnownTiers = { "professional", "manager", "support" };

        private static readonly (string Db, string Csv, char Type)[] DailyCols =
        {
            ("TotalDownloadMb", "total_download_mb", 'd'), ("TotalUploadMb", "total_upload_mb", 'd'), ("TotalMb", "total_mb", 'd'),
            ("SessionCount", "session_count", 'i'), ("DataSessionCount", "data_session_count", 'i'), ("TotalDurationS", "total_duration_s", 'd'),
            ("MaxSessionMb", "max_session_mb", 'd'), ("HotspotFlagCount", "hotspot_flag_count", 'i'), ("GeoFlagCount", "geo_flag_count", 'i'),
            ("RoamingSessions", "roaming_sessions", 'i'), ("UniqueTowers", "unique_towers", 'i'), ("ApnPublicCount", "apn_public_count", 'i'),
            ("OffpeakSessionCount", "offpeak_session_count", 'i'), ("OffpeakMb", "offpeak_mb", 'd'), ("BilledMb", "billed_mb", 'd'),
            ("VoiceMinutesUsed", "voice_minutes_used", 'd'), ("SmsCount", "sms_count", 'i'),
        };
        public static readonly string[] DailyRequiredColumns =
            new[] { "sim_id", "date", "tier" }.Concat(DailyCols.Select(c => c.Csv)).ToArray();
        public static readonly string[] EventRequiredColumns =
            { "sim_id", "session_timestamp", "session_duration", "event_type", "call_destination" };

        private static readonly string[] TimestampFormats =
            { "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm:ss.FFFFFFF", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ss.FFFFFFF", "yyyy-MM-dd HH:mm", "yyyy-MM-dd" };

        public static string SimRef(string simId)
        {
            var s = simId.Trim();
            return int.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? $"SIM-{n:D4}" : s;
        }

        /// <summary>Command-line entry point (folder with the generator's two CSV files).</summary>
        public static async Task<int> RunFromFolderAsync(string connectionString, string folder, bool replace, ILogger logger)
        {
            var dailyPath = Path.Combine(folder, "synthetic_cdr_daily_agg.csv");
            var eventsPath = Path.Combine(folder, "synthetic_cdr_sessions.csv");
            foreach (var p in new[] { dailyPath, eventsPath })
            {
                if (!File.Exists(p)) { logger.LogError("File not found: {Path}", p); return 1; }
            }
            try
            {
                using var daily = new StreamReader(dailyPath);
                using var events = new StreamReader(eventsPath);
                var r = await ImportAsync(connectionString, daily, events, replace ? ImportMode.Replace : ImportMode.Merge);
                logger.LogInformation("Imported {Days:N0} SIM-days ({Added:N0} new, {Updated:N0} updated) and {Events:N0} calls/SMS for {Sims} SIMs, {From}..{To}, in {Secs:F0}s",
                    r.SimDays, r.SimDaysAdded, r.SimDaysUpdated, r.Events, r.Sims, r.From, r.To, r.Seconds);
                foreach (var w in r.Warnings) logger.LogWarning("{Warning}", w);
                return 0;
            }
            catch (ImportException ex)
            {
                foreach (var e in ex.Errors) logger.LogError("{Error}", e);
                return 1;
            }
        }

        public static async Task<ImportResult> ImportAsync(string connectionString, TextReader daily, TextReader events,
            ImportMode mode, CancellationToken ct = default)
        {
            var started = DateTime.UtcNow;
            var warnings = new List<string>();
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            await ExecAsync(conn, tx, @"
CREATE TEMP TABLE tmp_daily (LIKE ""UsageDaily"") ON COMMIT DROP;
CREATE TEMP TABLE tmp_events (""SimRef"" VARCHAR(50), ""Timestamp"" TIMESTAMP, ""DurationS"" INTEGER,
                              ""EventType"" VARCHAR(10), ""Destination"" VARCHAR(30)) ON COMMIT DROP;", ct);

            var unknownTiers = await CopyDailyAsync(conn, daily, ct);
            await CopyEventsAsync(conn, events, ct);

            var dailyRows = await ScalarAsync(conn, tx, @"SELECT COUNT(*) FROM tmp_daily", ct);
            if (dailyRows == 0) throw new ImportException("The daily usage file has no data rows.");
            var dupes = await ScalarAsync(conn, tx,
                @"SELECT COUNT(*) FROM (SELECT 1 FROM tmp_daily GROUP BY ""SimRef"", ""Date"" HAVING COUNT(*) > 1) d", ct);
            if (dupes > 0) throw new ImportException($"The daily usage file has {dupes:N0} SIM-day(s) that appear more than once.");
            if (unknownTiers.Count > 0)
                warnings.Add($"Unknown tier value(s) {string.Join(", ", unknownTiers.Take(5).Select(t => $"'{t}'"))}: " +
                             "the models were trained on professional, manager and support.");

            if (mode == ImportMode.Replace)
                await ExecAsync(conn, tx, @"TRUNCATE ""UsageDaily"", ""CallEvents"" RESTART IDENTITY", ct);

            var existing = mode == ImportMode.Replace ? 0 : await ScalarAsync(conn, tx,
                @"SELECT COUNT(*) FROM tmp_daily t JOIN ""UsageDaily"" u ON u.""SimRef"" = t.""SimRef"" AND u.""Date"" = t.""Date""", ct);

            var cols = new[] { "Tier" }.Concat(DailyCols.Select(c => c.Db)).ToArray();
            await ExecAsync(conn, tx, $@"
INSERT INTO ""UsageDaily"" SELECT * FROM tmp_daily
ON CONFLICT (""SimRef"", ""Date"") DO UPDATE SET {string.Join(", ", cols.Select(c => $"\"{c}\" = EXCLUDED.\"{c}\""))};

-- calls/SMS of the imported SIM-days are replaced by the file's
DELETE FROM ""CallEvents"" ce USING tmp_daily d
WHERE ce.""SimRef"" = d.""SimRef"" AND ce.""Timestamp"" >= d.""Date"" AND ce.""Timestamp"" < d.""Date"" + 1;", ct);

            var inserted = await ScalarAsync(conn, tx, @"
WITH ins AS (
    INSERT INTO ""CallEvents"" (""SimRef"", ""Timestamp"", ""DurationS"", ""EventType"", ""Destination"")
    SELECT e.""SimRef"", e.""Timestamp"", e.""DurationS"", e.""EventType"", e.""Destination""
    FROM tmp_events e JOIN tmp_daily d
      ON e.""SimRef"" = d.""SimRef"" AND e.""Timestamp"" >= d.""Date"" AND e.""Timestamp"" < d.""Date"" + 1
    RETURNING 1)
SELECT COUNT(*) FROM ins", ct);
            var totalEvents = await ScalarAsync(conn, tx, @"SELECT COUNT(*) FROM tmp_events", ct);
            var skipped = totalEvents - inserted;
            if (skipped > 0)
                warnings.Add($"{skipped:N0} call/SMS record(s) were skipped: their SIM and day are not in the daily usage file.");

            var sims = (int)await ScalarAsync(conn, tx, @"SELECT COUNT(DISTINCT ""SimRef"") FROM tmp_daily", ct);
            DateOnly from, to;
            await using (var cmd = new NpgsqlCommand(@"SELECT MIN(""Date""), MAX(""Date"") FROM tmp_daily", conn, tx))
            await using (var rd = await cmd.ExecuteReaderAsync(ct))
            {
                await rd.ReadAsync(ct);
                from = rd.GetFieldValue<DateOnly>(0);
                to = rd.GetFieldValue<DateOnly>(1);
            }
            if (totalEvents == 0)
                warnings.Add("The calls/SMS file has no Voice or SMS rows: call and SMS misuse cannot be detected for these days.");

            await tx.CommitAsync(ct);
            return new ImportResult(dailyRows, inserted, skipped, sims, from, to, dailyRows - existing, existing, warnings,
                Math.Round((DateTime.UtcNow - started).TotalSeconds, 1));
        }

        // ---- CSV readers: every row is checked; errors are collected (with line numbers) and the import stops ----

        private static string[] ReadHeader(TextReader reader, string[] required, string fileLabel)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) throw new ImportException($"The {fileLabel} file is empty.");
            var header = line.TrimStart('\uFEFF').Split(',').Select(h => h.Trim().ToLowerInvariant()).ToArray();
            var missing = required.Where(r => !header.Contains(r)).ToList();
            if (missing.Count > 0)
                throw new ImportException($"The {fileLabel} file is missing column(s): {string.Join(", ", missing)}.");
            return header;
        }

        private static async Task<HashSet<string>> CopyDailyAsync(NpgsqlConnection conn, TextReader reader, CancellationToken ct)
        {
            var header = ReadHeader(reader, DailyRequiredColumns, "daily usage");
            int Col(string n) => Array.IndexOf(header, n);
            int simCol = Col("sim_id"), dateCol = Col("date"), tierCol = Col("tier");
            var cols = DailyCols.Select(c => (c.Db, Idx: Col(c.Csv), c.Type)).ToArray();
            var errors = new List<string>();
            var unknownTiers = new HashSet<string>();

            var copy = "COPY tmp_daily (\"SimRef\", \"Date\", \"Tier\", " +
                       string.Join(", ", cols.Select(c => $"\"{c.Db}\"")) + ") FROM STDIN (FORMAT BINARY)";
            await using (var writer = await conn.BeginBinaryImportAsync(copy, ct))
            {
                string? line;
                var lineNo = 1;
                while ((line = await reader.ReadLineAsync(ct)) != null)
                {
                    lineNo++;
                    if (line.Length == 0) continue;
                    var f = line.Split(',');
                    if (f.Length < header.Length) { Err(errors, lineNo, $"has {f.Length} values, expected {header.Length}"); continue; }
                    if (string.IsNullOrWhiteSpace(f[simCol])) { Err(errors, lineNo, "sim_id is empty"); continue; }
                    if (!DateOnly.TryParseExact(f[dateCol].Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                    { Err(errors, lineNo, $"date '{f[dateCol]}' is not YYYY-MM-DD"); continue; }
                    var values = new double[cols.Length];
                    var ok = true;
                    for (var i = 0; i < cols.Length; i++)
                    {
                        if (!double.TryParse(f[cols[i].Idx], NumberStyles.Float, CultureInfo.InvariantCulture, out values[i]) || values[i] < 0)
                        { Err(errors, lineNo, $"{header[cols[i].Idx]} '{f[cols[i].Idx]}' is not a number >= 0"); ok = false; break; }
                    }
                    if (!ok) continue;
                    if (errors.Count > 0) continue;   // keep checking the rest of the file, but stop writing

                    var tier = f[tierCol].Trim().ToLowerInvariant();
                    if (!KnownTiers.Contains(tier)) unknownTiers.Add(tier);
                    await writer.StartRowAsync(ct);
                    await writer.WriteAsync(SimRef(f[simCol]), NpgsqlDbType.Varchar, ct);
                    await writer.WriteAsync(date, NpgsqlDbType.Date, ct);
                    await writer.WriteAsync(tier, NpgsqlDbType.Varchar, ct);
                    for (var i = 0; i < cols.Length; i++)
                    {
                        if (cols[i].Type == 'i') await writer.WriteAsync((int)Math.Round(values[i]), NpgsqlDbType.Integer, ct);
                        else await writer.WriteAsync(values[i], NpgsqlDbType.Double, ct);
                    }
                    if (errors.Count >= MaxErrors) break;
                }
                if (errors.Count > 0) throw new ImportException(errors.Select(e => "Daily usage file, " + e).ToList());
                await writer.CompleteAsync(ct);
            }
            return unknownTiers;
        }

        private static async Task CopyEventsAsync(NpgsqlConnection conn, TextReader reader, CancellationToken ct)
        {
            var header = ReadHeader(reader, EventRequiredColumns, "calls/SMS");
            int Col(string n) => Array.IndexOf(header, n);
            int simCol = Col("sim_id"), tsCol = Col("session_timestamp"), durCol = Col("session_duration"),
                typeCol = Col("event_type"), destCol = Col("call_destination");
            var errors = new List<string>();

            await using var writer = await conn.BeginBinaryImportAsync(
                "COPY tmp_events (\"SimRef\", \"Timestamp\", \"DurationS\", \"EventType\", \"Destination\") FROM STDIN (FORMAT BINARY)", ct);
            string? line;
            var lineNo = 1;
            while ((line = await reader.ReadLineAsync(ct)) != null)
            {
                lineNo++;
                if (line.Length == 0) continue;
                var f = line.Split(',');
                if (f.Length < header.Length) { Err(errors, lineNo, $"has {f.Length} values, expected {header.Length}"); continue; }
                var type = f[typeCol].Trim();
                if (type.Equals("Data", StringComparison.OrdinalIgnoreCase)) continue;   // data sessions are in the daily file
                if (type.Equals("voice", StringComparison.OrdinalIgnoreCase)) type = "Voice";
                else if (type.Equals("sms", StringComparison.OrdinalIgnoreCase)) type = "SMS";
                else { Err(errors, lineNo, $"event_type '{f[typeCol]}' is not Voice, SMS or Data"); continue; }
                if (!DateTime.TryParseExact(f[tsCol].Trim(), TimestampFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var ts))
                { Err(errors, lineNo, $"session_timestamp '{f[tsCol]}' is not a date and time (YYYY-MM-DD HH:MM:SS)"); continue; }
                if (!double.TryParse(f[durCol], NumberStyles.Float, CultureInfo.InvariantCulture, out var dur) || dur < 0)
                { Err(errors, lineNo, $"session_duration '{f[durCol]}' is not a number >= 0"); continue; }
                var dest = f[destCol].Trim();
                if (dest.Length > 30) { Err(errors, lineNo, "call_destination is longer than 30 characters"); continue; }
                if (errors.Count > 0) continue;

                await writer.StartRowAsync(ct);
                await writer.WriteAsync(SimRef(f[simCol]), NpgsqlDbType.Varchar, ct);
                await writer.WriteAsync(DateTime.SpecifyKind(ts, DateTimeKind.Unspecified), NpgsqlDbType.Timestamp, ct);
                await writer.WriteAsync((int)Math.Round(dur), NpgsqlDbType.Integer, ct);
                await writer.WriteAsync(type, NpgsqlDbType.Varchar, ct);
                if (dest.Length == 0) await writer.WriteNullAsync(ct);
                else await writer.WriteAsync(dest, NpgsqlDbType.Varchar, ct);
                if (errors.Count >= MaxErrors) break;
            }
            if (errors.Count > 0) throw new ImportException(errors.Select(e => "Calls/SMS file, " + e).ToList());
            await writer.CompleteAsync(ct);
        }

        private static void Err(List<string> errors, int lineNo, string message)
        {
            if (errors.Count < MaxErrors) errors.Add($"line {lineNo:N0}: {message}");
        }

        private static async Task ExecAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, CancellationToken ct)
        {
            await using var cmd = new NpgsqlCommand(sql, conn, tx);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        private static async Task<long> ScalarAsync(NpgsqlConnection conn, NpgsqlTransaction tx, string sql, CancellationToken ct)
        {
            await using var cmd = new NpgsqlCommand(sql, conn, tx);
            return Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
        }
    }
}
