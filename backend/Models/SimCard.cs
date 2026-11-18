using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProSim.Api.Models
{
    /// <summary>
    /// A SIM card from the telecom operator. Administrators add received SIMs as stock (InStock); approving an
    /// application issues one from stock to the employee (Active). Suspended / Deactivated take it out of service.
    /// </summary>
    [Table("SimCards")]
    public class SimCard
    {
        public const string InStock = "InStock";
        public const string Active = "Active";
        public const string Suspended = "Suspended";
        public const string Deactivated = "Deactivated";

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

        /// <summary>InStock, Active (issued), Suspended or Deactivated.</summary>
        [Required]
        [MaxLength(50)]
        [Column("Status")]
        public string Status { get; set; } = InStock;

        [MaxLength(50)]
        [Column("Carrier")]
        public string Carrier { get; set; } = "ProSIM Network";

        /// <summary>The operator's delivery note or order number the SIM arrived with.</summary>
        [MaxLength(100)]
        [Column("BatchReference")]
        public string? BatchReference { get; set; }

        /// <summary>When the SIM was added to stock.</summary>
        [Column("ReceivedAt")]
        public DateTime? ReceivedAt { get; set; }

        /// <summary>The administrator who added it (users.id).</summary>
        [Column("AddedBy")]
        public Guid? AddedBy { get; set; }

        [Column("CreatedAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("UpdatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
