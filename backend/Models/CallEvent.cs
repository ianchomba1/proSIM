using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>One voice call or SMS from the CDR feed (data sessions are summarised in UsageDaily instead).</summary>
    [Table("CallEvents")]
    public class CallEvent
    {
        [Key] public long CallEventId { get; set; }
        [MaxLength(50)] public string SimRef { get; set; } = string.Empty;
        /// <summary>Local time of the call/SMS (stored without time zone).</summary>
        public DateTime Timestamp { get; set; }
        /// <summary>Seconds; 0 for SMS.</summary>
        public int DurationS { get; set; }
        /// <summary>"Voice" or "SMS".</summary>
        [MaxLength(10)] public string EventType { get; set; } = string.Empty;
        [MaxLength(30)] public string? Destination { get; set; }
    }
}
