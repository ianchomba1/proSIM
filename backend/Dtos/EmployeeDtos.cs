using System;

namespace ProSim.Api.Dtos
{
    /// <summary>An employee (Subscriber) added by an administrator. Validation is done in EmployeeRules.</summary>
    public class AddEmployeeDto
    {
        public string? FullName { get; set; }
        public string? StaffNumber { get; set; }
        public string? Email { get; set; }
        public string? Department { get; set; }
        /// <summary>yyyy-MM-dd (dd/MM/yyyy is also accepted).</summary>
        public string? DateOfBirth { get; set; }
        public string? Phone { get; set; }
        public string? NationalIdNumber { get; set; }
        /// <summary>The administrator adding the employee (users.id).</summary>
        public Guid? AddedBy { get; set; }
    }

    public class EmployeeDto
    {
        public Guid EmployeeId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string StaffNumber { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string Department { get; set; } = string.Empty;
        public string? DateOfBirth { get; set; }
        public string? Phone { get; set; }
        public string? NationalIdNumber { get; set; }
        /// <summary>SIM application status: NotApplied, Pending, Approved or Rejected.</summary>
        public string SimStatus { get; set; } = "NotApplied";
        public DateTime? SimStatusUpdatedAt { get; set; }
        /// <summary>Set once approved: the subscriber record and the SIM issued.</summary>
        public Guid? SubscriberId { get; set; }
        public DateTime? IdVerifiedAt { get; set; }
        public string? SimPhone { get; set; }
        public string? SimCardStatus { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class EmployeeImportSkip
    {
        public int Line { get; set; }
        public string StaffNumber { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }
}
