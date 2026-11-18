using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>
    /// The staff list, maintained by administrators (one at a time or by CSV). Only listed employees can apply for a
    /// company SIM. <see cref="SimStatus"/> follows their SIM application: NotApplied -> Pending -> Approved / Rejected.
    /// When an application is approved the employee is registered in Subscribers and linked through SubscriberId.
    /// </summary>
    [Table("Employees")]
    public class Employee
    {
        public const string NotApplied = "NotApplied";
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";

        [Key]
        [Column("EmployeeId")]
        public Guid EmployeeId { get; set; } = Guid.NewGuid();

        [Required, MaxLength(100)]
        [Column("StaffNumber")]
        public string StaffNumber { get; set; } = string.Empty;

        [Required, MaxLength(150)]
        [Column("FullName")]
        public string FullName { get; set; } = string.Empty;

        /// <summary>Work email (lower case). Required for employees added by an administrator; kept for Google sign-in.</summary>
        [MaxLength(150)]
        [Column("Email")]
        public string? Email { get; set; }

        [Required, MaxLength(100)]
        [Column("Department")]
        public string Department { get; set; } = string.Empty;

        [MaxLength(50)]
        [Column("DateOfBirth")]
        public string? DateOfBirth { get; set; }

        [MaxLength(50)]
        [Column("Phone")]
        public string? Phone { get; set; }

        [MaxLength(20)]
        [Column("NationalIdNumber")]
        public string? NationalIdNumber { get; set; }

        /// <summary>NotApplied, Pending, Approved or Rejected.</summary>
        [Required, MaxLength(20)]
        [Column("SimStatus")]
        public string SimStatus { get; set; } = NotApplied;

        [Column("LatestApplicationId")]
        public Guid? LatestApplicationId { get; set; }

        [Column("SimStatusUpdatedAt")]
        public DateTime? SimStatusUpdatedAt { get; set; }

        /// <summary>Set when a SIM application is approved.</summary>
        [Column("SubscriberId")]
        public Guid? SubscriberId { get; set; }

        [Column("CreatedBy")]
        public Guid? CreatedBy { get; set; }

        [Column("CreatedAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("UpdatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("SubscriberId")]
        public Subscriber? Subscriber { get; set; }

        /// <summary>Records the outcome of an application on the employee.</summary>
        public void SetSimStatus(string status, Guid applicationId, DateTime at)
        {
            SimStatus = status;
            LatestApplicationId = applicationId;
            SimStatusUpdatedAt = at;
            UpdatedAt = at;
        }
    }
}
