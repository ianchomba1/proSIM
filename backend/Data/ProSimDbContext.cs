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
<<<<<<< HEAD
=======
        public DbSet<Administrator> Administrators { get; set; } = null!;
        public DbSet<Customer> Customers { get; set; } = null!;
>>>>>>> 5daa5c18e442db842dc573b9a27a0c8d56286fc6

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
<<<<<<< HEAD
=======
            {
                entity.HasIndex(u => u.Email).IsUnique();
            });

            modelBuilder.Entity<Administrator>(entity =>
>>>>>>> 5daa5c18e442db842dc573b9a27a0c8d56286fc6
            {
                entity.HasIndex(u => u.Email).IsUnique();
            });
        }
    }
}
