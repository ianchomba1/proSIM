using Microsoft.EntityFrameworkCore;
using ProSim.Api.Data;
using ProSim.Api.Services;

// Command-line tools (run instead of the web server):
//   dotnet run -- import-cdr "<folder with the CDR generator's CSVs>" [--replace]
//   dotnet run -- score-misuse [from yyyy-MM-dd] [to yyyy-MM-dd]
string[]? tool = args.Length > 0 && args[0] is "import-cdr" or "score-misuse" ? args : null;

var builder = WebApplication.CreateBuilder(tool is null ? args : Array.Empty<string>());

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
    client.Timeout = TimeSpan.FromSeconds(120);
});
builder.Services.AddScoped<MisuseScoringService>();

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

-- Misuse detection: daily usage per SIM, calls/SMS, and alerts from the ML service
CREATE TABLE IF NOT EXISTS ""UsageDaily"" (
    ""SimRef"" VARCHAR(50) NOT NULL,
    ""Date"" DATE NOT NULL,
    ""Tier"" VARCHAR(30) NOT NULL,
    ""TotalDownloadMb"" DOUBLE PRECISION NOT NULL,
    ""TotalUploadMb"" DOUBLE PRECISION NOT NULL,
    ""TotalMb"" DOUBLE PRECISION NOT NULL,
    ""SessionCount"" INTEGER NOT NULL,
    ""DataSessionCount"" INTEGER NOT NULL,
    ""TotalDurationS"" DOUBLE PRECISION NOT NULL,
    ""MaxSessionMb"" DOUBLE PRECISION NOT NULL,
    ""HotspotFlagCount"" INTEGER NOT NULL,
    ""GeoFlagCount"" INTEGER NOT NULL,
    ""RoamingSessions"" INTEGER NOT NULL,
    ""UniqueTowers"" INTEGER NOT NULL,
    ""ApnPublicCount"" INTEGER NOT NULL,
    ""OffpeakSessionCount"" INTEGER NOT NULL,
    ""OffpeakMb"" DOUBLE PRECISION NOT NULL,
    ""BilledMb"" DOUBLE PRECISION NOT NULL,
    ""VoiceMinutesUsed"" DOUBLE PRECISION NOT NULL,
    ""SmsCount"" INTEGER NOT NULL,
    PRIMARY KEY (""SimRef"", ""Date"")
);
CREATE TABLE IF NOT EXISTS ""CallEvents"" (
    ""CallEventId"" BIGSERIAL PRIMARY KEY,
    ""SimRef"" VARCHAR(50) NOT NULL,
    ""Timestamp"" TIMESTAMP NOT NULL,
    ""DurationS"" INTEGER NOT NULL,
    ""EventType"" VARCHAR(10) NOT NULL,
    ""Destination"" VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS ix_callevents_sim_time ON ""CallEvents"" (""SimRef"", ""Timestamp"");
CREATE TABLE IF NOT EXISTS ""MisuseAlerts"" (
    ""AlertId"" UUID PRIMARY KEY,
    ""SimRef"" VARCHAR(50) NOT NULL,
    ""AlertDate"" DATE NOT NULL,
    ""AlertLevel"" VARCHAR(30) NOT NULL,
    ""MisuseType"" VARCHAR(50) NOT NULL,
    ""Confidence"" DOUBLE PRECISION,
    ""MisuseScore"" DOUBLE PRECISION NOT NULL,
    ""DataAnomalyScore"" DOUBLE PRECISION NOT NULL,
    ""CallAnomalyScore"" DOUBLE PRECISION NOT NULL,
    ""FlaggedBy"" TEXT NOT NULL,
    ""Signals"" TEXT NOT NULL,
    ""ModelVersion"" VARCHAR(50) NOT NULL,
    ""Status"" VARCHAR(20) NOT NULL DEFAULT 'Open',
    ""ReviewedBy"" UUID REFERENCES users (id),
    ""ReviewedAt"" TIMESTAMPTZ,
    ""ReviewNote"" TEXT,
    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
    ""UpdatedAt"" TIMESTAMPTZ NOT NULL,
    CONSTRAINT ux_misusealerts_sim_date UNIQUE (""SimRef"", ""AlertDate"")
);
CREATE INDEX IF NOT EXISTS ix_misusealerts_date ON ""MisuseAlerts"" (""AlertDate"");
CREATE INDEX IF NOT EXISTS ix_misusealerts_status ON ""MisuseAlerts"" (""Status"");
";
        dbContext.Database.ExecuteSqlRaw(createTablesSql);
        logger.LogInformation("Database verified: users, registration and misuse-detection tables are in place.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to connect to database or create tables.");
    }
}

if (tool is not null)
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    if (tool[0] == "import-cdr")
    {
        var folder = tool.Skip(1).FirstOrDefault(a => !a.StartsWith("--"));
        if (folder is null)
        {
            logger.LogError("Usage: dotnet run -- import-cdr \"<folder>\" [--replace]");
            return 1;
        }
        try
        {
            return await CdrImporter.RunAsync(connectionString, folder, tool.Contains("--replace"), logger);
        }
        catch (Npgsql.NpgsqlException ex)
        {
            logger.LogError("Database error: {Message}", ex.Message);
            return 1;
        }
    }

    // score-misuse [from] [to]
    var scoring = scope.ServiceProvider.GetRequiredService<MisuseScoringService>();
    try
    {
        var latest = await scoring.LatestUsageDateAsync();
        if (latest is null)
        {
            logger.LogError("No usage data. Run import-cdr first.");
            return 1;
        }
        var from = tool.Length > 1 ? DateOnly.Parse(tool[1]) : latest.Value;
        var to = tool.Length > 2 ? DateOnly.Parse(tool[2]) : (tool.Length > 1 ? latest.Value : from);
        var r = await scoring.RunAsync(from, to);
        logger.LogInformation("Scored {From}..{To}: {Sims} SIMs, {Days} SIM-days, {Saved} alerts ({Counts}), {Removed} removed, model {Model}, {Secs}s",
            r.From, r.To, r.Sims, r.DaysScored, r.AlertsSaved, string.Join(", ", r.AlertCounts.Select(kv => $"{kv.Key} {kv.Value}")),
            r.AlertsRemoved, r.ModelVersion, r.Seconds);
        return 0;
    }
    catch (MisuseScoringService.MlUnavailableException ex)
    {
        logger.LogError("{Message}", ex.Message);
        return 1;
    }
    catch (Exception ex) when (ex is Npgsql.NpgsqlException || ex.InnerException is Npgsql.NpgsqlException)
    {
        logger.LogError("Database error: {Message}", (ex.InnerException ?? ex).Message);
        return 1;
    }
}

app.UseCors("AllowReactApp");

app.UseAuthorization();

app.MapControllers();

app.Run();
return 0;
