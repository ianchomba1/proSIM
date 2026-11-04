using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>
    /// One SIM's usage on one day, aggregated from its CDRs. These are the inputs the misuse
    /// models need (same columns as the CDR generator's synthetic_cdr_daily_agg.csv).
    /// Primary key: (SimRef, Date), configured in ProSimDbContext.
    /// </summary>
    [Table("UsageDaily")]
    public class UsageDaily
    {
        /// <summary>The SIM's identifier in the CDR feed (e.g. MSISDN, ICCID, or SIM-0087 for synthetic data).</summary>
        [MaxLength(50)] public string SimRef { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        [MaxLength(30)] public string Tier { get; set; } = string.Empty;

        public double TotalDownloadMb { get; set; }
        public double TotalUploadMb { get; set; }
        public double TotalMb { get; set; }
        public int SessionCount { get; set; }
        public int DataSessionCount { get; set; }
        public double TotalDurationS { get; set; }
        public double MaxSessionMb { get; set; }
        public int HotspotFlagCount { get; set; }
        public int GeoFlagCount { get; set; }
        public int RoamingSessions { get; set; }
        public int UniqueTowers { get; set; }
        public int ApnPublicCount { get; set; }
        public int OffpeakSessionCount { get; set; }
        public double OffpeakMb { get; set; }
        public double BilledMb { get; set; }
        public double VoiceMinutesUsed { get; set; }
        public int SmsCount { get; set; }
    }
}
