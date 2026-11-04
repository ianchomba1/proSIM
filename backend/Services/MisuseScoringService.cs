using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Models;

namespace ProSim.Api.Services
{
    /// <summary>
    /// Scores SIM-days with the Python ML service (POST /misuse/score) and stores the alerts.
    /// Each request carries the SIMs' previous 89 days as history: the features compare a day with the SIM's own
    /// past, and the anomaly scores are 3-day averages. Rescoring a day updates its alert and keeps any review;
    /// an unreviewed alert that no longer appears is removed.
    /// </summary>
    public class MisuseScoringService
    {
        public const int HistoryDays = 89;   // + the scored day = 90 days, as in training
        private const int SimsPerRequest = 100;

        public static readonly JsonSerializerOptions MlJson = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true,
        };

        private readonly ProSimDbContext _db;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<MisuseScoringService> _logger;

        public MisuseScoringService(ProSimDbContext db, IHttpClientFactory httpFactory, ILogger<MisuseScoringService> logger)
        {
            _db = db;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        public record RunResult(DateOnly From, DateOnly To, int Sims, int DaysScored, int AlertsSaved,
                                int AlertsRemoved, Dictionary<string, int> AlertCounts, string ModelVersion, double Seconds);

        public class MlUnavailableException : Exception
        {
            public MlUnavailableException(string message, Exception? inner = null) : base(message, inner) { }
        }

        /// <summary>Latest day with usage data, or null if there is none.</summary>
        public async Task<DateOnly?> LatestUsageDateAsync(CancellationToken ct = default) =>
            await _db.UsageDaily.AnyAsync(ct) ? await _db.UsageDaily.MaxAsync(u => u.Date, ct) : null;

        public async Task<RunResult> RunAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
        {
            if (to < from) throw new ArgumentException("'to' is before 'from'.");
            var started = DateTime.UtcNow;
            var historyStart = from.AddDays(-HistoryDays);
            var eventsFrom = historyStart.ToDateTime(TimeOnly.MinValue);
            var eventsTo = to.AddDays(1).ToDateTime(TimeOnly.MinValue);

            var sims = await _db.UsageDaily.AsNoTracking()
                .Where(u => u.Date >= from && u.Date <= to)
                .Select(u => u.SimRef).Distinct().OrderBy(s => s).ToListAsync(ct);

            var counts = new Dictionary<string, int> { ["High"] = 0, ["Alert"] = 0, ["Review"] = 0, ["Review (calls/SMS)"] = 0 };
            int daysScored = 0, saved = 0, removed = 0;
            string modelVersion = "";
            var client = _httpFactory.CreateClient("MlService");

            foreach (var batch in sims.Chunk(SimsPerRequest))
            {
                var daily = await _db.UsageDaily.AsNoTracking()
                    .Where(u => batch.Contains(u.SimRef) && u.Date >= historyStart && u.Date <= to)
                    .OrderBy(u => u.SimRef).ThenBy(u => u.Date)
                    .Select(u => new MlDaily(u.SimRef, u.Date, u.Tier, u.TotalDownloadMb, u.TotalUploadMb, u.TotalMb,
                        u.SessionCount, u.DataSessionCount, u.TotalDurationS, u.MaxSessionMb, u.HotspotFlagCount,
                        u.GeoFlagCount, u.RoamingSessions, u.UniqueTowers, u.ApnPublicCount, u.OffpeakSessionCount,
                        u.OffpeakMb, u.BilledMb, u.VoiceMinutesUsed, u.SmsCount))
                    .ToListAsync(ct);
                var events = await _db.CallEvents.AsNoTracking()
                    .Where(e => batch.Contains(e.SimRef) && e.Timestamp >= eventsFrom && e.Timestamp < eventsTo)
                    .Select(e => new MlEvent(e.SimRef, e.Timestamp, e.DurationS, e.EventType, e.Destination))
                    .ToListAsync(ct);

                var request = new MlScoreRequest(daily, events, from, AlertsOnly: true);
                MlScoreResponse? result;
                try
                {
                    using var response = await client.PostAsJsonAsync("/misuse/score", request, MlJson, ct);
                    if (!response.IsSuccessStatusCode)
                    {
                        var body = await response.Content.ReadAsStringAsync(ct);
                        throw new MlUnavailableException($"ML service returned {(int)response.StatusCode}: {body}");
                    }
                    result = await response.Content.ReadFromJsonAsync<MlScoreResponse>(MlJson, ct);
                }
                catch (HttpRequestException ex)
                {
                    throw new MlUnavailableException("ML service is unreachable. Start it with ml-service\\run.ps1.", ex);
                }
                catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
                {
                    throw new MlUnavailableException("ML service timed out.", ex);
                }
                if (result is null) throw new MlUnavailableException("ML service returned an empty response.");

                modelVersion = result.ModelVersion;
                var results = result.Results.Where(r => DateOnly.Parse(r.Date) <= to).ToList();
                daysScored += result.DaysScored;
                (int s, int r) = await SaveAsync(batch, from, to, results, modelVersion, ct);
                saved += s;
                removed += r;
                foreach (var row in results) counts[row.AlertLevel] = counts.GetValueOrDefault(row.AlertLevel) + 1;
            }

            var secs = (DateTime.UtcNow - started).TotalSeconds;
            _logger.LogInformation("Misuse scoring {From}..{To}: {Sims} SIMs, {Alerts} alerts in {Secs:F0}s",
                from, to, sims.Count, saved, secs);
            return new RunResult(from, to, sims.Count, daysScored, saved, removed, counts, modelVersion, Math.Round(secs, 1));
        }

        private async Task<(int saved, int removed)> SaveAsync(string[] sims, DateOnly from, DateOnly to,
            List<MlScoredDay> results, string modelVersion, CancellationToken ct)
        {
            var existing = await _db.MisuseAlerts
                .Where(a => sims.Contains(a.SimRef) && a.AlertDate >= from && a.AlertDate <= to)
                .ToDictionaryAsync(a => (a.SimRef, a.AlertDate), ct);
            var now = DateTime.UtcNow;
            var seen = new HashSet<(string, DateOnly)>();

            foreach (var r in results)
            {
                var key = (r.SimId, DateOnly.Parse(r.Date));
                seen.Add(key);
                if (!existing.TryGetValue(key, out var alert))
                {
                    alert = new MisuseAlert { SimRef = r.SimId, AlertDate = key.Item2, CreatedAt = now };
                    _db.MisuseAlerts.Add(alert);
                }
                alert.AlertLevel = r.AlertLevel;
                alert.MisuseType = r.MisuseType;
                alert.Confidence = r.Confidence;
                alert.MisuseScore = r.MisuseScore;
                alert.DataAnomalyScore = r.DataAnomalyScore;
                alert.CallAnomalyScore = r.CallAnomalyScore;
                alert.FlaggedBy = JsonSerializer.Serialize(r.FlaggedBy);
                alert.Signals = JsonSerializer.Serialize(r.Signals);
                alert.ModelVersion = modelVersion;
                alert.UpdatedAt = now;
            }

            // Unreviewed alerts the models no longer raise are removed; reviewed ones are kept as a record.
            var stale = existing.Where(kv => !seen.Contains(kv.Key) && kv.Value.Status == "Open").Select(kv => kv.Value).ToList();
            _db.MisuseAlerts.RemoveRange(stale);
            await _db.SaveChangesAsync(ct);
            return (results.Count, stale.Count);
        }

        // ---- request / response shapes of the ML service (snake_case on the wire) ----

        public record MlDaily(string SimId, DateOnly Date, string Tier, double TotalDownloadMb, double TotalUploadMb,
            double TotalMb, int SessionCount, int DataSessionCount, double TotalDurationS, double MaxSessionMb,
            int HotspotFlagCount, int GeoFlagCount, int RoamingSessions, int UniqueTowers, int ApnPublicCount,
            int OffpeakSessionCount, double OffpeakMb, double BilledMb, double VoiceMinutesUsed, int SmsCount);

        public record MlEvent(string SimId, DateTime SessionTimestamp, int SessionDuration, string EventType,
            string? CallDestination);

        public record MlScoreRequest(List<MlDaily> Daily, List<MlEvent> Events, DateOnly ScoreFrom, bool AlertsOnly);

        public record MlScoredDay(string SimId, string Date, string AlertLevel, string MisuseType, double? Confidence,
            double MisuseScore, double DataAnomalyScore, double CallAnomalyScore, List<string> FlaggedBy,
            List<string> Signals);

        public record MlScoreResponse(string ModelVersion, int Sims, int DaysScored, Dictionary<string, int> AlertCounts,
            List<MlScoredDay> Results);
    }
}
