using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ProSim.Api.Controllers;
using ProSim.Api.Dtos;

namespace ProSim.Api.Services
{
    /// <summary>
    /// Validation and clean-up of an employee record, shared by "add one employee" and the CSV import,
    /// plus a small RFC 4180 CSV reader (quoted fields, commas and line breaks inside quotes).
    /// </summary>
    public static class EmployeeRules
    {
        public const int MinAge = 16;
        public const int MaxAge = 100;

        private static readonly Regex EmailPattern = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$");
        private static readonly Regex MsisdnPattern = new(@"^\+254[17]\d{8}$");
        private static readonly string[] DateFormats =
            { "yyyy-MM-dd", "yyyy/MM/dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy" };

        /// <summary>A validated employee, ready to save.</summary>
        public record Clean(string FullName, string StaffNumber, string Email, string Department, string DateOfBirth,
            string? Phone, string? NationalIdNumber);

        /// <summary>Checks one employee. Returns the cleaned values, or the list of problems.</summary>
        public static (Clean? value, List<string> errors) Validate(AddEmployeeDto d, DateOnly today)
        {
            var errors = new List<string>();
            var name = Squash(d.FullName);
            var staff = (d.StaffNumber ?? string.Empty).Trim();
            var email = (d.Email ?? string.Empty).Trim().ToLowerInvariant();
            var dept = Squash(d.Department);

            if (name.Length < 2) errors.Add("full name is required");
            else if (name.Length > 150) errors.Add("full name is longer than 150 characters");
            if (staff.Length == 0) errors.Add("staff number is required");
            else if (staff.Length > 100) errors.Add("staff number is longer than 100 characters");
            if (email.Length == 0) errors.Add("email is required");
            else if (email.Length > 150 || !EmailPattern.IsMatch(email)) errors.Add($"email \"{d.Email?.Trim()}\" is not a valid address");
            if (dept.Length == 0) errors.Add("department is required");
            else if (dept.Length > 100) errors.Add("department is longer than 100 characters");

            string? dob = null;
            if (string.IsNullOrWhiteSpace(d.DateOfBirth)) errors.Add("date of birth is required");
            else if (!DateOnly.TryParseExact(d.DateOfBirth.Trim(), DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var born))
                errors.Add($"date of birth \"{d.DateOfBirth.Trim()}\" is not a date (use YYYY-MM-DD or DD/MM/YYYY)");
            else if (born > today.AddYears(-MinAge) || born < today.AddYears(-MaxAge))
                errors.Add($"date of birth {born:yyyy-MM-dd} gives an age outside {MinAge}-{MaxAge}");
            else dob = born.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            string? phone = null;
            if (!string.IsNullOrWhiteSpace(d.Phone))
            {
                phone = NormaliseMsisdn(d.Phone);
                if (phone == null || !MsisdnPattern.IsMatch(phone))
                    errors.Add($"phone \"{d.Phone.Trim()}\" is not a Kenyan mobile number (e.g. 0712345678)");
            }

            string? nationalId = null;
            if (!string.IsNullOrWhiteSpace(d.NationalIdNumber))
            {
                nationalId = VerificationController.Digits(d.NationalIdNumber);
                if (nationalId.Length is < 6 or > 10)
                    errors.Add($"National ID number \"{d.NationalIdNumber.Trim()}\" should be 6-10 digits");
            }

            return errors.Count > 0 ? (null, errors) : (new Clean(name, staff, email, dept, dob!, phone, nationalId), errors);
        }

        /// <summary>0712345678, 712345678, 254712345678 or +254 712 345 678 -> +254712345678.</summary>
        public static string? NormaliseMsisdn(string raw)
        {
            var digits = VerificationController.Digits(raw);
            if (digits.StartsWith("0") && digits.Length == 10) digits = "254" + digits[1..];
            if (digits.Length == 9) digits = "254" + digits;
            return digits.Length == 12 ? "+" + digits : null;
        }

        private static string Squash(string? s) => Regex.Replace((s ?? string.Empty).Trim(), @"\s+", " ");

        // ------------------------------------------------------------------ CSV

        /// <summary>Column name in the file (any case, spaces/underscores ignored) -> field.</summary>
        public static readonly Dictionary<string, string> HeaderAliases = new()
        {
            ["fullname"] = "fullName", ["name"] = "fullName", ["employeename"] = "fullName",
            ["staffnumber"] = "staffNumber", ["staffno"] = "staffNumber", ["staffid"] = "staffNumber",
            ["employeenumber"] = "staffNumber", ["employeeid"] = "staffNumber", ["institutionalid"] = "staffNumber",
            ["email"] = "email", ["emailaddress"] = "email", ["workemail"] = "email",
            ["department"] = "department", ["dept"] = "department",
            ["dateofbirth"] = "dateOfBirth", ["dob"] = "dateOfBirth", ["birthdate"] = "dateOfBirth",
            ["phone"] = "phone", ["phonenumber"] = "phone", ["contactphone"] = "phone", ["mobile"] = "phone",
            ["nationalid"] = "nationalId", ["nationalidnumber"] = "nationalId", ["idnumber"] = "nationalId",
        };

        public static readonly string[] RequiredFields = { "fullName", "staffNumber", "email", "department", "dateOfBirth" };

        public static readonly Dictionary<string, string> FieldLabels = new()
        {
            ["fullName"] = "full_name", ["staffNumber"] = "staff_number", ["email"] = "email",
            ["department"] = "department", ["dateOfBirth"] = "date_of_birth",
        };

        public static string HeaderKey(string header) =>
            new string(header.Trim().TrimStart('﻿').ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

        /// <summary>Reads CSV records with the file line number each starts on. Blank lines are skipped.</summary>
        public static IEnumerable<(int line, List<string> fields)> ReadCsv(TextReader reader)
        {
            var fields = new List<string>();
            var field = new StringBuilder();
            bool inQuotes = false, any = false;
            int line = 1, start = 1, c;
            while ((c = reader.Read()) != -1)
            {
                var ch = (char)c;
                if (inQuotes)
                {
                    if (ch == '"')
                    {
                        if (reader.Peek() == '"') { field.Append('"'); reader.Read(); }
                        else inQuotes = false;
                    }
                    else
                    {
                        if (ch == '\n') line++;
                        field.Append(ch);
                    }
                    continue;
                }
                switch (ch)
                {
                    case '"': inQuotes = true; any = true; break;
                    case ',': fields.Add(field.ToString()); field.Clear(); any = true; break;
                    case '\r': break;
                    case '\n':
                        fields.Add(field.ToString()); field.Clear();
                        if (any || fields.Any(f => f.Length > 0)) yield return (start, fields);
                        fields = new List<string>(); any = false;
                        line++; start = line;
                        break;
                    default: field.Append(ch); any = true; break;
                }
            }
            fields.Add(field.ToString());
            if (any || fields.Any(f => f.Length > 0)) yield return (start, fields);
        }
    }
}
