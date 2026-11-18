using Microsoft.EntityFrameworkCore;
using ProSim.Api.Models;

namespace ProSim.Api.Data
{
    public class ProSimDbContext : DbContext
    {
        public ProSimDbContext(DbContextOptions<ProSimDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Subscriber> Subscribers { get; set; } = null!;
        public DbSet<SimCard> SimCards { get; set; } = null!;
        public DbSet<RegistrationApplication> RegistrationApplications { get; set; } = null!;

        // Misuse detection
        public DbSet<UsageDaily> UsageDaily { get; set; } = null!;
        public DbSet<CallEvent> CallEvents { get; set; } = null!;
        public DbSet<MisuseAlert> MisuseAlerts { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Email).IsUnique();
            });

            modelBuilder.Entity<UsageDaily>(entity =>
            {
                entity.HasKey(u => new { u.SimRef, u.Date });
            });

            modelBuilder.Entity<CallEvent>(entity =>
            {
                entity.Property(e => e.Timestamp).HasColumnType("timestamp without time zone");
                entity.HasIndex(e => new { e.SimRef, e.Timestamp });
            });

            modelBuilder.Entity<MisuseAlert>(entity =>
            {
                entity.HasIndex(a => new { a.SimRef, a.AlertDate }).IsUnique();
                entity.HasIndex(a => a.AlertDate);
                entity.HasIndex(a => a.Status);
            });
        }
    }
}
