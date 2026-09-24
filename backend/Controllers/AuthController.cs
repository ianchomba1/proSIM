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

            // Check if email already exists in administrators table
            var existingAdmin = await _context.Administrators.FirstOrDefaultAsync(a => a.Email.ToLower() == normalizedEmail);
            if (existingAdmin != null)
            {
                return BadRequest(new AuthResponseDto
                {
                    Success = false,
                    Message = "An account with this email already exists in administrators."
                });
            }

            // Check if email already exists in customers table
            var existingCustomer = await _context.Customers.FirstOrDefaultAsync(c => c.Email.ToLower() == normalizedEmail);
            if (existingCustomer != null)
            {
                return BadRequest(new AuthResponseDto
                {
                    Success = false,
                    Message = "An account with this email already exists in customers."
                });
            }

            // Hash password securely
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            string role = dto.Role?.Trim().ToLowerInvariant() == "administrator" ? "Administrator" : "Customer";

            if (role == "Administrator")
            {
                var admin = new Administrator
                {
                    FullName = dto.FullName.Trim(),
                    Email = normalizedEmail,
                    PasswordHash = passwordHash,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Administrators.Add(admin);
                await _context.SaveChangesAsync();

                return Ok(new AuthResponseDto
                {
                    Success = true,
                    Message = "Administrator account registered successfully in administrators table.",
                    User = new UserDto
                    {
                        Id = admin.Id,
                        FullName = admin.FullName,
                        Email = admin.Email,
                        Role = "Administrator",
                        CreatedAt = admin.CreatedAt
                    }
                });
            }
            else
            {
                var customer = new Customer
                {
                    FullName = dto.FullName.Trim(),
                    Email = normalizedEmail,
                    PasswordHash = passwordHash,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                return Ok(new AuthResponseDto
                {
                    Success = true,
                    Message = "Customer account registered successfully in customers table.",
                    User = new UserDto
                    {
                        Id = customer.Id,
                        FullName = customer.FullName,
                        Email = customer.Email,
                        Role = "Customer",
                        CreatedAt = customer.CreatedAt
                    }
                });
            }
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new AuthResponseDto { Success = false, Message = "Please enter email and password." });
            }

            var normalizedEmail = dto.Email.Trim().ToLowerInvariant();

            // 1. Search in administrators table
            var admin = await _context.Administrators.FirstOrDefaultAsync(a => a.Email.ToLower() == normalizedEmail);
            if (admin != null && BCrypt.Net.BCrypt.Verify(dto.Password, admin.PasswordHash))
            {
                return Ok(new AuthResponseDto
                {
                    Success = true,
                    Message = "Administrator authentication successful.",
                    User = new UserDto
                    {
                        Id = admin.Id,
                        FullName = admin.FullName,
                        Email = admin.Email,
                        Role = "Administrator",
                        CreatedAt = admin.CreatedAt
                    }
                });
            }

            // 2. Search in customers table
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Email.ToLower() == normalizedEmail);
            if (customer != null && BCrypt.Net.BCrypt.Verify(dto.Password, customer.PasswordHash))
            {
                return Ok(new AuthResponseDto
                {
                    Success = true,
                    Message = "Customer authentication successful.",
                    User = new UserDto
                    {
                        Id = customer.Id,
                        FullName = customer.FullName,
                        Email = customer.Email,
                        Role = "Customer",
                        CreatedAt = customer.CreatedAt
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
