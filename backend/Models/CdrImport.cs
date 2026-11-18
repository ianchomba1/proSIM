using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>One upload of CDR files by an administrator (import history / audit trail).</summary>
    [Table("CdrImports")]
    public class CdrImport
    {
        [Key] public Guid ImportId { get; set; } = Guid.NewGuid();
        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
        public Guid? ImportedBy { get; set; }
        /// <summary>Merge or Replace.</summary>
        [MaxLength(20)] public string Mode { get; set; } = "Merge";
        [MaxLength(255)] public string DailyFileName { get; set; } = string.Empty;
        [MaxLength(255)] public string EventsFileName { get; set; } = string.Empty;
        public long SimDays { get; set; }
        public long SimDaysAdded { get; set; }
        public long SimDaysUpdated { get; set; }
        public long Events { get; set; }
        public long EventsSkipped { get; set; }
        public int Sims { get; set; }
        public DateOnly DateFrom { get; set; }
        public DateOnly DateTo { get; set; }
        /// <summary>JSON array of warnings shown to the administrator.</summary>
        public string Warnings { get; set; } = "[]";
        /// <summary>Alerts saved when the imported days were scored straight after the import (null if not scored).</summary>
        public int? AlertsSaved { get; set; }

        [ForeignKey("ImportedBy")] public User? Importer { get; set; }
    }
}
