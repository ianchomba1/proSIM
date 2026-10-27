using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    [Table("RegistrationApplications")]
    public class RegistrationApplication
    {
        [Key]
        [Column("ApplicationId")]
        public Guid ApplicationId { get; set; } = Guid.NewGuid();

        [Required]
        [Column("SubscriberId")]
        public Guid SubscriberId { get; set; }

        [Column("SimCardId")]
        public Guid? SimCardId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("ApplicationStatus")]
        public string ApplicationStatus { get; set; } = "Pending";

        [Column("SubmissionDate")]
        public DateTime SubmissionDate { get; set; } = DateTime.UtcNow;

        [Column("ReviewDate")]
        public DateTime? ReviewDate { get; set; }

        [Column("ReviewedBy")]
        public Guid? ReviewedBy { get; set; }

        [Column("Remarks")]
        public string? Remarks { get; set; }

        [Column("CreatedAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("UpdatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("SubscriberId")]
        public Subscriber? Subscriber { get; set; }

        [ForeignKey("SimCardId")]
        public SimCard? SimCard { get; set; }

        [ForeignKey("ReviewedBy")]
        public User? Reviewer { get; set; }
    }
}
