using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProSim.Api.Data;
using ProSim.Api.Dtos;
using ProSim.Api.Models;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// SIM applications.
    ///   POST /api/applications               customer applies (after National ID verification): the staff number must
    ///                                         be on the staff list (Employees); saved as Pending and the employee is
    ///                                         marked Pending. Nothing else is created yet
    ///   GET  /api/applications?status=...     list for the admin dashboard
    ///   POST /api/applications/{id}/approve   admin approves: a SIM card is issued from stock (the ICCID given,
    ///                                         else the oldest in stock) and the applicant is registered in Subscribers
    ///   POST /api/applications/{id}/reject    admin rejects, with a reason
    /// NOTE: the API has no authentication yet, so approve/reject are not restricted to administrators by a token;
    /// a reviewer id, when given, must belong to an Administrator account.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ApplicationsController : ControllerBase
    {

        private readonly ProSimDbContext _context;
        private readonly IMemoryCache _cache;

        public ApplicationsController(ProSimDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllApplications([FromQuery] string? status)
        {
            var query = _context.RegistrationApplications.AsNoTracking()
                .Include(a => a.Subscriber)
                .Include(a => a.SimCard)
                .Include(a => a.Reviewer)
                .AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(a => a.ApplicationStatus == status);

            var applications = await query.OrderByDescending(a => a.SubmissionDate).ToListAsync();
            return Ok(applications.Select(ToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetApplicationById(Guid id)
        {
            var app = await _context.RegistrationApplications.AsNoTracking()
                .Include(a => a.Subscriber)
                .Include(a => a.SimCard)
                .Include(a => a.Reviewer)
                .FirstOrDefaultAsync(a => a.ApplicationId == id);
            return app == null ? NotFound(new { message = "Application not found." }) : Ok(ToDto(app));
        }

        [HttpPost]
        public async Task<IActionResult> SubmitApplication([FromBody] SubmitApplicationDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // The National ID must have passed OCR verification, and the submitted
            // details must be the same ones that were verified.
            var tokenKey = VerificationController.TokenKey(dto.VerificationToken ?? string.Empty);
            if (!_cache.TryGetValue(tokenKey, out VerificationController.VerifiedIdentity? verified) || verified == null)
            {
                return BadRequest(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "National ID verification is missing or has expired. Please verify your ID again."
                });
            }
            if (verified.FullName != VerificationController.Normalise(dto.FullName)
                || verified.NationalIdNumber != VerificationController.Digits(dto.NationalIdNumber)
                || verified.DateOfBirth != (dto.DateOfBirth ?? string.Empty).Trim())
            {
                return BadRequest(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "Your details changed after ID verification. Please verify your ID again."
                });
            }

            // Only employees on the staff list (added by an administrator) can apply.
            var staffKey = dto.InstitutionalId.Trim().ToLower();
            var employee = await _context.Employees.FirstOrDefaultAsync(e => e.StaffNumber.ToLower() == staffKey);
            if (employee == null)
            {
                return BadRequest(new ApplicationResponseDto
                {
                    Success = false,
                    Message = $"Staff number {dto.InstitutionalId.Trim()} is not on the staff list. Ask your administrator to add you, then apply again."
                });
            }
            if (employee.NationalIdNumber != null && employee.NationalIdNumber != verified.NationalIdNumber)
            {
                return BadRequest(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "Your National ID number does not match the staff record for this staff number. Contact your administrator."
                });
            }
            if (await _context.Employees.AnyAsync(e => e.EmployeeId != employee.EmployeeId && e.NationalIdNumber == verified.NationalIdNumber))
            {
                return BadRequest(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "Your National ID number is registered to a different staff number. Contact your administrator."
                });
            }
            if (employee.SimStatus == Employee.Approved)
            {
                return Conflict(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "You have already been issued a company SIM card."
                });
            }

            // One open application per person.
            var alreadyPending = employee.SimStatus == Employee.Pending || await _context.RegistrationApplications.AnyAsync(a =>
                a.ApplicationStatus == "Pending" && a.ApplicantNationalIdNumber == verified.NationalIdNumber);
            if (alreadyPending)
            {
                return Conflict(new ApplicationResponseDto
                {
                    Success = false,
                    Message = "You already have a SIM application awaiting approval."
                });
            }

            Guid? linkedUserId = null;
            if (!string.IsNullOrWhiteSpace(dto.UserEmail))
            {
                var email = dto.UserEmail.Trim().ToLower();
                linkedUserId = await _context.Users.Where(u => u.Email.ToLower() == email)
                    .Select(u => (Guid?)u.Id).FirstOrDefaultAsync();
            }

            // Only the application is saved. The Subscriber and SimCard are created when an administrator approves it.
            var now = DateTime.UtcNow;
            var application = new RegistrationApplication
            {
                ApplicationId = Guid.NewGuid(),
                ApplicationStatus = "Pending",
                SubmissionDate = now,
                EmployeeId = employee.EmployeeId,
                ApplicantUserId = linkedUserId,
                ApplicantFullName = dto.FullName.Trim(),
                ApplicantInstitutionalId = dto.InstitutionalId.Trim(),
                ApplicantNationalIdNumber = verified.NationalIdNumber,
                ApplicantIdVerifiedAt = verified.VerifiedAt,
                ApplicantDateOfBirth = dto.DateOfBirth?.Trim(),
                ApplicantDepartment = dto.Department.Trim(),
                ApplicantContactPhone = dto.ContactPhone.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.RegistrationApplications.Add(application);
            employee.SetSimStatus(Employee.Pending, application.ApplicationId, now);   // the staff list shows "Pending"
            await _context.SaveChangesAsync();

            // One verification = one application.
            _cache.Remove(tokenKey);

            return Ok(new ApplicationResponseDto
            {
                Success = true,
                Message = "Application submitted. An administrator will review it and issue your SIM card.",
                Application = ToDto(application)
            });
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveApplicationDto dto)
        {
            var app = await _context.RegistrationApplications
                .Include(a => a.Subscriber)
                .Include(a => a.SimCard)
                .FirstOrDefaultAsync(a => a.ApplicationId == id);
            if (app == null) return NotFound(new { message = "Application not found." });
            if (app.ApplicationStatus != "Pending")
                return Conflict(new { message = $"This application is already {app.ApplicationStatus.ToLower()}." });
            if (await InvalidReviewer(dto.ReviewerUserId))
                return BadRequest(new { message = "Reviewer must be an administrator account." });

            var now = DateTime.UtcNow;

            // 1. SIM card, issued from stock: the one the administrator picked (by ICCID), otherwise the SIM that has
            //    been in stock longest. Applications made before approval existed already have one: activate it.
            SimCard? sim;
            if (app.SimCard != null)
            {
                sim = app.SimCard;
            }
            else if (!string.IsNullOrWhiteSpace(dto.Iccid))
            {
                var iccid = dto.Iccid.Trim().ToUpperInvariant();
                sim = await _context.SimCards.FirstOrDefaultAsync(s => s.Iccid.ToUpper() == iccid);
                if (sim == null)
                    return BadRequest(new { message = $"No SIM card with ICCID {iccid} is recorded. Add it on the SIM Cards page first." });
                if (sim.Status != SimCard.InStock)
                    return Conflict(new { message = $"SIM {sim.Iccid} is not in stock (it is {sim.Status.ToLower()})." });
            }
            else
            {
                sim = await _context.SimCards.Where(s => s.Status == SimCard.InStock)
                    .OrderBy(s => s.ReceivedAt ?? s.CreatedAt).ThenBy(s => s.Iccid).FirstOrDefaultAsync();
                if (sim == null)
                    return Conflict(new { message = "There are no SIM cards in stock. Add the SIMs received from the operator on the SIM Cards page, then approve." });
            }
            sim.Status = SimCard.Active;
            sim.UpdatedAt = now;

            // 2. The applicant's staff-list entry (linked at submission; older applications are matched by staff number).
            var employee = await FindEmployeeAsync(app);
            if (employee != null && employee.NationalIdNumber != null && app.ApplicantNationalIdNumber != null
                && employee.NationalIdNumber != app.ApplicantNationalIdNumber)
                return Conflict(new
                {
                    message = $"Staff number {employee.StaffNumber} belongs to {employee.FullName}, whose National ID number " +
                              "differs from the one verified on this application. Check the applicant before approving.",
                });

            // 3. Subscriber: the applicant is registered now. An existing subscriber record (already linked, the
            //    employee's, or one with the same National ID) is reused.
            var subscriber = app.Subscriber;
            if (subscriber == null && employee?.SubscriberId is Guid sid)
                subscriber = await _context.Subscribers.FindAsync(sid);
            if (subscriber == null && !string.IsNullOrEmpty(app.ApplicantNationalIdNumber))
                subscriber = await _context.Subscribers.FirstOrDefaultAsync(s => s.NationalIdNumber == app.ApplicantNationalIdNumber);
            if (subscriber == null)
            {
                subscriber = new Subscriber
                {
                    SubscriberId = Guid.NewGuid(),
                    UserId = app.ApplicantUserId,
                    FullName = app.ApplicantFullName ?? employee?.FullName ?? string.Empty,
                    InstitutionalId = employee?.StaffNumber ?? app.ApplicantInstitutionalId ?? string.Empty,
                    Email = employee?.Email,
                    NationalIdNumber = app.ApplicantNationalIdNumber,
                    IdVerifiedAt = app.ApplicantIdVerifiedAt,
                    DateOfBirth = app.ApplicantDateOfBirth ?? employee?.DateOfBirth,
                    Department = employee?.Department ?? app.ApplicantDepartment ?? string.Empty,
                    ContactPhone = app.ApplicantContactPhone ?? employee?.Phone ?? string.Empty,
                    CreatedAt = now
                };
                _context.Subscribers.Add(subscriber);
            }
            else
            {
                subscriber.NationalIdNumber ??= app.ApplicantNationalIdNumber;
                subscriber.IdVerifiedAt ??= app.ApplicantIdVerifiedAt;
                subscriber.DateOfBirth ??= app.ApplicantDateOfBirth;
                subscriber.UserId ??= app.ApplicantUserId;
                if (employee?.Email != null && subscriber.Email == null
                    && !await _context.Subscribers.AnyAsync(s => s.Email == employee.Email && s.SubscriberId != subscriber.SubscriberId))
                    subscriber.Email = employee.Email;
                if (string.IsNullOrEmpty(subscriber.ContactPhone)) subscriber.ContactPhone = app.ApplicantContactPhone ?? string.Empty;
            }
            subscriber.UpdatedAt = now;

            // 4. The staff list shows the employee as Approved, linked to their subscriber record.
            if (employee != null)
            {
                employee.SubscriberId = subscriber.SubscriberId;
                employee.NationalIdNumber ??= app.ApplicantNationalIdNumber;
                if (string.IsNullOrEmpty(employee.Phone) && !string.IsNullOrEmpty(app.ApplicantContactPhone))
                    employee.Phone = Services.EmployeeRules.NormaliseMsisdn(app.ApplicantContactPhone) ?? app.ApplicantContactPhone;
                employee.SetSimStatus(Employee.Approved, app.ApplicationId, now);
                app.EmployeeId = employee.EmployeeId;
            }

            // 5. The application records the outcome and links both.
            app.SubscriberId = subscriber.SubscriberId;
            app.SimCardId = sim.SimCardId;
            app.ApplicationStatus = "Approved";
            app.ReviewDate = now;
            app.ReviewedBy = dto.ReviewerUserId;
            app.Remarks = string.IsNullOrWhiteSpace(dto.Remarks) ? null : dto.Remarks.Trim();
            app.UpdatedAt = now;

            await _context.SaveChangesAsync();   // one transaction: SIM card, subscriber and application together

            var saved = await _context.RegistrationApplications.AsNoTracking()
                .Include(a => a.Subscriber).Include(a => a.SimCard).Include(a => a.Reviewer)
                .FirstAsync(a => a.ApplicationId == id);
            return Ok(new ApplicationResponseDto
            {
                Success = true,
                Message = $"Approved. SIM {sim.Iccid} ({sim.Phone}) issued to {subscriber.FullName}.",
                Application = ToDto(saved)
            });
        }

        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] RejectApplicationDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Give a reason for rejecting the application (at least 3 characters)." });

            var app = await _context.RegistrationApplications.Include(a => a.SimCard)
                .FirstOrDefaultAsync(a => a.ApplicationId == id);
            if (app == null) return NotFound(new { message = "Application not found." });
            if (app.ApplicationStatus != "Pending")
                return Conflict(new { message = $"This application is already {app.ApplicationStatus.ToLower()}." });
            if (await InvalidReviewer(dto.ReviewerUserId))
                return BadRequest(new { message = "Reviewer must be an administrator account." });

            var now = DateTime.UtcNow;
            // Applications made before approval existed were given a SIM at submission: take it out of service.
            if (app.SimCard != null)
            {
                app.SimCard.Status = "Deactivated";
                app.SimCard.UpdatedAt = now;
            }
            app.ApplicationStatus = "Rejected";
            app.ReviewDate = now;
            app.ReviewedBy = dto.ReviewerUserId;
            app.Remarks = dto.Remarks.Trim();
            app.UpdatedAt = now;

            // The staff list shows "Rejected" (unless the employee already holds an approved SIM).
            var employee = await FindEmployeeAsync(app);
            if (employee != null)
            {
                app.EmployeeId = employee.EmployeeId;
                if (employee.SimStatus != Employee.Approved)
                    employee.SetSimStatus(Employee.Rejected, app.ApplicationId, now);
            }
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Application rejected." });
        }

        // ---- helpers ----

        /// <summary>The applicant's staff-list entry: the one linked at submission, else matched by staff number.</summary>
        private async Task<Employee?> FindEmployeeAsync(RegistrationApplication app)
        {
            if (app.EmployeeId is Guid eid)
                return await _context.Employees.FindAsync(eid);
            if (string.IsNullOrWhiteSpace(app.ApplicantInstitutionalId))
                return null;
            var staffKey = app.ApplicantInstitutionalId.Trim().ToLower();
            return await _context.Employees.FirstOrDefaultAsync(e => e.StaffNumber.ToLower() == staffKey);
        }

        private async Task<bool> InvalidReviewer(Guid? reviewerId) =>
            reviewerId is Guid rid && !await _context.Users.AnyAsync(u => u.Id == rid && u.Role == "Administrator");

        private static ApplicationListItemDto ToDto(RegistrationApplication a) => new()
        {
            ApplicationId = a.ApplicationId,
            SubscriberId = a.SubscriberId,
            SimCardId = a.SimCardId,
            ApplicationStatus = a.ApplicationStatus,
            SubmissionDate = a.SubmissionDate,
            ReviewDate = a.ReviewDate,
            ReviewedBy = a.ReviewedBy,
            ReviewedByName = a.Reviewer?.FullName,
            Remarks = a.Remarks,
            FullName = a.ApplicantFullName ?? a.Subscriber?.FullName ?? string.Empty,
            InstitutionalId = a.ApplicantInstitutionalId ?? a.Subscriber?.InstitutionalId ?? string.Empty,
            NationalIdNumber = a.ApplicantNationalIdNumber ?? a.Subscriber?.NationalIdNumber,
            IdVerifiedAt = a.ApplicantIdVerifiedAt ?? a.Subscriber?.IdVerifiedAt,
            DateOfBirth = a.ApplicantDateOfBirth ?? a.Subscriber?.DateOfBirth,
            Department = a.ApplicantDepartment ?? a.Subscriber?.Department ?? string.Empty,
            ContactPhone = a.ApplicantContactPhone ?? a.Subscriber?.ContactPhone ?? string.Empty,
            Iccid = a.SimCard?.Iccid,
            SimPhone = a.SimCard?.Phone,
            SimStatus = a.SimCard?.Status,
            CreatedAt = a.CreatedAt
        };
    }
}
