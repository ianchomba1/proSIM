using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    [Table("Subscribers")]
    public class Subscriber
    {
        [Key]
        [Column("SubscriberId")]
        public Guid SubscriberId { get; set; } = Guid.NewGuid();

        [Column("UserId")]
        public Guid? UserId { get; set; }

        [Required]
        [MaxLength(150)]
        [Column("FullName")]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        [Column("InstitutionalId")]
        public string InstitutionalId { get; set; } = string.Empty;

        [MaxLength(20)]
        [Column("NationalIdNumber")]
        public string? NationalIdNumber { get; set; }

        [Column("IdVerifiedAt")]
        public DateTime? IdVerifiedAt { get; set; }

        [MaxLength(50)]
        [Column("DateOfBirth")]
        public string? DateOfBirth { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("Department")]
        public string Department { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("ContactPhone")]
        public string ContactPhone { get; set; } = string.Empty;

        [Column("CreatedAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("UpdatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}
