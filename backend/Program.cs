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
        // Local dev sites, plus the hosted frontend's address(es) from Cors:AllowedOrigins
        // (comma-separated; on Azure set the environment variable Cors__AllowedOrigins).
        var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(o => o.TrimEnd('/'))
            .ToArray();

        policy.SetIsOriginAllowed(origin =>
              {
                  var uri = new Uri(origin);
                  return uri.Host == "localhost" || uri.Host == "127.0.0.1"
                      || allowedOrigins.Contains(origin.TrimEnd('/'), StringComparer.OrdinalIgnoreCase);
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

-- Employees added by an administrator (one at a time or from a CSV) carry a work email; one employee per email.
ALTER TABLE IF EXISTS ""Subscribers"" ADD COLUMN IF NOT EXISTS ""Email"" VARCHAR(150);
DO $$
BEGIN
    IF to_regclass('""Subscribers""') IS NOT NULL THEN
        CREATE UNIQUE INDEX IF NOT EXISTS ix_subscribers_email ON ""Subscribers"" (LOWER(""Email"")) WHERE ""Email"" IS NOT NULL;
    END IF;
END $$;

-- SIM applications hold the applicant's details until an administrator approves them;
-- the Subscriber and SimCard are only created on approval, so SubscriberId may be empty.
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantUserId"" UUID;
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantFullName"" VARCHAR(150);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantInstitutionalId"" VARCHAR(100);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantNationalIdNumber"" VARCHAR(20);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantIdVerifiedAt"" TIMESTAMPTZ;
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantDateOfBirth"" VARCHAR(50);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantDepartment"" VARCHAR(100);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""ApplicantContactPhone"" VARCHAR(50);
ALTER TABLE IF EXISTS ""RegistrationApplications"" ALTER COLUMN ""SubscriberId"" DROP NOT NULL;
-- Applications made before this change were linked to a Subscriber at submission: copy their details across.
UPDATE ""RegistrationApplications"" ra SET
    ""ApplicantUserId"" = s.""UserId"",
    ""ApplicantFullName"" = s.""FullName"",
    ""ApplicantInstitutionalId"" = s.""InstitutionalId"",
    ""ApplicantNationalIdNumber"" = s.""NationalIdNumber"",
    ""ApplicantIdVerifiedAt"" = s.""IdVerifiedAt"",
    ""ApplicantDateOfBirth"" = s.""DateOfBirth"",
    ""ApplicantDepartment"" = s.""Department"",
    ""ApplicantContactPhone"" = s.""ContactPhone""
FROM ""Subscribers"" s
WHERE ra.""SubscriberId"" = s.""SubscriberId"" AND ra.""ApplicantFullName"" IS NULL;

-- Staff list maintained by administrators. Only listed employees can apply for a company SIM; SimStatus follows
-- their application (NotApplied, Pending, Approved, Rejected). Approved employees are linked to Subscribers.
CREATE TABLE IF NOT EXISTS ""Employees"" (
    ""EmployeeId"" UUID PRIMARY KEY,
    ""StaffNumber"" VARCHAR(100) NOT NULL,
    ""FullName"" VARCHAR(150) NOT NULL,
    ""Email"" VARCHAR(150),
    ""Department"" VARCHAR(100) NOT NULL,
    ""DateOfBirth"" VARCHAR(50),
    ""Phone"" VARCHAR(50),
    ""NationalIdNumber"" VARCHAR(20),
    ""SimStatus"" VARCHAR(20) NOT NULL DEFAULT 'NotApplied',
    ""LatestApplicationId"" UUID,
    ""SimStatusUpdatedAt"" TIMESTAMPTZ,
    ""SubscriberId"" UUID,
    ""CreatedBy"" UUID REFERENCES users (id) ON DELETE SET NULL,
    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now(),
    ""UpdatedAt"" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_staff_number ON ""Employees"" (LOWER(""StaffNumber""));
CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_email ON ""Employees"" (LOWER(""Email"")) WHERE ""Email"" IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_employees_sim_status ON ""Employees"" (""SimStatus"");
ALTER TABLE IF EXISTS ""RegistrationApplications"" ADD COLUMN IF NOT EXISTS ""EmployeeId"" UUID;

DO $$
BEGIN
    IF to_regclass('""Subscribers""') IS NULL OR to_regclass('""RegistrationApplications""') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_subscriber') THEN
        ALTER TABLE ""Employees"" ADD CONSTRAINT fk_employees_subscriber
            FOREIGN KEY (""SubscriberId"") REFERENCES ""Subscribers"" (""SubscriberId"") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_applications_employee') THEN
        ALTER TABLE ""RegistrationApplications"" ADD CONSTRAINT fk_applications_employee
            FOREIGN KEY (""EmployeeId"") REFERENCES ""Employees"" (""EmployeeId"") ON DELETE SET NULL;
    END IF;

    -- One-time move to the staff list: everyone already in Subscribers ...
    INSERT INTO ""Employees"" (""EmployeeId"", ""StaffNumber"", ""FullName"", ""Email"", ""Department"", ""DateOfBirth"",
                              ""Phone"", ""NationalIdNumber"", ""CreatedAt"", ""UpdatedAt"")
    SELECT DISTINCT ON (LOWER(TRIM(s.""InstitutionalId"")))
           gen_random_uuid(), TRIM(s.""InstitutionalId""), s.""FullName"", s.""Email"",
           COALESCE(NULLIF(TRIM(s.""Department""), ''), 'Unknown'), s.""DateOfBirth"", NULLIF(s.""ContactPhone"", ''),
           s.""NationalIdNumber"", s.""CreatedAt"", now()
    FROM ""Subscribers"" s
    WHERE TRIM(s.""InstitutionalId"") <> ''
      AND NOT EXISTS (SELECT 1 FROM ""Employees"" e WHERE LOWER(e.""StaffNumber"") = LOWER(TRIM(s.""InstitutionalId"")))
    ORDER BY LOWER(TRIM(s.""InstitutionalId"")), s.""CreatedAt"";

    -- ... and applicants not in Subscribers yet (pending applications under the new flow).
    INSERT INTO ""Employees"" (""EmployeeId"", ""StaffNumber"", ""FullName"", ""Department"", ""DateOfBirth"",
                              ""Phone"", ""NationalIdNumber"", ""CreatedAt"", ""UpdatedAt"")
    SELECT DISTINCT ON (LOWER(TRIM(a.""ApplicantInstitutionalId"")))
           gen_random_uuid(), TRIM(a.""ApplicantInstitutionalId""), a.""ApplicantFullName"",
           COALESCE(NULLIF(TRIM(a.""ApplicantDepartment""), ''), 'Unknown'), a.""ApplicantDateOfBirth"",
           NULLIF(a.""ApplicantContactPhone"", ''), a.""ApplicantNationalIdNumber"", a.""SubmissionDate"", now()
    FROM ""RegistrationApplications"" a
    WHERE COALESCE(TRIM(a.""ApplicantInstitutionalId""), '') <> '' AND a.""ApplicantFullName"" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ""Employees"" e WHERE LOWER(e.""StaffNumber"") = LOWER(TRIM(a.""ApplicantInstitutionalId"")))
    ORDER BY LOWER(TRIM(a.""ApplicantInstitutionalId"")), a.""SubmissionDate"" DESC;

    -- Link applications to employees by staff number.
    UPDATE ""RegistrationApplications"" a SET ""EmployeeId"" = e.""EmployeeId""
    FROM ""Employees"" e
    WHERE a.""EmployeeId"" IS NULL AND LOWER(TRIM(a.""ApplicantInstitutionalId"")) = LOWER(e.""StaffNumber"");

    -- Approved employees point at their Subscriber record.
    UPDATE ""Employees"" e SET ""SubscriberId"" = x.""SubscriberId""
    FROM (SELECT DISTINCT ON (""EmployeeId"") ""EmployeeId"", ""SubscriberId""
          FROM ""RegistrationApplications""
          WHERE ""EmployeeId"" IS NOT NULL AND ""ApplicationStatus"" = 'Approved' AND ""SubscriberId"" IS NOT NULL
          ORDER BY ""EmployeeId"", ""ReviewDate"" DESC NULLS LAST) x
    WHERE e.""EmployeeId"" = x.""EmployeeId"" AND e.""SubscriberId"" IS NULL;

    -- SIM status from their applications: Approved if any was approved, otherwise the latest one.
    UPDATE ""Employees"" e
    SET ""SimStatus"" = x.""ApplicationStatus"", ""LatestApplicationId"" = x.""ApplicationId"",
        ""SimStatusUpdatedAt"" = COALESCE(x.""ReviewDate"", x.""SubmissionDate"")
    FROM (SELECT DISTINCT ON (""EmployeeId"") ""EmployeeId"", ""ApplicationId"", ""ApplicationStatus"", ""ReviewDate"", ""SubmissionDate""
          FROM ""RegistrationApplications""
          WHERE ""EmployeeId"" IS NOT NULL
          ORDER BY ""EmployeeId"", (""ApplicationStatus"" = 'Approved') DESC, ""SubmissionDate"" DESC) x
    WHERE e.""EmployeeId"" = x.""EmployeeId"" AND e.""SimStatus"" = 'NotApplied' AND e.""LatestApplicationId"" IS NULL;

    -- Subscribers now holds only SIM applicants: employees an administrator had added there, with no application,
    -- were copied to Employees above and are removed from Subscribers.
    BEGIN
        DELETE FROM ""Subscribers"" s
        WHERE NOT EXISTS (SELECT 1 FROM ""RegistrationApplications"" a WHERE a.""SubscriberId"" = s.""SubscriberId"")
          AND NOT EXISTS (SELECT 1 FROM ""Employees"" e WHERE e.""SubscriberId"" = s.""SubscriberId"")
          AND EXISTS (SELECT 1 FROM ""Employees"" e WHERE LOWER(e.""StaffNumber"") = LOWER(TRIM(s.""InstitutionalId""))
                                                    AND e.""FullName"" = s.""FullName"")
          AND NOT EXISTS (SELECT 1 FROM ""Subscribers"" s2 WHERE s2.""SubscriberId"" <> s.""SubscriberId""
                          AND LOWER(TRIM(s2.""InstitutionalId"")) = LOWER(TRIM(s.""InstitutionalId"")));
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'Some subscribers without applications are referenced elsewhere and were kept.';
    END;
END $$;

-- SIM card stock: SIMs received from the operator are added as 'InStock' and issued from stock on approval.
ALTER TABLE IF EXISTS ""SimCards"" ADD COLUMN IF NOT EXISTS ""BatchReference"" VARCHAR(100);
ALTER TABLE IF EXISTS ""SimCards"" ADD COLUMN IF NOT EXISTS ""ReceivedAt"" TIMESTAMPTZ;
ALTER TABLE IF EXISTS ""SimCards"" ADD COLUMN IF NOT EXISTS ""AddedBy"" UUID;
DO $$
BEGIN
    IF to_regclass('""SimCards""') IS NULL THEN
        RETURN;
    END IF;
    BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS ix_simcards_iccid ON ""SimCards"" (UPPER(""Iccid""));
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate ICCIDs in SimCards: unique index not created.';
    END;
    BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS ix_simcards_phone ON ""SimCards"" (""Phone"");
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate phone numbers in SimCards: unique index not created.';
    END;
    CREATE INDEX IF NOT EXISTS ix_simcards_status ON ""SimCards"" (""Status"");
END $$;

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
CREATE TABLE IF NOT EXISTS ""CdrImports"" (
    ""ImportId"" UUID PRIMARY KEY,
    ""ImportedAt"" TIMESTAMPTZ NOT NULL,
    ""ImportedBy"" UUID REFERENCES users (id),
    ""Mode"" VARCHAR(20) NOT NULL,
    ""DailyFileName"" VARCHAR(255) NOT NULL,
    ""EventsFileName"" VARCHAR(255) NOT NULL,
    ""SimDays"" BIGINT NOT NULL,
    ""SimDaysAdded"" BIGINT NOT NULL,
    ""SimDaysUpdated"" BIGINT NOT NULL,
    ""Events"" BIGINT NOT NULL,
    ""EventsSkipped"" BIGINT NOT NULL,
    ""Sims"" INTEGER NOT NULL,
    ""DateFrom"" DATE NOT NULL,
    ""DateTo"" DATE NOT NULL,
    ""Warnings"" TEXT NOT NULL,
    ""AlertsSaved"" INTEGER
);
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
            return await CdrImporter.RunFromFolderAsync(connectionString, folder, tool.Contains("--replace"), logger);
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
