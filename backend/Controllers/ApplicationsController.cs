using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProSim.Api.Data;
using ProSim.Api.Dtos;
using ProSim.Api.Models;

namespace ProSim.Api.Controllers
{
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
        public async Task<IActionResult> GetAllApplications()
        {
            try
            {
                var applications = await _context.RegistrationApplications
                    .Include(a => a.Subscriber)
                    .Include(a => a.SimCard)
                    .OrderByDescending(a => a.SubmissionDate)
                    .Select(a => new ApplicationListItemDto
                    {
                        ApplicationId = a.ApplicationId,
                        SubscriberId = a.SubscriberId,
                        SimCardId = a.SimCardId,
                        ApplicationStatus = a.ApplicationStatus,
                        SubmissionDate = a.SubmissionDate,
                        ReviewDate = a.ReviewDate,
                        ReviewedBy = a.ReviewedBy,
                        Remarks = a.Remarks,
                        FullName = a.Subscriber != null ? a.Subscriber.FullName : string.Empty,
                        InstitutionalId = a.Subscriber != null ? a.Subscriber.InstitutionalId : string.Empty,
                        NationalIdNumber = a.Subscriber != null ? a.Subscriber.NationalIdNumber : null,
                        IdVerifiedAt = a.Subscriber != null ? a.Subscriber.IdVerifiedAt : null,
                        Department = a.Subscriber != null ? a.Subscriber.Department : string.Empty,
                        ContactPhone = a.Subscriber != null ? a.Subscriber.ContactPhone : string.Empty,
                        Iccid = a.SimCard != null ? a.SimCard.Iccid : null,
                        SimPhone = a.SimCard != null ? a.SimCard.Phone : null,
                        SimStatus = a.SimCard != null ? a.SimCard.Status : null,
                        CreatedAt = a.CreatedAt
                    })
                    .ToListAsync();

                return Ok(applications);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching applications: " + ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetApplicationById(Guid id)
        {
            try
            {
                var app = await _context.RegistrationApplications
                    .Include(a => a.Subscriber)
                    .Include(a => a.SimCard)
                    .FirstOrDefaultAsync(a => a.ApplicationId == id);

                if (app == null)
                {
                    return NotFound(new { message = "Application not found." });
                }

                var item = new ApplicationListItemDto
                {
                    ApplicationId = app.ApplicationId,
                    SubscriberId = app.SubscriberId,
                    SimCardId = app.SimCardId,
                    ApplicationStatus = app.ApplicationStatus,
                    SubmissionDate = app.SubmissionDate,
                    ReviewDate = app.ReviewDate,
                    ReviewedBy = app.ReviewedBy,
                    Remarks = app.Remarks,
                    FullName = app.Subscriber?.FullName ?? string.Empty,
                    InstitutionalId = app.Subscriber?.InstitutionalId ?? string.Empty,
                    NationalIdNumber = app.Subscriber?.NationalIdNumber,
                    IdVerifiedAt = app.Subscriber?.IdVerifiedAt,
                    Department = app.Subscriber?.Department ?? string.Empty,
                    ContactPhone = app.Subscriber?.ContactPhone ?? string.Empty,
                    Iccid = app.SimCard?.Iccid,
                    SimPhone = app.SimCard?.Phone,
                    SimStatus = app.SimCard?.Status,
                    CreatedAt = app.CreatedAt
                };

                return Ok(item);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching application: " + ex.Message });
            }
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

            try
            {
                // Find user if email is provided
                Guid? linkedUserId = null;
                if (!string.IsNullOrWhiteSpace(dto.UserEmail))
                {
                    var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.UserEmail.ToLower().Trim());
                    if (user != null)
                    {
                        linkedUserId = user.Id;
                    }
                }

                // 1. Create Subscriber record
                var subscriber = new Subscriber
                {
                    SubscriberId = Guid.NewGuid(),
                    UserId = linkedUserId,
                    FullName = dto.FullName.Trim(),
                    InstitutionalId = dto.InstitutionalId.Trim(),
                    NationalIdNumber = verified.NationalIdNumber,
                    IdVerifiedAt = verified.VerifiedAt,
                    DateOfBirth = dto.DateOfBirth?.Trim(),
                    Department = dto.Department.Trim(),
                    ContactPhone = dto.ContactPhone.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Subscribers.Add(subscriber);

                // 2. Create SimCard record
                var randomDigits = new Random().NextInt64(1000000000L, 9999999999L);
                var iccid = !string.IsNullOrWhiteSpace(dto.Iccid) ? dto.Iccid.Trim() : $"8925400{randomDigits}";
                var simCard = new SimCard
                {
                    SimCardId = Guid.NewGuid(),
                    Iccid = iccid,
                    Phone = dto.ContactPhone.Trim(),
                    Status = "Active",
                    Carrier = "ProSIM Network",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SimCards.Add(simCard);

                // 3. Create RegistrationApplication (Remarks left null/empty per user specification)
                var application = new RegistrationApplication
                {
                    ApplicationId = Guid.NewGuid(),
                    SubscriberId = subscriber.SubscriberId,
                    SimCardId = simCard.SimCardId,
                    ApplicationStatus = "Pending",
                    SubmissionDate = DateTime.UtcNow,
                    ReviewDate = null,
                    ReviewedBy = null,
                    Remarks = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.RegistrationApplications.Add(application);

                await _context.SaveChangesAsync();

                // One verification = one application.
                _cache.Remove(tokenKey);

                var responseItem = new ApplicationListItemDto
                {
                    ApplicationId = application.ApplicationId,
                    SubscriberId = subscriber.SubscriberId,
                    SimCardId = simCard.SimCardId,
                    ApplicationStatus = application.ApplicationStatus,
                    SubmissionDate = application.SubmissionDate,
                    FullName = subscriber.FullName,
                    InstitutionalId = subscriber.InstitutionalId,
                    NationalIdNumber = subscriber.NationalIdNumber,
                    IdVerifiedAt = subscriber.IdVerifiedAt,
                    Department = subscriber.Department,
                    ContactPhone = subscriber.ContactPhone,
                    Iccid = simCard.Iccid,
                    SimPhone = simCard.Phone,
                    SimStatus = simCard.Status,
                    CreatedAt = application.CreatedAt
                };

                return Ok(new ApplicationResponseDto
                {
                    Success = true,
                    Message = "Registration application submitted successfully.",
                    Application = responseItem
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApplicationResponseDto
                {
                    Success = false,
                    Message = "Failed to submit application: " + ex.Message
                });
            }
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateApplicationStatusDto dto)
        {
            try
            {
                var app = await _context.RegistrationApplications.FindAsync(id);
                if (app == null)
                {
                    return NotFound(new { message = "Application not found." });
                }

                app.ApplicationStatus = dto.Status;
                app.ReviewDate = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(dto.Remarks))
                {
                    app.Remarks = dto.Remarks;
                }
                if (dto.ReviewerUserId.HasValue)
                {
                    app.ReviewedBy = dto.ReviewerUserId.Value;
                }
                app.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Application status updated to {dto.Status}." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating application status: " + ex.Message });
            }
        }
    }
}
