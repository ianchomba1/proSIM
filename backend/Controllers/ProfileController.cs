using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// The signed-in user's profile for the admin Dashboard: account details plus what they have done in the portal.
    /// NOTE: no authentication yet (login issues no token), so the user id comes from the client, same as the
    /// reviewer ids elsewhere. Add authentication before deploying beyond a local demo.
    /// </summary>
    [ApiController]
    [Route("api/profile")]
    public class ProfileController : ControllerBase
    {
        private readonly ProSimDbContext _db;

        public ProfileController(ProSimDbContext db) => _db = db;

        [HttpGet("{userId:guid}")]
        public async Task<IActionResult> Get(Guid userId, CancellationToken ct)
        {
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.Id, u.FullName, u.Email, u.Role, u.CreatedAt })
                .FirstOrDefaultAsync(ct);
            if (user is null) return NotFound(new { message = "User not found." });

            var decisions = await _db.RegistrationApplications.AsNoTracking()
                .Where(a => a.ReviewedBy == userId && (a.ApplicationStatus == "Approved" || a.ApplicationStatus == "Rejected"))
                .GroupBy(a => a.ApplicationStatus)
                .Select(g => new { Status = g.Key, Count = g.Count(), Last = g.Max(a => a.ReviewDate) })
                .ToListAsync(ct);

            var alertReviews = await _db.MisuseAlerts.AsNoTracking()
                .Where(a => a.ReviewedBy == userId)
                .GroupBy(a => a.Status)
                .Select(g => new { Status = g.Key, Count = g.Count(), Last = g.Max(a => a.ReviewedAt) })
                .ToListAsync(ct);

            var simsAdded = await _db.SimCards.CountAsync(s => s.AddedBy == userId, ct);
            var employeesAdded = await _db.Employees.CountAsync(e => e.CreatedBy == userId, ct);

            var lastActivity = decisions.Select(d => d.Last).Concat(alertReviews.Select(a => a.Last))
                .Where(d => d != null).Max();

            return Ok(new
            {
                userId = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role,
                memberSince = user.CreatedAt,
                activity = new
                {
                    applicationsApproved = decisions.Where(d => d.Status == "Approved").Sum(d => d.Count),
                    applicationsRejected = decisions.Where(d => d.Status == "Rejected").Sum(d => d.Count),
                    alertsConfirmed = alertReviews.Where(a => a.Status == "Confirmed").Sum(a => a.Count),
                    alertsFalseAlarm = alertReviews.Where(a => a.Status == "FalseAlarm").Sum(a => a.Count),
                    simsAdded,
                    employeesAdded,
                    lastReviewAt = lastActivity,
                },
            });
        }
    }
}
