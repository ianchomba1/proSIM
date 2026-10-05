using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Dtos;
using ProSim.Api.Models;
using BCrypt.Net;

namespace ProSim.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ProSimDbContext _context;

        public AuthController(ProSimDbContext context)
        {
            _context = context;
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new AuthResponseDto { Success = false, Message = "Invalid input fields." });
            }

            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            // Check if email already exists in users table
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            if (existingUser != null)
            {
                return BadRequest(new AuthResponseDto
                {
                    Success = false,
                    Message = "An account with this email already exists."
                });
            }

            // Hash password securely
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            string role = dto.Role?.Trim().ToLowerInvariant() == "administrator" ? "Administrator" : "Customer";

            var user = new User
            {
                FullName = dto.FullName.Trim(),
                Email = normalizedEmail,
                PasswordHash = passwordHash,
                Role = role,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new AuthResponseDto
            {
                Success = true,
                Message = $"Account registered successfully in users table as {role}.",
                User = new UserDto
                {
                    Id = user.Id,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role,
                    CreatedAt = user.CreatedAt
                }
            });
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new AuthResponseDto { Success = false, Message = "Please enter email and password." });
            }

            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            // Search in users table
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            if (user != null && BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                return Ok(new AuthResponseDto
                {
                    Success = true,
                    Message = "Authentication successful.",
                    User = new UserDto
                    {
                        Id = user.Id,
                        FullName = user.FullName,
                        Email = user.Email,
                        Role = user.Role,
                        CreatedAt = user.CreatedAt
                    }
                });
            }

            return Unauthorized(new AuthResponseDto
            {
                Success = false,
                Message = "Invalid email or password credentials."
            });
        }
    }
}
