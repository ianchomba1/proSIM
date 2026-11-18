using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Dtos;
using ProSim.Api.Models;
using ProSim.Api.Services;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// The staff list (Employees), maintained by administrators. Only listed employees can apply for a company SIM.
    ///   GET  /api/employees           all employees, with their SIM application status and the SIM issued (if any)
    ///   POST /api/employees           add one employee
    ///   POST /api/employees/import    multipart: file (CSV), addedBy. All rows are checked first; if any row has a
    ///                                 problem nothing is saved. Rows whose staff number is already listed are skipped.
    /// Required: full name, staff number, email, department, date of birth. Optional: phone, National ID number.
    /// Each employee's SimStatus (NotApplied, Pending, Approved, Rejected) is updated by ApplicationsController.
    /// NOTE: like the other admin endpoints this is not yet protected by authentication; addedBy, when given,
    /// must belong to an Administrator account.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private const long MaxCsvBytes = 5L * 1024 * 1024;
        private const int MaxRows = 10_000;
        private const int MaxErrors = 25;

        private readonly ProSimDbContext _db;
        private readonly ILogger<EmployeesController> _logger;

        public EmployeesController(ProSimDbContext db, ILogger<EmployeesController> logger)
        {
            _db = db;
            _logger = logger;
        }

        private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));   // Nairobi date

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct)
        {
            var employees = await _db.Employees.AsNoTracking().Include(e => e.Subscriber)
                .OrderBy(e => e.FullName).ToListAsync(ct);
            // SIM issued through an approved application (latest approval wins).
            var sims = (await _db.RegistrationApplications.AsNoTracking()
                    .Where(a => a.ApplicationStatus == "Approved" && a.SubscriberId != null && a.SimCardId != null)
                    .Select(a => new { a.SubscriberId, a.ReviewDate, a.SimCard!.Phone, a.SimCard.Status })
                    .ToListAsync(ct))
                .GroupBy(a => a.SubscriberId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(a => a.ReviewDate).First());
            return Ok(employees.Select(e =>
            {
                var sim = e.SubscriberId is Guid sid && sims.TryGetValue(sid, out var s) ? s : null;
                return ToDto(e, sim?.Phone, sim?.Status);
            }));
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddEmployeeDto dto, CancellationToken ct)
        {
            if (await NotAdmin(dto.AddedBy, ct))
                return BadRequest(new { message = "Employees must be added by an administrator account." });

            var (clean, errors) = EmployeeRules.Validate(dto, Today);
            if (clean == null)
                return BadRequest(new { message = Capitalise(string.Join("; ", errors)) + "." });

            var staffKey = clean.StaffNumber.ToLower();
            var taken = await _db.Employees.AsNoTracking()
                .Where(e => e.StaffNumber.ToLower() == staffKey || (e.Email != null && e.Email.ToLower() == clean.Email)
                            || (clean.NationalIdNumber != null && e.NationalIdNumber == clean.NationalIdNumber))
                .Select(e => new { e.FullName, e.StaffNumber, e.Email, e.NationalIdNumber })
                .FirstOrDefaultAsync(ct);
            if (taken != null)
            {
                var what = taken.StaffNumber.ToLower() == staffKey ? $"staff number {clean.StaffNumber}"
                    : taken.Email?.ToLower() == clean.Email ? $"the email {clean.Email}" : $"National ID number {clean.NationalIdNumber}";
                return Conflict(new { message = $"{taken.FullName} is already on the staff list with {what}." });
            }

            var employee = NewEmployee(clean, dto.AddedBy);
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Employee {Staff} added", employee.StaffNumber);
            return Ok(new { message = $"{employee.FullName} ({employee.StaffNumber}) added to the staff list.", employee = ToDto(employee, null, null) });
        }

        [HttpPost("import")]
        [RequestSizeLimit(MaxCsvBytes + 64 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxCsvBytes + 64 * 1024)]
        public async Task<IActionResult> Import([FromForm] IFormFile? file, [FromForm] Guid? addedBy = null, CancellationToken ct = default)
        {
            if (file is null || file.Length == 0) return BadRequest(new { message = "Choose a CSV file of employees." });
            if (!Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "The file must be a .csv file. In Excel use File > Save As > CSV UTF-8." });
            if (file.Length > MaxCsvBytes) return BadRequest(new { message = "The file is larger than 5 MB." });
            if (await NotAdmin(addedBy, ct))
                return BadRequest(new { message = "Employees must be imported by an administrator account." });

            List<(int line, List<string> fields)> records;
            using (var reader = new StreamReader(file.OpenReadStream()))
                records = EmployeeRules.ReadCsv(reader).Take(MaxRows + 2).ToList();
            if (records.Count == 0) return BadRequest(new { message = "The file is empty." });
            if (records.Count > MaxRows + 1) return BadRequest(new { message = $"The file has more than {MaxRows:N0} rows; split it into smaller files." });

            // Header -> column index
            var columns = new Dictionary<string, int>();
            var header = records[0].fields;
            for (var i = 0; i < header.Count; i++)
                if (EmployeeRules.HeaderAliases.TryGetValue(EmployeeRules.HeaderKey(header[i]), out var field) && !columns.ContainsKey(field))
                    columns[field] = i;
            var missing = EmployeeRules.RequiredFields.Where(f => !columns.ContainsKey(f)).Select(f => EmployeeRules.FieldLabels[f]).ToList();
            if (missing.Count > 0)
                return BadRequest(new
                {
                    message = "The file was not imported. Nothing was changed.",
                    errors = new[] { $"Missing column(s): {string.Join(", ", missing)}. Download the template to see the expected columns." },
                });
            if (records.Count == 1) return BadRequest(new { message = "The file has a header row but no employees." });

            string Get(List<string> f, string field) => columns.TryGetValue(field, out var i) && i < f.Count ? f[i] : string.Empty;

            // Everyone already listed, for duplicate checks (staff number and email, case-insensitive)
            var existing = await _db.Employees.AsNoTracking()
                .Select(e => new { e.StaffNumber, e.Email, e.NationalIdNumber, e.FullName }).ToListAsync(ct);
            var staffInDb = existing.GroupBy(e => e.StaffNumber.ToLower()).ToDictionary(g => g.Key, g => g.First().FullName);
            var emailInDb = existing.Where(e => e.Email != null).GroupBy(e => e.Email!.ToLower()).ToDictionary(g => g.Key, g => g.First().StaffNumber);
            var nidInDb = existing.Where(e => e.NationalIdNumber != null).GroupBy(e => e.NationalIdNumber!).ToDictionary(g => g.Key, g => g.First().StaffNumber);

            var errors = new List<string>();
            var skipped = new List<EmployeeImportSkip>();
            var toAdd = new List<EmployeeRules.Clean>();
            var staffInFile = new Dictionary<string, int>();
            var emailInFile = new Dictionary<string, int>();
            var nidInFile = new Dictionary<string, int>();
            var today = Today;
            var problemRows = 0;

            foreach (var (line, f) in records.Skip(1))
            {
                var dto = new AddEmployeeDto
                {
                    FullName = Get(f, "fullName"), StaffNumber = Get(f, "staffNumber"), Email = Get(f, "email"),
                    Department = Get(f, "department"), DateOfBirth = Get(f, "dateOfBirth"),
                    Phone = Get(f, "phone"), NationalIdNumber = Get(f, "nationalId"),
                };
                var (clean, rowErrors) = EmployeeRules.Validate(dto, today);
                if (clean != null)
                {
                    var staffKey = clean.StaffNumber.ToLower();
                    if (staffInDb.ContainsKey(staffKey))
                    {
                        skipped.Add(new EmployeeImportSkip { Line = line, StaffNumber = clean.StaffNumber, Reason = $"already listed ({staffInDb[staffKey]})" });
                        continue;
                    }
                    if (staffInFile.TryGetValue(staffKey, out var l1)) rowErrors.Add($"staff number {clean.StaffNumber} is also on line {l1}");
                    if (emailInDb.TryGetValue(clean.Email, out var s1)) rowErrors.Add($"email {clean.Email} already belongs to staff number {s1}");
                    else if (emailInFile.TryGetValue(clean.Email, out var l2)) rowErrors.Add($"email {clean.Email} is also on line {l2}");
                    if (clean.NationalIdNumber is string nid)
                    {
                        if (nidInDb.TryGetValue(nid, out var s2)) rowErrors.Add($"National ID number {nid} already belongs to staff number {s2}");
                        else if (nidInFile.TryGetValue(nid, out var l3)) rowErrors.Add($"National ID number {nid} is also on line {l3}");
                        else nidInFile[nid] = line;
                    }
                    staffInFile.TryAdd(staffKey, line);
                    emailInFile.TryAdd(clean.Email, line);
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

            _db.Employees.AddRange(toAdd.Select(c => NewEmployee(c, addedBy)));
            await _db.SaveChangesAsync(ct);   // one transaction: all rows or none
            _logger.LogInformation("Employee import {File}: {Added} added, {Skipped} skipped", file.FileName, toAdd.Count, skipped.Count);

            var msg = toAdd.Count == 0
                ? "No new employees: every staff number in the file is already on the staff list."
                : $"{toAdd.Count:N0} employee(s) added" + (skipped.Count > 0 ? $", {skipped.Count:N0} skipped (already listed)." : ".");
            return Ok(new { message = msg, added = toAdd.Count, skipped });
        }

        // ---- helpers ----

        private async Task<bool> NotAdmin(Guid? userId, CancellationToken ct) =>
            userId is Guid uid && !await _db.Users.AnyAsync(u => u.Id == uid && u.Role == "Administrator", ct);

        private static Employee NewEmployee(EmployeeRules.Clean c, Guid? addedBy)
        {
            var now = DateTime.UtcNow;
            return new Employee
            {
                EmployeeId = Guid.NewGuid(),
                StaffNumber = c.StaffNumber,
                FullName = c.FullName,
                Email = c.Email,
                Department = c.Department,
                DateOfBirth = c.DateOfBirth,
                Phone = c.Phone,
                NationalIdNumber = c.NationalIdNumber,
                SimStatus = Employee.NotApplied,
                CreatedBy = addedBy,
                CreatedAt = now,
                UpdatedAt = now,
            };
        }

        private static string Capitalise(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..];

        private static EmployeeDto ToDto(Employee e, string? simPhone, string? simCardStatus) => new()
        {
            EmployeeId = e.EmployeeId,
            FullName = e.FullName,
            StaffNumber = e.StaffNumber,
            Email = e.Email,
            Department = e.Department,
            DateOfBirth = e.DateOfBirth,
            Phone = e.Phone,
            NationalIdNumber = e.NationalIdNumber,
            SimStatus = e.SimStatus,
            SimStatusUpdatedAt = e.SimStatusUpdatedAt,
            SubscriberId = e.SubscriberId,
            IdVerifiedAt = e.Subscriber?.IdVerifiedAt,
            SimPhone = simPhone,
            SimCardStatus = simCardStatus,
            CreatedAt = e.CreatedAt,
        };
    }
}
