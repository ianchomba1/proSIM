using System.Globalization;
using Npgsql;
using NpgsqlTypes;

namespace ProSim.Api.Services
{
    /// <summary>
    /// Loads the CDR generator's output into UsageDaily and CallEvents (PostgreSQL binary COPY).
    ///     dotnet run -- import-cdr "C:\Users\user\Downloads\cdr results" [--replace]
    /// Reads synthetic_cdr_daily_agg.csv and synthetic_cdr_sessions.csv (only Voice and SMS rows; data sessions are
    /// already summarised in the daily file). Synthetic sim_id 87 is stored as SimRef "SIM-0087".
    /// Run from the command line only: it is not exposed as an HTTP endpoint.
    /// </summary>
    public static class CdrImporter
    {
        private static readonly string[] DailyCols =
        {
            "TotalDownloadMb:total_download_mb:d", "TotalUploadMb:total_upload_mb:d", "TotalMb:total_mb:d",
            "SessionCount:session_count:i", "DataSessionCount:data_session_count:i", "TotalDurationS:total_duration_s:d",
            "MaxSessionMb:max_session_mb:d", "HotspotFlagCount:hotspot_flag_count:i", "GeoFlagCount:geo_flag_count:i",
            "RoamingSessions:roaming_sessions:i", "UniqueTowers:unique_towers:i", "ApnPublicCount:apn_public_count:i",
            "OffpeakSessionCount:offpeak_session_count:i", "OffpeakMb:offpeak_mb:d", "BilledMb:billed_mb:d",
            "VoiceMinutesUsed:voice_minutes_used:d", "SmsCount:sms_count:i",
        };

        private static readonly string[] TimestampFormats = { "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm:ss.FFFFFFF", "yyyy-MM-dd" };

        public static string SimRef(string syntheticId) => $"SIM-{int.Parse(syntheticId, CultureInfo.InvariantCulture):D4}";

        public static async Task<int> RunAsync(string connectionString, string folder, bool replace, ILogger logger)
        {
            var dailyPath = Path.Combine(folder, "synthetic_cdr_daily_agg.csv");
            var sessionsPath = Path.Combine(folder, "synthetic_cdr_sessions.csv");
            foreach (var p in new[] { dailyPath, sessionsPath })
            {
                if (!File.Exists(p)) { logger.LogError("File not found: {Path}", p); return 1; }
            }

            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();
            long existing;
            await using (var cmd = new NpgsqlCommand(
                "SELECT (SELECT COUNT(*) FROM \"UsageDaily\") + (SELECT COUNT(*) FROM \"CallEvents\")", conn))
                existing = (long)(await cmd.ExecuteScalarAsync())!;
            if (existing > 0 && !replace)
            {
                logger.LogError("UsageDaily/CallEvents already hold {Rows:N0} rows. Add --replace to delete them and import again.", existing);
                return 1;
            }

            await using var tx = await conn.BeginTransactionAsync();
            if (existing > 0)
            {
                await using var del = new NpgsqlCommand("TRUNCATE \"UsageDaily\", \"CallEvents\" RESTART IDENTITY", conn, tx);
                await del.ExecuteNonQueryAsync();
                logger.LogInformation("Deleted {Rows:N0} existing usage/call rows", existing);
            }

            var started = DateTime.UtcNow;
            long days = await ImportDailyAsync(conn, dailyPath);
            long events = await ImportEventsAsync(conn, sessionsPath);
            await tx.CommitAsync();
            logger.LogInformation("Imported {Days:N0} SIM-days and {Events:N0} calls/SMS from {Folder} in {Secs:F0}s",
                days, events, folder, (DateTime.UtcNow - started).TotalSeconds);
            return 0;
        }

        private static async Task<long> ImportDailyAsync(NpgsqlConnection conn, string path)
        {
            using var reader = new StreamReader(path);
            var header = (await reader.ReadLineAsync())!.Split(',');
            int Col(string name)
            {
                var i = Array.IndexOf(header, name);
                if (i < 0) throw new InvalidDataException($"{Path.GetFileName(path)} has no column '{name}'");
                return i;
            }
            int simCol = Col("sim_id"), dateCol = Col("date"), tierCol = Col("tier");
            var cols = DailyCols.Select(c => c.Split(':')).Select(p => (db: p[0], idx: Col(p[1]), type: p[2])).ToArray();

            var copy = "COPY \"UsageDaily\" (\"SimRef\", \"Date\", \"Tier\", " +
                       string.Join(", ", cols.Select(c => $"\"{c.db}\"")) + ") FROM STDIN (FORMAT BINARY)";
            long rows = 0;
            await using var writer = await conn.BeginBinaryImportAsync(copy);
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (line.Length == 0) continue;
                var f = line.Split(',');
                await writer.StartRowAsync();
                await writer.WriteAsync(SimRef(f[simCol]), NpgsqlDbType.Varchar);
                await writer.WriteAsync(DateOnly.ParseExact(f[dateCol], "yyyy-MM-dd", CultureInfo.InvariantCulture), NpgsqlDbType.Date);
                await writer.WriteAsync(f[tierCol], NpgsqlDbType.Varchar);
                foreach (var c in cols)
                {
                    if (c.type == "i")
                        await writer.WriteAsync((int)Math.Round(double.Parse(f[c.idx], CultureInfo.InvariantCulture)), NpgsqlDbType.Integer);
                    else
                        await writer.WriteAsync(double.Parse(f[c.idx], CultureInfo.InvariantCulture), NpgsqlDbType.Double);
                }
                rows++;
            }
            await writer.CompleteAsync();
            return rows;
        }

        private static async Task<long> ImportEventsAsync(NpgsqlConnection conn, string path)
        {
            using var reader = new StreamReader(path);
            var header = (await reader.ReadLineAsync())!.Split(',');
            int Col(string name)
            {
                var i = Array.IndexOf(header, name);
                if (i < 0) throw new InvalidDataException($"{Path.GetFileName(path)} has no column '{name}'");
                return i;
            }
            int simCol = Col("sim_id"), tsCol = Col("session_timestamp"), durCol = Col("session_duration"),
                typeCol = Col("event_type"), destCol = Col("call_destination");

            long rows = 0;
            await using var writer = await conn.BeginBinaryImportAsync(
                "COPY \"CallEvents\" (\"SimRef\", \"Timestamp\", \"DurationS\", \"EventType\", \"Destination\") FROM STDIN (FORMAT BINARY)");
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (line.Length == 0) continue;
                var f = line.Split(',');
                var type = f[typeCol];
                if (type != "Voice" && type != "SMS") continue;
                var ts = DateTime.ParseExact(f[tsCol], TimestampFormats, CultureInfo.InvariantCulture, DateTimeStyles.None);
                await writer.StartRowAsync();
                await writer.WriteAsync(SimRef(f[simCol]), NpgsqlDbType.Varchar);
                await writer.WriteAsync(DateTime.SpecifyKind(ts, DateTimeKind.Unspecified), NpgsqlDbType.Timestamp);
                await writer.WriteAsync((int)Math.Round(double.Parse(f[durCol], CultureInfo.InvariantCulture)), NpgsqlDbType.Integer);
                await writer.WriteAsync(type, NpgsqlDbType.Varchar);
                var dest = f[destCol];
                if (string.IsNullOrEmpty(dest)) await writer.WriteNullAsync();
                else await writer.WriteAsync(dest, NpgsqlDbType.Varchar);
                rows++;
            }
            await writer.CompleteAsync();
            return rows;
        }
    }
}
