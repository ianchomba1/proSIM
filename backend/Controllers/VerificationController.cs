using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// OCR verification of a Kenyan National ID during SIM registration.
    /// The photo is forwarded to the Python ML service, which reads the card and
    /// compares it with the typed details. On a full match a short-lived token is
    /// issued; ApplicationsController refuses to save an application without it.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class VerificationController : ControllerBase
    {
        private const long MaxImageBytes = 8 * 1024 * 1024;
        private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(15);

        private readonly IHttpClientFactory _httpFactory;
        private readonly IMemoryCache _cache;
        private readonly ILogger<VerificationController> _logger;

        public VerificationController(IHttpClientFactory httpFactory, IMemoryCache cache, ILogger<VerificationController> logger)
        {
            _httpFactory = httpFactory;
            _cache = cache;
            _logger = logger;
        }

        [HttpPost("national-id")]
        [RequestSizeLimit(MaxImageBytes + 64 * 1024)]
        public async Task<IActionResult> VerifyNationalId(
            [FromForm] IFormFile image,
            [FromForm] string fullName,
            [FromForm] string nationalIdNumber,
            [FromForm] string dateOfBirth)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { message = "Please upload a photo of your National ID." });
            if (image.Length > MaxImageBytes)
                return BadRequest(new { message = "Image is larger than 8 MB." });
            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(nationalIdNumber) || string.IsNullOrWhiteSpace(dateOfBirth))
                return BadRequest(new { message = "Full name, National ID number and date of birth are required." });

            using var form = new MultipartFormDataContent();
            await using var stream = image.OpenReadStream();
            var fileContent = new StreamContent(stream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(image.ContentType ?? "image/jpeg");
            form.Add(fileContent, "image", image.FileName);
            form.Add(new StringContent(fullName), "full_name");
            form.Add(new StringContent(nationalIdNumber), "id_number");
            form.Add(new StringContent(dateOfBirth), "date_of_birth");

            HttpResponseMessage response;
            try
            {
                var client = _httpFactory.CreateClient("MlService");
                response = await client.PostAsync("/ocr/kenyan-id/verify", form);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OCR service unreachable");
                return StatusCode(503, new { message = "ID verification service is unavailable. Please try again shortly." });
            }

            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                var detail = TryGetDetail(body) ?? "Could not read the ID image.";
                return StatusCode((int)response.StatusCode >= 500 ? 502 : 400, new { message = detail });
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var verified = root.GetProperty("verified").GetBoolean();

            string? token = null;
            if (verified)
            {
                token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
                _cache.Set(TokenKey(token), new VerifiedIdentity(
                    Normalise(fullName), Digits(nationalIdNumber), dateOfBirth.Trim(), DateTime.UtcNow),
                    TokenLifetime);
            }

            return Ok(new
            {
                verified,
                verificationToken = token,
                // Clone: the JsonDocument is disposed before the response is serialised.
                checks = root.GetProperty("checks").Clone(),
                extracted = root.GetProperty("extracted").Clone(),
                ocrQuality = root.GetProperty("ocr_quality").GetString(),
                warnings = root.GetProperty("warnings").Clone()
            });
        }

        // ---- helpers shared with ApplicationsController ----

        public record VerifiedIdentity(string FullName, string NationalIdNumber, string DateOfBirth, DateTime VerifiedAt);

        public static string TokenKey(string token) => $"idverify:{token}";

        public static string Normalise(string name) =>
            Regex.Replace(name.Trim().ToUpperInvariant(), @"\s+", " ");

        public static string Digits(string value) => Regex.Replace(value ?? string.Empty, @"\D", "");

        private static string? TryGetDetail(string body)
        {
            try
            {
                using var d = JsonDocument.Parse(body);
                return d.RootElement.TryGetProperty("detail", out var detail) ? detail.ToString() : null;
            }
            catch { return null; }
        }
    }
}
