using System;
using System.ComponentModel.DataAnnotations;

namespace ProSim.Api.Dtos
{
    public class SubmitApplicationDto
    {
        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        public string InstitutionalId { get; set; } = string.Empty;

        public string? DateOfBirth { get; set; }

        [Required]
        public string Department { get; set; } = string.Empty;

        [Required]
        public string ContactPhone { get; set; } = string.Empty;

        public string? UserEmail { get; set; }

        public string? Iccid { get; set; }

        [Required]
        public string NationalIdNumber { get; set; } = string.Empty;

        // Issued by POST /api/verification/national-id after a successful OCR match.
        [Required]
        public string VerificationToken { get; set; } = string.Empty;
    }

    public class UpdateApplicationStatusDto
    {
        [Required]
        public string Status { get; set; } = "Approved";

        public string? Remarks { get; set; }

        public Guid? ReviewerUserId { get; set; }
    }

    public class ApplicationListItemDto
    {
        public Guid ApplicationId { get; set; }
        public Guid SubscriberId { get; set; }
        public Guid? SimCardId { get; set; }
        public string ApplicationStatus { get; set; } = "Pending";
        public DateTime SubmissionDate { get; set; }
        public DateTime? ReviewDate { get; set; }
        public Guid? ReviewedBy { get; set; }
        public string? Remarks { get; set; }

        public string FullName { get; set; } = string.Empty;
        public string InstitutionalId { get; set; } = string.Empty;
        public string? NationalIdNumber { get; set; }
        public DateTime? IdVerifiedAt { get; set; }
        public string Department { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;

        public string? Iccid { get; set; }
        public string? SimPhone { get; set; }
        public string? SimStatus { get; set; }

        public DateTime CreatedAt { get; set; }
    }

    public class ApplicationResponseDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public ApplicationListItemDto? Application { get; set; }
    }
}
