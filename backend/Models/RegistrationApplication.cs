using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>
    /// A customer's SIM application. While Pending it holds the applicant's (OCR-verified) details itself;
    /// only when an administrator approves it are a Subscriber and a SimCard created and linked.
    /// </summary>
    [Table("RegistrationApplications")]
    public class RegistrationApplication
    {
        [Key]
        [Column("ApplicationId")]
        public Guid ApplicationId { get; set; } = Guid.NewGuid();

        /// <summary>Set when the application is approved (older applications were linked at submission).</summary>
        [Column("SubscriberId")]
        public Guid? SubscriberId { get; set; }

        /// <summary>Set when the application is approved and the SIM card is issued.</summary>
        [Column("SimCardId")]
        public Guid? SimCardId { get; set; }

        /// <summary>Pending, Approved or Rejected.</summary>
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

        /// <summary>The staff-list entry of the applicant (matched on staff number at submission).</summary>
        [Column("EmployeeId")]
        public Guid? EmployeeId { get; set; }

        // ---- Applicant details, captured at submission (after National ID verification) ----

        [Column("ApplicantUserId")]
        public Guid? ApplicantUserId { get; set; }

        [MaxLength(150)]
        [Column("ApplicantFullName")]
        public string? ApplicantFullName { get; set; }

        [MaxLength(100)]
        [Column("ApplicantInstitutionalId")]
        public string? ApplicantInstitutionalId { get; set; }

        [MaxLength(20)]
        [Column("ApplicantNationalIdNumber")]
        public string? ApplicantNationalIdNumber { get; set; }

        [Column("ApplicantIdVerifiedAt")]
        public DateTime? ApplicantIdVerifiedAt { get; set; }

        [MaxLength(50)]
        [Column("ApplicantDateOfBirth")]
        public string? ApplicantDateOfBirth { get; set; }

        [MaxLength(100)]
        [Column("ApplicantDepartment")]
        public string? ApplicantDepartment { get; set; }

        [MaxLength(50)]
        [Column("ApplicantContactPhone")]
        public string? ApplicantContactPhone { get; set; }

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
