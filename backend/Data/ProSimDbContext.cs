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
        public DbSet<Administrator> Administrators { get; set; } = null!;
        public DbSet<Customer> Customers { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Email).IsUnique();
            });

            modelBuilder.Entity<Administrator>(entity =>
            {
                entity.HasIndex(a => a.Email).IsUnique();
            });

            modelBuilder.Entity<Customer>(entity =>
            {
                entity.HasIndex(c => c.Email).IsUnique();
            });
        }
    }
}
