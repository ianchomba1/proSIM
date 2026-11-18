using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Models;
using ProSim.Api.Services;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// SIM card stock: SIMs received from the telecom operator, kept until an approved application issues them.
    ///   GET    /api/simcards           every SIM, with who it was issued to
    ///   POST   /api/simcards           add one SIM to stock: { iccid, phone, batchReference?, addedBy? }
    ///   POST   /api/simcards/import    multipart: file (CSV), batchReference (used for rows without one), addedBy.
    ///                                  All rows are checked first; if any row has a problem nothing is saved.
    ///                                  Rows whose ICCID is already recorded are skipped.
    ///   DELETE /api/simcards/{id}      remove a SIM that is still in stock (e.g. entered by mistake)
    /// NOTE: like the other admin endpoints this is not yet protected by authentication; addedBy, when given,
    /// must belong to an Administrator account.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SimCardsController : ControllerBase
    {
        private const long MaxCsvBytes = 5L * 1024 * 1024;
        private const int MaxRows = 20_000;
        private const int MaxErrors = 25;

        private readonly ProSimDbContext _db;
        private readonly ILogger<SimCardsController> _logger;

        public SimCardsController(ProSimDbContext db, ILogger<SimCardsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        public record AddSimDto(string? Iccid, string? Phone, string? BatchReference, Guid? AddedBy);

        public record SimCardDto(Guid SimCardId, string Iccid, string Phone, string Status, string? BatchReference,
            DateTime ReceivedAt, string? AddedByName, string? AssignedTo, string? AssignedStaffNumber,
            string? ApplicationStatus, DateTime? IssuedAt);

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct)
        {
            var sims = await _db.SimCards.AsNoTracking().OrderByDescending(s => s.ReceivedAt ?? s.CreatedAt).ToListAsync(ct);
            var adders = await _db.Users.AsNoTracking()
                .Where(u => sims.Select(s => s.AddedBy).Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
            // Who each SIM went to: its latest application (approved ones first).
            var apps = (await _db.RegistrationApplications.AsNoTracking()
                    .Where(a => a.SimCardId != null)
                    .Select(a => new
                    {
                        a.SimCardId, a.ApplicationStatus, a.ReviewDate, a.SubmissionDate,
                        Name = a.ApplicantFullName ?? (a.Subscriber != null ? a.Subscriber.FullName : null),
                        Staff = a.ApplicantInstitutionalId ?? (a.Subscriber != null ? a.Subscriber.InstitutionalId : null),
                    })
                    .ToListAsync(ct))
                .GroupBy(a => a.SimCardId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(a => a.ApplicationStatus == "Approved")
                    .ThenByDescending(a => a.SubmissionDate).First());

            return Ok(sims.Select(s =>
            {
                apps.TryGetValue(s.SimCardId, out var a);
                return new SimCardDto(s.SimCardId, s.Iccid, s.Phone, s.Status, s.BatchReference, s.ReceivedAt ?? s.CreatedAt,
                    s.AddedBy is Guid uid && adders.TryGetValue(uid, out var n) ? n : null,
                    a?.Name, a?.Staff, a?.ApplicationStatus, a?.ApplicationStatus == "Approved" ? a.ReviewDate : null);
            }));
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddSimDto dto, CancellationToken ct)
        {
            if (await NotAdmin(dto.AddedBy, ct))
                return BadRequest(new { message = "SIM cards must be added by an administrator account." });
            var (clean, errors) = SimCardRules.Validate(dto.Iccid, dto.Phone, dto.BatchReference);
            if (clean == null)
                return BadRequest(new { message = char.ToUpperInvariant(errors[0][0]) + string.Join("; ", errors)[1..] + "." });
            if (await _db.SimCards.AnyAsync(s => s.Iccid == clean.Iccid, ct))
                return Conflict(new { message = $"A SIM card with ICCID {clean.Iccid} is already recorded." });
            if (await _db.SimCards.AnyAsync(s => s.Phone == clean.Phone, ct))
                return Conflict(new { message = $"The number {clean.Phone} already belongs to another SIM card." });

            var sim = NewSim(clean, dto.AddedBy);
            _db.SimCards.Add(sim);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("SIM {Iccid} added to stock", sim.Iccid);
            return Ok(new { message = $"SIM {sim.Iccid} ({sim.Phone}) added to stock." });
        }

        [HttpPost("import")]
        [RequestSizeLimit(MaxCsvBytes + 64 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxCsvBytes + 64 * 1024)]
        public async Task<IActionResult> Import([FromForm] IFormFile? file, [FromForm] string? batchReference = null,
            [FromForm] Guid? addedBy = null, CancellationToken ct = default)
        {
            if (file is null || file.Length == 0) return BadRequest(new { message = "Choose a CSV file of SIM cards." });
            if (!Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "The file must be a .csv file. In Excel use File > Save As > CSV UTF-8." });
            if (file.Length > MaxCsvBytes) return BadRequest(new { message = "The file is larger than 5 MB." });
            if (await NotAdmin(addedBy, ct))
                return BadRequest(new { message = "SIM cards must be imported by an administrator account." });

            List<(int line, List<string> fields)> records;
            using (var reader = new StreamReader(file.OpenReadStream()))
                records = EmployeeRules.ReadCsv(reader).Take(MaxRows + 2).ToList();
            if (records.Count == 0) return BadRequest(new { message = "The file is empty." });
            if (records.Count > MaxRows + 1) return BadRequest(new { message = $"The file has more than {MaxRows:N0} rows; split it into smaller files." });

            var columns = new Dictionary<string, int>();
            var header = records[0].fields;
            for (var i = 0; i < header.Count; i++)
                if (SimCardRules.HeaderAliases.TryGetValue(EmployeeRules.HeaderKey(header[i]), out var field) && !columns.ContainsKey(field))
                    columns[field] = i;
            var missing = new[] { ("iccid", "iccid"), ("phone", "phone") }.Where(c => !columns.ContainsKey(c.Item1)).Select(c => c.Item2).ToList();
            if (missing.Count > 0)
                return BadRequest(new
                {
                    message = "The file was not imported. Nothing was changed.",
                    errors = new[] { $"Missing column(s): {string.Join(", ", missing)}. Download the template to see the expected columns." },
                });
            if (records.Count == 1) return BadRequest(new { message = "The file has a header row but no SIM cards." });

            string Get(List<string> f, string field) => columns.TryGetValue(field, out var i) && i < f.Count ? f[i] : string.Empty;

            var existing = await _db.SimCards.AsNoTracking().Select(s => new { s.Iccid, s.Phone }).ToListAsync(ct);
            var iccidInDb = existing.Select(s => s.Iccid.ToUpperInvariant()).ToHashSet();
            var phoneInDb = existing.GroupBy(s => s.Phone).ToDictionary(g => g.Key, g => g.First().Iccid);

            var errors = new List<string>();
            var skipped = new List<object>();
            var toAdd = new List<SimCardRules.Clean>();
            var iccidInFile = new Dictionary<string, int>();
            var phoneInFile = new Dictionary<string, int>();
            var problemRows = 0;

            foreach (var (line, f) in records.Skip(1))
            {
                var batch = Get(f, "batch");
                var (clean, rowErrors) = SimCardRules.Validate(Get(f, "iccid"), Get(f, "phone"),
                    string.IsNullOrWhiteSpace(batch) ? batchReference : batch);
                if (clean != null)
                {
                    if (iccidInDb.Contains(clean.Iccid))
                    {
                        skipped.Add(new { line, iccid = clean.Iccid, reason = "already recorded" });
                        continue;
                    }
                    if (iccidInFile.TryGetValue(clean.Iccid, out var l1)) rowErrors.Add($"ICCID {clean.Iccid} is also on line {l1}");
                    if (phoneInDb.TryGetValue(clean.Phone, out var other)) rowErrors.Add($"number {clean.Phone} already belongs to SIM {other}");
                    else if (phoneInFile.TryGetValue(clean.Phone, out var l2)) rowErrors.Add($"number {clean.Phone} is also on line {l2}");
                    iccidInFile.TryAdd(clean.Iccid, line);
                    phoneInFile.TryAdd(clean.Phone, line);
                }
                if (rowErrors.Count > 0)
                {
                    problemRows++;
                    if (errors.Count < MaxErrors) errors.Add($"Line {line}: {string.Join("; ", rowErrors)}.");
                    continue;
                }
                toAdd.Add(clean!);
            }

            if (problemRows > 0)
            {
                if (problemRows > errors.Count) errors.Add($"…and {problemRows - errors.Count} more row(s) with problems.");
                return BadRequest(new { message = $"The file was not imported: {problemRows} row(s) have problems. Nothing was changed.", errors });
            }

            _db.SimCards.AddRange(toAdd.Select(c => NewSim(c, addedBy)));
            await _db.SaveChangesAsync(ct);   // one transaction: all rows or none
            _logger.LogInformation("SIM import {File}: {Added} added, {Skipped} skipped", file.FileName, toAdd.Count, skipped.Count);

            var msg = toAdd.Count == 0
                ? "No new SIM cards: every ICCID in the file is already recorded."
                : $"{toAdd.Count:N0} SIM card(s) added to stock" + (skipped.Count > 0 ? $", {skipped.Count:N0} skipped (already recorded)." : ".");
            return Ok(new { message = msg, added = toAdd.Count, skipped });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
        {
            var sim = await _db.SimCards.FindAsync(new object[] { id }, ct);
            if (sim == null) return NotFound(new { message = "SIM card not found." });
            if (sim.Status != SimCard.InStock || await _db.RegistrationApplications.AnyAsync(a => a.SimCardId == id, ct))
                return Conflict(new { message = "Only SIM cards still in stock and never issued can be removed." });
            _db.SimCards.Remove(sim);
            await _db.SaveChangesAsync(ct);
            return Ok(new { message = $"SIM {sim.Iccid} removed from stock." });
        }

        private async Task<bool> NotAdmin(Guid? userId, CancellationToken ct) =>
            userId is Guid uid && !await _db.Users.AnyAsync(u => u.Id == uid && u.Role == "Administrator", ct);

        private static SimCard NewSim(SimCardRules.Clean c, Guid? addedBy)
        {
            var now = DateTime.UtcNow;
            return new SimCard
            {
                SimCardId = Guid.NewGuid(),
                Iccid = c.Iccid,
                Phone = c.Phone,
                BatchReference = c.BatchReference,
                Status = SimCard.InStock,
                ReceivedAt = now,
                AddedBy = addedBy,
                CreatedAt = now,
                UpdatedAt = now,
            };
        }
    }
}
