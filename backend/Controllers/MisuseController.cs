using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Dtos;
using ProSim.Api.Models;
using ProSim.Api.Services;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// Misuse detection for the admin dashboard: run scoring, list alerts and cases, SIM detail, operator review.
    /// NOTE: the API has no authentication yet (login returns the user but issues no token), so these endpoints
    /// are not restricted to administrators. Add authentication before deploying beyond a local demo.
    /// </summary>
    [ApiController]
    [Route("api/misuse")]
    public class MisuseController : ControllerBase
    {
        private static readonly string[] LevelOrder = { "High", "Alert", "Review", "Review (calls/SMS)" };
        private static readonly HashSet<string> ReviewStatuses = new() { "Open", "Confirmed", "FalseAlarm" };

        private readonly ProSimDbContext _db;
        private readonly MisuseScoringService _scoring;
        private readonly IHttpClientFactory _httpFactory;

        public MisuseController(ProSimDbContext db, MisuseScoringService scoring, IHttpClientFactory httpFactory)
        {
            _db = db;
            _scoring = scoring;
            _httpFactory = httpFactory;
        }

        private static int LevelRank(string level) => Array.IndexOf(LevelOrder, level) is var i && i >= 0 ? i : LevelOrder.Length;

        /// <summary>Score a range of days (default: the latest day with usage data) and store the alerts.</summary>
        [HttpPost("run")]
        public async Task<IActionResult> Run([FromBody] MisuseRunRequestDto? dto, CancellationToken ct)
        {
            var latest = await _scoring.LatestUsageDateAsync(ct);
            if (latest is null)
                return BadRequest(new { message = "No usage data yet. Import CDRs first: dotnet run -- import-cdr <folder>" });
            var from = dto?.From ?? latest.Value;
            var to = dto?.To ?? from;
            if (to < from) return BadRequest(new { message = "'to' is before 'from'." });
            if (to.DayNumber - from.DayNumber > 366) return BadRequest(new { message = "Score at most one year at a time." });
            try
            {
                return Ok(await _scoring.RunAsync(from, to, ct));
            }
            catch (MisuseScoringService.MlUnavailableException ex)
            {
                return StatusCode(503, new { message = ex.Message });
            }
        }

        /// <summary>Counts for the dashboard header, the data range, and the model in use.</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary(CancellationToken ct)
        {
            var hasUsage = await _db.UsageDaily.AnyAsync(ct);
            var alerts = await _db.MisuseAlerts.AsNoTracking()
                .GroupBy(a => new { a.AlertLevel, a.Status, a.MisuseType })
                .Select(g => new { g.Key.AlertLevel, g.Key.Status, g.Key.MisuseType, Count = g.Count() })
                .ToListAsync(ct);

            object? model = null;
            try
            {
                var client = _httpFactory.CreateClient("MlService");
                using var resp = await client.GetAsync("/misuse/model-info", ct);
                if (resp.IsSuccessStatusCode)
                    model = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync(ct));
            }
            catch (HttpRequestException) { /* ML service down: summary still works */ }

            return Ok(new
            {
                usageData = hasUsage
                    ? new
                    {
                        from = await _db.UsageDaily.MinAsync(u => u.Date, ct),
                        to = await _db.UsageDaily.MaxAsync(u => u.Date, ct),
                        sims = await _db.UsageDaily.Select(u => u.SimRef).Distinct().CountAsync(ct),
                    }
                    : null,
                lastScoredDay = await _db.MisuseAlerts.AnyAsync(ct) ? await _db.MisuseAlerts.MaxAsync(a => a.AlertDate, ct) : (DateOnly?)null,
                openByLevel = LevelOrder.ToDictionary(l => l, l => alerts.Where(a => a.AlertLevel == l && a.Status == "Open").Sum(a => a.Count)),
                byStatus = ReviewStatuses.ToDictionary(s => s, s => alerts.Where(a => a.Status == s).Sum(a => a.Count)),
                openByType = alerts.Where(a => a.Status == "Open").GroupBy(a => a.MisuseType)
                    .ToDictionary(g => g.Key, g => g.Sum(a => a.Count)),
                model,
            });
        }

        /// <summary>Alert days, most severe and most recent first. Filters are optional.</summary>
        [HttpGet("alerts")]
        public async Task<IActionResult> Alerts([FromQuery] string? level, [FromQuery] string? status,
            [FromQuery] string? type, [FromQuery] string? simRef, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        {
            pageSize = Math.Clamp(pageSize, 1, 500);
            page = Math.Max(page, 1);
            var q = Filtered(level, status, type, simRef, from, to);
            var total = await q.CountAsync(ct);
            var rows = await q.Include(a => a.Reviewer)
                .OrderByDescending(a => a.AlertDate)
                .ThenBy(a => a.AlertLevel == "High" ? 0 : a.AlertLevel == "Alert" ? 1 : a.AlertLevel == "Review" ? 2 : 3)
                .ThenBy(a => a.SimRef)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return Ok(new { total, page, pageSize, items = rows.Select(ToDto) });
        }

        /// <summary>
        /// Alerts grouped into cases: consecutive alert days on one SIM (a gap of one day still joins them).
        /// Default window: the last 30 days that have alerts. Sorted by severity, then most recent.
        /// </summary>
        [HttpGet("cases")]
        public async Task<IActionResult> Cases([FromQuery] string? status, [FromQuery] string? level,
            [FromQuery] string? type, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct = default)
        {
            if (to is null)
                to = await _db.MisuseAlerts.AnyAsync(ct) ? await _db.MisuseAlerts.MaxAsync(a => a.AlertDate, ct) : null;
            if (to is null) return Ok(new { from, to, total = 0, items = Array.Empty<MisuseCaseDto>() });
            from ??= to.Value.AddDays(-29);

            var alerts = await _db.MisuseAlerts.AsNoTracking()
                .Where(a => a.AlertDate >= from && a.AlertDate <= to)
                .OrderBy(a => a.SimRef).ThenBy(a => a.AlertDate)
                .ToListAsync(ct);

            var cases = new List<MisuseCaseDto>();
            foreach (var sim in alerts.GroupBy(a => a.SimRef))
            {
                var current = new List<MisuseAlert>();
                foreach (var a in sim)
                {
                    if (current.Count > 0 && a.AlertDate.DayNumber - current[^1].AlertDate.DayNumber > 2)
                    {
                        cases.Add(ToCase(current));
                        current = new List<MisuseAlert>();
                    }
                    current.Add(a);
                }
                if (current.Count > 0) cases.Add(ToCase(current));
            }

            IEnumerable<MisuseCaseDto> result = cases;
            if (!string.IsNullOrWhiteSpace(status)) result = result.Where(c => c.Status == status);
            if (!string.IsNullOrWhiteSpace(level)) result = result.Where(c => c.AlertLevel == level);
            if (!string.IsNullOrWhiteSpace(type)) result = result.Where(c => c.MisuseTypes.Contains(type));
            var items = result.OrderBy(c => LevelRank(c.AlertLevel)).ThenByDescending(c => c.EndDate)
                .ThenByDescending(c => c.AlertDays).ToList();
            return Ok(new { from, to, total = items.Count, items });
        }

        /// <summary>One SIM: daily usage (for the chart), its alerts, and the subscriber when the SIM is registered.</summary>
        [HttpGet("sims/{simRef}")]
        public async Task<IActionResult> Sim(string simRef, [FromQuery] int days = 90, CancellationToken ct = default)
        {
            days = Math.Clamp(days, 7, 366);
            var last = await _db.UsageDaily.Where(u => u.SimRef == simRef).Select(u => (DateOnly?)u.Date).MaxAsync(ct);
            if (last is null) return NotFound(new { message = $"No usage data for {simRef}." });
            var first = last.Value.AddDays(-(days - 1));

            var usage = await _db.UsageDaily.AsNoTracking()
                .Where(u => u.SimRef == simRef && u.Date >= first && u.Date <= last)
                .OrderBy(u => u.Date).ToListAsync(ct);
            var fromTs = first.ToDateTime(TimeOnly.MinValue);
            var calls = await _db.CallEvents.AsNoTracking()
                .Where(e => e.SimRef == simRef && e.EventType == "Voice" && e.Timestamp >= fromTs)
                .GroupBy(e => e.Timestamp.Date)
                .Select(g => new { Day = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => DateOnly.FromDateTime(x.Day), x => x.Count, ct);
            var alerts = await _db.MisuseAlerts.AsNoTracking().Include(a => a.Reviewer)
                .Where(a => a.SimRef == simRef).OrderBy(a => a.AlertDate).ToListAsync(ct);
            var sub = await (from s in _db.SimCards
                             join ra in _db.RegistrationApplications on s.SimCardId equals ra.SimCardId
                             join sb in _db.Subscribers on ra.SubscriberId equals sb.SubscriberId
                             where s.Phone == simRef || s.Iccid == simRef
                             select new { sb.FullName, sb.Department }).FirstOrDefaultAsync(ct);

            return Ok(new SimMisuseDetailDto
            {
                SimRef = simRef,
                Tier = usage.LastOrDefault()?.Tier,
                SubscriberName = sub?.FullName,
                Department = sub?.Department,
                Usage = usage.Select(u => new SimUsageDayDto
                {
                    Date = u.Date, TotalMb = Math.Round(u.TotalMb, 1), OffpeakMb = Math.Round(u.OffpeakMb, 1),
                    HotspotSessions = u.HotspotFlagCount, BilledMb = Math.Round(u.BilledMb, 1),
                    Calls = calls.GetValueOrDefault(u.Date), CallMinutes = Math.Round(u.VoiceMinutesUsed, 1), Sms = u.SmsCount,
                }).ToList(),
                Alerts = alerts.Select(ToDto).ToList(),
            });
        }

        /// <summary>Operator feedback on one or more alerts (e.g. all days of a case): Confirmed, FalseAlarm, or Open.</summary>
        [HttpPost("alerts/review")]
        public async Task<IActionResult> Review([FromBody] MisuseReviewDto dto, CancellationToken ct)
        {
            if (!ReviewStatuses.Contains(dto.Status))
                return BadRequest(new { message = "Status must be Confirmed, FalseAlarm or Open." });
            if (dto.ReviewerId is Guid rid &&
                !await _db.Users.AnyAsync(u => u.Id == rid && u.Role == "Administrator", ct))
                return BadRequest(new { message = "Reviewer must be an administrator account." });

            var ids = dto.AlertIds.Distinct().ToList();
            var alerts = await _db.MisuseAlerts.Where(a => ids.Contains(a.AlertId)).ToListAsync(ct);
            if (alerts.Count != ids.Count)
                return NotFound(new { message = $"{ids.Count - alerts.Count} of the alerts were not found." });

            var now = DateTime.UtcNow;
            foreach (var a in alerts)
            {
                a.Status = dto.Status;
                a.ReviewNote = dto.Status == "Open" ? null : dto.Note?.Trim();
                a.ReviewedBy = dto.Status == "Open" ? null : dto.ReviewerId;
                a.ReviewedAt = dto.Status == "Open" ? null : now;
                a.UpdatedAt = now;
            }
            await _db.SaveChangesAsync(ct);
            return Ok(new { updated = alerts.Count, status = dto.Status });
        }

        // ---- helpers ----

        private IQueryable<MisuseAlert> Filtered(string? level, string? status, string? type, string? simRef,
            DateOnly? from, DateOnly? to)
        {
            var q = _db.MisuseAlerts.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(level)) q = q.Where(a => a.AlertLevel == level);
            if (!string.IsNullOrWhiteSpace(status)) q = q.Where(a => a.Status == status);
            if (!string.IsNullOrWhiteSpace(type)) q = q.Where(a => a.MisuseType == type);
            if (!string.IsNullOrWhiteSpace(simRef)) q = q.Where(a => a.SimRef == simRef);
            if (from is not null) q = q.Where(a => a.AlertDate >= from);
            if (to is not null) q = q.Where(a => a.AlertDate <= to);
            return q;
        }

        private static List<string> JsonList(string json)
        {
            try { return JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
            catch (JsonException) { return new(); }
        }

        private static MisuseAlertDto ToDto(MisuseAlert a) => new()
        {
            AlertId = a.AlertId, SimRef = a.SimRef, AlertDate = a.AlertDate, AlertLevel = a.AlertLevel,
            MisuseType = a.MisuseType, Confidence = a.Confidence, MisuseScore = a.MisuseScore,
            DataAnomalyScore = a.DataAnomalyScore, CallAnomalyScore = a.CallAnomalyScore,
            FlaggedBy = JsonList(a.FlaggedBy), Signals = JsonList(a.Signals), ModelVersion = a.ModelVersion,
            Status = a.Status, ReviewedByName = a.Reviewer?.FullName, ReviewedAt = a.ReviewedAt, ReviewNote = a.ReviewNote,
        };

        private static MisuseCaseDto ToCase(List<MisuseAlert> days)
        {
            var worst = days.OrderBy(a => LevelRank(a.AlertLevel)).ThenByDescending(a => a.AlertDate).First();
            var status = days.Any(a => a.Status == "Open") ? "Open"
                       : days.Any(a => a.Status == "Confirmed") ? "Confirmed" : "FalseAlarm";
            return new MisuseCaseDto
            {
                SimRef = worst.SimRef,
                StartDate = days[0].AlertDate,
                EndDate = days[^1].AlertDate,
                AlertDays = days.Count,
                AlertLevel = worst.AlertLevel,
                MisuseTypes = days.OrderBy(a => LevelRank(a.AlertLevel)).Select(a => a.MisuseType).Distinct().ToList(),
                MaxConfidence = days.Max(a => a.Confidence),
                Signals = JsonList(worst.Signals),
                Status = status,
                AlertIds = days.Select(a => a.AlertId).ToList(),
            };
        }
    }
}
