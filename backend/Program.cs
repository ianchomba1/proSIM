using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure PostgreSQL with EF Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ProSimDbContext>(options =>
    options.UseNpgsql(connectionString));

// CORS policy for React Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
              {
                  var uri = new Uri(origin);
                  return uri.Host == "localhost" || uri.Host == "127.0.0.1";
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

<<<<<<< HEAD
// Ensure PostgreSQL tables are created
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ProSimDbContext>();
        const string createTablesSql = @"
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Customer',
    created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (LOWER(email));

-- Migrate and drop old administrators table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'administrators') THEN
        INSERT INTO users (id, full_name, email, password_hash, role, created_at)
        SELECT id, full_name, email, password_hash, 'Administrator', created_at
        FROM administrators
        ON CONFLICT DO NOTHING;
        DROP TABLE administrators CASCADE;
    END IF;
END $$;

-- Migrate and drop old customers table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        INSERT INTO users (id, full_name, email, password_hash, role, created_at)
        SELECT id, full_name, email, password_hash, 'Customer', created_at
        FROM customers
        ON CONFLICT DO NOTHING;
        DROP TABLE customers CASCADE;
    END IF;
END $$;
";
        dbContext.Database.ExecuteSqlRaw(createTablesSql);
        logger.LogInformation("Database verified: 'users' table active. 'administrators' and 'customers' tables removed.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to connect to database or create tables.");
    }
=======
// Ensure PostgreSQL database and tables exist
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ProSimDbContext>();
    dbContext.Database.EnsureCreated();
>>>>>>> 5daa5c18e442db842dc573b9a27a0c8d56286fc6
}

app.UseCors("AllowReactApp");

app.UseAuthorization();

app.MapControllers();

app.Run();
