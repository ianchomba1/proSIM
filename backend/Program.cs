using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Load the DB password from .NET user secrets however the app is started
// (by default they only load when ASPNETCORE_ENVIRONMENT=Development).
builder.Configuration.AddUserSecrets<Program>(optional: true);

// Configure PostgreSQL with EF Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is missing. Set it with: " +
        "dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"Host=localhost;Port=5432;Database=pro_sim;Username=postgres;Password=...\" " +
        "(run inside the backend folder).");
}
builder.Services.AddDbContext<ProSimDbContext>(options =>
    options.UseNpgsql(connectionString));

// Short-lived ID verification tokens (OCR step) are kept in memory.
builder.Services.AddMemoryCache();

// Python ML service (OCR + misuse detection)
builder.Services.AddHttpClient("MlService", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["MlService:BaseUrl"] ?? "http://127.0.0.1:8001");
    client.Timeout = TimeSpan.FromSeconds(60);
});

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

-- National ID captured and verified via OCR during SIM registration
ALTER TABLE IF EXISTS ""Subscribers"" ADD COLUMN IF NOT EXISTS ""NationalIdNumber"" VARCHAR(20);
ALTER TABLE IF EXISTS ""Subscribers"" ADD COLUMN IF NOT EXISTS ""IdVerifiedAt"" TIMESTAMPTZ;
";
        dbContext.Database.ExecuteSqlRaw(createTablesSql);
        logger.LogInformation("Database verified: 'users' table active. 'administrators' and 'customers' tables removed.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to connect to database or create tables.");
    }
}

app.UseCors("AllowReactApp");

app.UseAuthorization();

app.MapControllers();

app.Run();
