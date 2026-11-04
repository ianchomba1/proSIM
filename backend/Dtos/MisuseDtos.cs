using System.ComponentModel.DataAnnotations;

namespace ProSim.Api.Dtos
{
    public class MisuseRunRequestDto
    {
        /// <summary>First day to score (default: the latest day with usage data).</summary>
        public DateOnly? From { get; set; }
        /// <summary>Last day to score (default: same as From).</summary>
        public DateOnly? To { get; set; }
    }

    public class MisuseAlertDto
    {
        public Guid AlertId { get; set; }
        public string SimRef { get; set; } = string.Empty;
        public DateOnly AlertDate { get; set; }
        public string AlertLevel { get; set; } = string.Empty;
        public string MisuseType { get; set; } = string.Empty;
        public double? Confidence { get; set; }
        public double MisuseScore { get; set; }
        public double DataAnomalyScore { get; set; }
        public double CallAnomalyScore { get; set; }
        public List<string> FlaggedBy { get; set; } = new();
        public List<string> Signals { get; set; } = new();
        public string ModelVersion { get; set; } = string.Empty;
        public string Status { get; set; } = "Open";
        public string? ReviewedByName { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewNote { get; set; }
    }

    /// <summary>Consecutive alert days on one SIM (gaps of at most one day), reviewed as one case.</summary>
    public class MisuseCaseDto
    {
        public string SimRef { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public int AlertDays { get; set; }
        /// <summary>Highest alert level in the case (High > Alert > Review > Review (calls/SMS)).</summary>
        public string AlertLevel { get; set; } = string.Empty;
        public List<string> MisuseTypes { get; set; } = new();
        public double? MaxConfidence { get; set; }
        /// <summary>Signals of the case's most severe (then latest) day.</summary>
        public List<string> Signals { get; set; } = new();
        /// <summary>Open if any day is unreviewed; otherwise Confirmed if any day was confirmed, else FalseAlarm.</summary>
        public string Status { get; set; } = "Open";
        public List<Guid> AlertIds { get; set; } = new();
    }

    public class MisuseReviewDto
    {
        [Required, MinLength(1)]
        public List<Guid> AlertIds { get; set; } = new();
        /// <summary>Confirmed, FalseAlarm, or Open (to undo a review).</summary>
        [Required]
        public string Status { get; set; } = string.Empty;
        [MaxLength(1000)]
        public string? Note { get; set; }
        /// <summary>The administrator making the review (users.id).</summary>
        public Guid? ReviewerId { get; set; }
    }

    public class SimUsageDayDto
    {
        public DateOnly Date { get; set; }
        public double TotalMb { get; set; }
        public double OffpeakMb { get; set; }
        public int HotspotSessions { get; set; }
        public double BilledMb { get; set; }
        public int Calls { get; set; }
        public double CallMinutes { get; set; }
        public int Sms { get; set; }
    }

    public class SimMisuseDetailDto
    {
        public string SimRef { get; set; } = string.Empty;
        public string? Tier { get; set; }
        /// <summary>Subscriber linked through SimCards.Phone or SimCards.Iccid = SimRef, when there is one.</summary>
        public string? SubscriberName { get; set; }
        public string? Department { get; set; }
        public List<SimUsageDayDto> Usage { get; set; } = new();
        public List<MisuseAlertDto> Alerts { get; set; } = new();
    }
}
