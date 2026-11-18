using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Models;
using ProSim.Api.Services;

namespace ProSim.Api.Controllers
{
    /// <summary>
    /// Admin upload of CDR files (daily usage + calls/SMS) for misuse detection, and the import history.
    ///   POST /api/misuse/import    multipart: dailyFile, eventsFile, mode (merge|replace), scoreAfter, importedBy
    ///   GET  /api/misuse/imports   previous imports, newest first
    /// NOTE: like the other admin endpoints this is not yet protected by authentication.
    /// </summary>
    [ApiController]
    [Route("api/misuse")]
    public class CdrImportsController : ControllerBase
    {
        private const long MaxUploadBytes = 300L * 1024 * 1024;   // both files together

        private readonly ProSimDbContext _db;
        private readonly MisuseScoringService _scoring;
        private readonly ILogger<CdrImportsController> _logger;

        public CdrImportsController(ProSimDbContext db, MisuseScoringService scoring, ILogger<CdrImportsController> logger)
        {
            _db = db;
            _scoring = scoring;
            _logger = logger;
        }

        public record ImportDto(Guid ImportId, DateTime ImportedAt, string? ImportedByName, string Mode, string DailyFileName,
            string EventsFileName, long SimDays, long SimDaysAdded, long SimDaysUpdated, long Events, long EventsSkipped,
            int Sims, DateOnly DateFrom, DateOnly DateTo, List<string> Warnings, int? AlertsSaved);

        [HttpPost("import")]
        [RequestSizeLimit(MaxUploadBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
        public async Task<IActionResult> Import([FromForm] IFormFile? dailyFile, [FromForm] IFormFile? eventsFile,
            [FromForm] string mode = "merge", [FromForm] bool scoreAfter = true, [FromForm] Guid? importedBy = null,
            CancellationToken ct = default)
        {
            if (dailyFile is null || dailyFile.Length == 0 || eventsFile is null || eventsFile.Length == 0)
                return BadRequest(new { message = "Choose both files: the daily usage CSV and the calls/SMS CSV." });
            if (!IsCsv(dailyFile) || !IsCsv(eventsFile))
                return BadRequest(new { message = "Both files must be .csv files." });
            var importMode = mode.Trim().ToLowerInvariant() switch
            {
                "merge" => CdrImporter.ImportMode.Merge,
                "replace" => CdrImporter.ImportMode.Replace,
                _ => (CdrImporter.ImportMode?)null,
            };
            if (importMode is null) return BadRequest(new { message = "Mode must be 'merge' or 'replace'." });
            if (importedBy is Guid uid && !await _db.Users.AnyAsync(u => u.Id == uid && u.Role == "Administrator", ct))
                return BadRequest(new { message = "Imports must be made by an administrator account." });

            CdrImporter.ImportResult result;
            try
            {
                using var daily = new StreamReader(dailyFile.OpenReadStream());
                using var events = new StreamReader(eventsFile.OpenReadStream());
                result = await CdrImporter.ImportAsync(_db.Database.GetConnectionString()!, daily, events, importMode.Value, ct);
            }
            catch (CdrImporter.ImportException ex)
            {
                return BadRequest(new { message = "The files were not imported. Nothing was changed.", errors = ex.Errors });
            }

            var record = new CdrImport
            {
                ImportedBy = importedBy,
                Mode = importMode.Value.ToString(),
                DailyFileName = Path.GetFileName(dailyFile.FileName),
                EventsFileName = Path.GetFileName(eventsFile.FileName),
                SimDays = result.SimDays,
                SimDaysAdded = result.SimDaysAdded,
                SimDaysUpdated = result.SimDaysUpdated,
                Events = result.Events,
                EventsSkipped = result.EventsSkipped,
                Sims = result.Sims,
                DateFrom = result.From,
                DateTo = result.To,
                Warnings = JsonSerializer.Serialize(result.Warnings),
            };
            _db.CdrImports.Add(record);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("CDR import {Mode}: {Days} SIM-days, {Events} calls/SMS, {From}..{To}",
                record.Mode, record.SimDays, record.Events, record.DateFrom, record.DateTo);

            // Score the imported days so their alerts appear straight away.
            MisuseScoringService.RunResult? scoring = null;
            string? scoringError = null;
            if (scoreAfter)
            {
                if (result.To.DayNumber - result.From.DayNumber > 366)
                {
                    scoringError = "The import covers more than a year; score it in parts from Misuse Alerts.";
                }
                else
                {
                    try
                    {
                        scoring = await _scoring.RunAsync(result.From, result.To, ct);
                        record.AlertsSaved = scoring.AlertsSaved;
                        await _db.SaveChangesAsync(ct);
                    }
                    catch (MisuseScoringService.MlUnavailableException ex)
                    {
                        scoringError = $"The data was imported, but scoring failed: {ex.Message}";
                    }
                }
            }

            return Ok(new { import = ToDto(record, null), scoring, scoringError });
        }

        [HttpGet("imports")]
        public async Task<IActionResult> Imports([FromQuery] int limit = 20, CancellationToken ct = default)
        {
            var rows = await _db.CdrImports.AsNoTracking().Include(i => i.Importer)
                .OrderByDescending(i => i.ImportedAt).Take(Math.Clamp(limit, 1, 100)).ToListAsync(ct);
            return Ok(rows.Select(r => ToDto(r, r.Importer?.FullName)));
        }

        private static bool IsCsv(IFormFile f) => Path.GetExtension(f.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase);

        private static ImportDto ToDto(CdrImport r, string? importer) => new(
            r.ImportId, r.ImportedAt, importer, r.Mode, r.DailyFileName, r.EventsFileName, r.SimDays, r.SimDaysAdded,
            r.SimDaysUpdated, r.Events, r.EventsSkipped, r.Sims, r.DateFrom, r.DateTo,
            JsonSerializer.Deserialize<List<string>>(r.Warnings) ?? new(), r.AlertsSaved);
    }
}
