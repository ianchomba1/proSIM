using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    [Table("SimCards")]
    public class SimCard
    {
        [Key]
        [Column("SimCardId")]
        public Guid SimCardId { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        [Column("Iccid")]
        public string Iccid { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("Phone")]
        public string Phone { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("Status")]
        public string Status { get; set; } = "Active";

        [MaxLength(50)]
        [Column("Carrier")]
        public string Carrier { get; set; } = "ProSIM Network";

        [Column("CreatedAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("UpdatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
