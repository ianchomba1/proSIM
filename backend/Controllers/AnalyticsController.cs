using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Models;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// Figures for the Analytics page. Two endpoints because the data has two clocks:
    /// misuse alerts are dated by the usage data they were scored from (the latest scored day is the anchor),
    /// while applications and SIM stock are dated by real time (today is the anchor).
    /// `weeks` = how many weeks back from the anchor (0 = everything). Department applies to operations only:
    /// usage data is keyed by SimRef and is not linked to employees yet.
    /// NOTE: no authentication yet, same as the rest of the API.
    /// </summary>
    [ApiController]
    [Route("api/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private static readonly string[] LevelOrder = { "High", "Alert", "Review", "Review (calls/SMS)" };
        private const int DefaultWeeks = 13;
        private const int LowStockMinimum = 5;

        private readonly ProSimDbContext _db;
        private readonly IHttpClientFactory _httpFactory;

        public AnalyticsController(ProSimDbContext db, IHttpClientFactory httpFactory)
        {
            _db = db;
            _httpFactory = httpFactory;
        }

        private static int Weeks(int? weeks) => weeks is null ? DefaultWeeks : Math.Clamp(weeks.Value, 0, 520);

        private static int LevelRank(string level) => Array.IndexOf(LevelOrder, level) is var i && i >= 0 ? i : LevelOrder.Length;

        private static double? Median(List<double> values)
        {
            if (values.Count == 0) return null;
            values.Sort();
            var mid = values.Count / 2;
            return values.Count % 2 == 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
        }

        private static double? Rate(int part, int whole) => whole == 0 ? null : Math.Round((double)part / whole, 4);

        // ---------------------------------------------------------------- misuse

        [HttpGet("misuse")]
        public async Task<IActionResult> Misuse([FromQuery] int? weeks, CancellationToken ct)
        {
            var w = Weeks(weeks);
            var model = await ModelInfoAsync(ct);
            if (!await _db.MisuseAlerts.AnyAsync(ct))
                return Ok(new { hasData = false, weeks = w, model });

            var first = await _db.MisuseAlerts.MinAsync(a => a.AlertDate, ct);
            var last = await _db.MisuseAlerts.MaxAsync(a => a.AlertDate, ct);
            // Whole weeks (Monday start) ending with the latest scored day's week
            var from = w == 0 ? first : DateOnly.FromDateTime(WeekStart(last.ToDateTime(TimeOnly.MinValue)).AddDays(-7 * (w - 1)));
            if (from < first) from = first;

            var q = _db.MisuseAlerts.AsNoTracking().Where(a => a.AlertDate >= from && a.AlertDate <= last);

            var cells = await q
                .GroupBy(a => new { a.AlertDate, a.AlertLevel, a.MisuseType, a.Status })
                .Select(g => new { g.Key.AlertDate, g.Key.AlertLevel, g.Key.MisuseType, g.Key.Status, Count = g.Count() })
                .ToListAsync(ct);

            var daily = cells.GroupBy(c => new { c.AlertDate, c.AlertLevel })
                .OrderBy(g => g.Key.AlertDate).ThenBy(g => LevelRank(g.Key.AlertLevel))
                .Select(g => new { date = g.Key.AlertDate, level = g.Key.AlertLevel, count = g.Sum(c => c.Count) });

            var byLevel = LevelOrder.Select(level =>
            {
                var rows = cells.Where(c => c.AlertLevel == level).ToList();
                int confirmed = rows.Where(c => c.Status == "Confirmed").Sum(c => c.Count);
                int falseAlarm = rows.Where(c => c.Status == "FalseAlarm").Sum(c => c.Count);
                return new
                {
                    level,
                    total = rows.Sum(c => c.Count),
                    open = rows.Where(c => c.Status == "Open").Sum(c => c.Count),
                    confirmed,
                    falseAlarm,
                    livePrecision = Rate(confirmed, confirmed + falseAlarm),
                };
            });

            var byType = cells.GroupBy(c => c.MisuseType)
                .Select(g =>
                {
                    int confirmed = g.Where(c => c.Status == "Confirmed").Sum(c => c.Count);
                    int falseAlarm = g.Where(c => c.Status == "FalseAlarm").Sum(c => c.Count);
                    return new
                    {
                        type = g.Key,
                        total = g.Sum(c => c.Count),
                        open = g.Where(c => c.Status == "Open").Sum(c => c.Count),
                        confirmed,
                        falseAlarm,
                        livePrecision = Rate(confirmed, confirmed + falseAlarm),
                        // Types the Random Forest names vs. "type unknown" from the Isolation Forests
                        fromIsolationForest = g.All(c => c.AlertLevel.StartsWith("Review")),
                    };
                })
                .OrderByDescending(t => t.total);

            var reviewed = await q.Where(a => a.ReviewedAt != null)
                .Select(a => new { a.CreatedAt, ReviewedAt = a.ReviewedAt!.Value })
                .ToListAsync(ct);
            var reviewHours = reviewed.Select(r => Math.Max(0, (r.ReviewedAt - r.CreatedAt).TotalHours)).ToList();

            var simCells = await q
                .GroupBy(a => new { a.SimRef, a.AlertLevel, a.MisuseType })
                .Select(g => new
                {
                    g.Key.SimRef, g.Key.AlertLevel, g.Key.MisuseType,
                    Days = g.Count(),
                    Last = g.Max(a => a.AlertDate),
                    Open = g.Count(a => a.Status == "Open"),
                })
                .ToListAsync(ct);
            var sims = simCells.GroupBy(s => s.SimRef)
                .Select(g => new
                {
                    simRef = g.Key,
                    alertDays = g.Sum(s => s.Days),
                    openDays = g.Sum(s => s.Open),
                    lastAlert = g.Max(s => s.Last),
                    highestLevel = g.OrderBy(s => LevelRank(s.AlertLevel)).First().AlertLevel,
                    mainType = g.GroupBy(s => s.MisuseType).OrderByDescending(t => t.Sum(s => s.Days)).First().Key,
                })
                .ToList();

            var total = cells.Sum(c => c.Count);
            return Ok(new
            {
                hasData = true,
                weeks = w,
                range = new { from, to = last },
                dataRange = new { from = first, to = last },
                totals = new
                {
                    alerts = total,
                    open = cells.Where(c => c.Status == "Open").Sum(c => c.Count),
                    confirmed = cells.Where(c => c.Status == "Confirmed").Sum(c => c.Count),
                    falseAlarm = cells.Where(c => c.Status == "FalseAlarm").Sum(c => c.Count),
                    simsFlagged = sims.Count,
                    simsFlaggedMoreThanOnce = sims.Count(s => s.alertDays > 1),
                },
                review = new
                {
                    reviewed = reviewHours.Count,
                    reviewedShare = Rate(reviewHours.Count, total),
                    medianHoursToReview = Median(reviewHours) is double m ? Math.Round(m, 1) : (double?)null,
                },
                daily,
                byLevel,
                byType,
                repeatSims = sims.Where(s => s.alertDays > 1)
                    .OrderByDescending(s => s.alertDays).ThenBy(s => LevelRank(s.highestLevel)).ThenBy(s => s.simRef)
                    .Take(10),
                modelVersionsInAlerts = await q.Select(a => a.ModelVersion).Distinct().OrderBy(v => v).ToListAsync(ct),
                model,
            });
        }

        /// <summary>Model version and held-out test results from the ML service; null when it is down.</summary>
        private async Task<object?> ModelInfoAsync(CancellationToken ct)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(4));
            try
            {
                var client = _httpFactory.CreateClient("MlService");
                using var resp = await client.GetAsync("/misuse/model-info", timeout.Token);
                if (!resp.IsSuccessStatusCode) return null;
                var info = JsonSerializer.Deserialize<JsonElement>(await resp.Content.ReadAsStringAsync(timeout.Token));
                return new
                {
                    modelVersion = info.TryGetProperty("model_version", out var v) ? v.GetString() : null,
                    testResults = info.TryGetProperty("test_results", out var t) && t.ValueKind == JsonValueKind.Object ? t : (JsonElement?)null,
                };
            }
            catch (HttpRequestException) { return null; }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return null; }
            catch (JsonException) { return null; }
        }

        // ---------------------------------------------------------------- operations

        private sealed record AppRow(Guid? EmployeeId, string? ApplicantDepartment, string Status,
            DateTime SubmissionDate, DateTime? ReviewDate, Guid? SimCardId);

        private static DateTime WeekStart(DateTime d) => d.Date.AddDays(-(((int)d.DayOfWeek + 6) % 7));   // Monday

        [HttpGet("operations")]
        public async Task<IActionResult> Operations([FromQuery] int? weeks, [FromQuery] string? department, CancellationToken ct)
        {
            var w = Weeks(weeks);
            var today = DateTime.UtcNow.Date;
            var dept = string.IsNullOrWhiteSpace(department) ? null : department.Trim();
            bool InDept(string? d) => dept is null || string.Equals(d?.Trim(), dept, StringComparison.OrdinalIgnoreCase);

            var employees = await _db.Employees.AsNoTracking()
                .Select(e => new { e.EmployeeId, e.Department, e.SimStatus })
                .ToListAsync(ct);
            var deptOf = employees.ToDictionary(e => e.EmployeeId, e => e.Department);

            var apps = await _db.RegistrationApplications.AsNoTracking()
                .Select(a => new AppRow(a.EmployeeId, a.ApplicantDepartment, a.ApplicationStatus, a.SubmissionDate, a.ReviewDate, a.SimCardId))
                .ToListAsync(ct);
            string? AppDept(AppRow a) => a.EmployeeId is Guid id && deptOf.TryGetValue(id, out var d) ? d : a.ApplicantDepartment;

            var sims = await _db.SimCards.AsNoTracking()
                .Select(s => new { s.SimCardId, s.Status, Received = s.ReceivedAt ?? s.CreatedAt })
                .ToListAsync(ct);

            var earliest = new[] { today }
                .Concat(apps.Select(a => a.SubmissionDate.Date))
                .Concat(sims.Select(s => s.Received.Date)).Min();
            var from = w == 0 ? WeekStart(earliest) : WeekStart(today).AddDays(-7 * (w - 1));   // whole weeks
            var end = today.AddDays(1);   // exclusive
            bool InRange(DateTime? d) => d is DateTime x && x >= from && x < end;

            var deptApps = apps.Where(a => InDept(AppDept(a))).ToList();
            // A SIM leaves stock when its application is approved
            var issues = apps.Where(a => a.Status == "Approved" && a.SimCardId != null && a.ReviewDate != null).ToList();
            var issuedAt = issues.GroupBy(a => a.SimCardId!.Value).ToDictionary(g => g.Key, g => g.Min(a => a.ReviewDate!.Value));
            // When each SIM left stock: null = still in stock. SIMs issued before the stock page existed
            // (not in stock, no approved application) count as never having been in stock.
            var leftStock = sims.ToDictionary(s => s.SimCardId, s =>
                s.Status == SimCard.InStock ? (DateTime?)null
                : issuedAt.TryGetValue(s.SimCardId, out var at) ? (at > s.Received ? at : s.Received)
                : s.Received);

            var weekStarts = new List<DateTime>();
            for (var ws = from; ws <= today; ws = ws.AddDays(7)) weekStarts.Add(ws);

            var inStockNow = sims.Count(s => s.Status == SimCard.InStock);
            var applicationsWeekly = weekStarts.Select(ws => new
            {
                weekStart = DateOnly.FromDateTime(ws),
                submitted = deptApps.Count(a => a.SubmissionDate >= ws && a.SubmissionDate < ws.AddDays(7)),
                approved = deptApps.Count(a => a.Status == "Approved" && a.ReviewDate >= ws && a.ReviewDate < ws.AddDays(7)),
                rejected = deptApps.Count(a => a.Status == "Rejected" && a.ReviewDate >= ws && a.ReviewDate < ws.AddDays(7)),
            });
            var stockWeekly = weekStarts.Select(ws =>
            {
                var weekEnd = ws.AddDays(7);
                return new
                {
                    weekStart = DateOnly.FromDateTime(ws),
                    received = sims.Count(s => s.Received >= ws && s.Received < weekEnd),
                    issued = sims.Count(s => issuedAt.ContainsKey(s.SimCardId)
                        && leftStock[s.SimCardId] is DateTime left && left >= ws && left < weekEnd),
                    // In stock at the end of the week (today's count for the current week)
                    inStockAtEnd = weekEnd > today ? inStockNow
                        : sims.Count(s => s.Received < weekEnd && (leftStock[s.SimCardId] is not DateTime left || left >= weekEnd)),
                };
            });

            var decided = deptApps.Where(a => (a.Status == "Approved" || a.Status == "Rejected") && InRange(a.ReviewDate)).ToList();
            var approved = decided.Count(a => a.Status == "Approved");
            var hoursToDecision = decided.Select(a => Math.Max(0, (a.ReviewDate!.Value - a.SubmissionDate).TotalHours)).ToList();

            var simStatus = sims.ToDictionary(s => s.SimCardId, s => s.Status);
            var issuedByDepartment = issues
                .Where(a => simStatus.TryGetValue(a.SimCardId!.Value, out var st) && (st == SimCard.Active || st == SimCard.Suspended))
                .GroupBy(a => string.IsNullOrWhiteSpace(AppDept(a)) ? "(no department)" : AppDept(a)!.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new { department = g.Key, sims = g.Count() })
                .OrderByDescending(d => d.sims).ThenBy(d => d.department);

            var deptEmployees = employees.Where(e => InDept(e.Department)).ToList();
            var pendingAll = apps.Count(a => a.Status == "Pending");

            return Ok(new
            {
                weeks = w,
                department = dept,
                range = new { from = DateOnly.FromDateTime(from), to = DateOnly.FromDateTime(today) },
                departments = employees.Select(e => e.Department.Trim()).Where(d => d != "")
                    .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(d => d),
                applications = new
                {
                    submitted = deptApps.Count(a => InRange(a.SubmissionDate)),
                    approved,
                    rejected = decided.Count - approved,
                    approvalRate = Rate(approved, decided.Count),
                    medianHoursToDecision = Median(hoursToDecision) is double m ? Math.Round(m, 1) : (double?)null,
                    pendingNow = deptApps.Count(a => a.Status == "Pending"),
                    weekly = applicationsWeekly,
                },
                employees = new
                {
                    total = deptEmployees.Count,
                    byStatus = new[] { Employee.NotApplied, Employee.Pending, Employee.Approved, Employee.Rejected }
                        .Select(s => new { status = s, count = deptEmployees.Count(e => e.SimStatus == s) }),
                },
                stock = new
                {
                    inStock = inStockNow,
                    pendingApplications = pendingAll,
                    lowStockMinimum = LowStockMinimum,
                    byStatus = new[] { SimCard.InStock, SimCard.Active, SimCard.Suspended, SimCard.Deactivated }
                        .Select(s => new { status = s, count = sims.Count(x => x.Status == s) }),
                    weekly = stockWeekly,
                },
                issuedByDepartment,
            });
        }
    }
}
