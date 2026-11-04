using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>
    /// A misuse alert for one SIM on one day, from the ML service (/misuse/score), plus the operator's review.
    /// At most one per (SimRef, AlertDate): rescoring updates it and keeps the review.
    /// </summary>
    [Table("MisuseAlerts")]
    public class MisuseAlert
    {
        [Key] public Guid AlertId { get; set; } = Guid.NewGuid();
        [MaxLength(50)] public string SimRef { get; set; } = string.Empty;
        public DateOnly AlertDate { get; set; }

        /// <summary>High, Alert, Review or "Review (calls/SMS)".</summary>
        [MaxLength(30)] public string AlertLevel { get; set; } = string.Empty;
        /// <summary>Random Forest misuse type, or "unusual data use" / "unusual calling/SMS" for Review levels.</summary>
        [MaxLength(50)] public string MisuseType { get; set; } = string.Empty;
        public double? Confidence { get; set; }
        public double MisuseScore { get; set; }
        public double DataAnomalyScore { get; set; }
        public double CallAnomalyScore { get; set; }
        /// <summary>JSON array of the models that raised the alert.</summary>
        public string FlaggedBy { get; set; } = "[]";
        /// <summary>JSON array of plain-language signals for the operator.</summary>
        public string Signals { get; set; } = "[]";
        [MaxLength(50)] public string ModelVersion { get; set; } = string.Empty;

        /// <summary>Open, Confirmed or FalseAlarm.</summary>
        [MaxLength(20)] public string Status { get; set; } = "Open";
        public Guid? ReviewedBy { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ReviewedBy")] public User? Reviewer { get; set; }
    }
}
