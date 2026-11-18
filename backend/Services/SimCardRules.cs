using System.Text.RegularExpressions;

namespace ProSim.Api.Services
{
    /// <summary>Validation of SIM cards added to stock (one at a time or from a CSV).</summary>
    public static class SimCardRules
    {
        public static readonly Regex IccidPattern = new(@"^89\d{17,19}F?$");
        public static readonly Regex MsisdnPattern = new(@"^\+254[17]\d{8}$");

        public record Clean(string Iccid, string Phone, string? BatchReference);

        /// <summary>Checks one SIM. Returns the cleaned values, or the list of problems.</summary>
        public static (Clean? value, List<string> errors) Validate(string? iccidRaw, string? phoneRaw, string? batchRaw)
        {
            var errors = new List<string>();
            var iccid = Regex.Replace((iccidRaw ?? string.Empty).Trim().ToUpperInvariant(), @"[\s-]", "");
            if (iccid.Length == 0) errors.Add("ICCID is required");
            else if (!IccidPattern.IsMatch(iccid))
                errors.Add($"ICCID \"{iccidRaw?.Trim()}\" should start with 89 and have 19-21 digits");

            string? phone = null;
            if (string.IsNullOrWhiteSpace(phoneRaw)) errors.Add("phone number is required");
            else
            {
                phone = EmployeeRules.NormaliseMsisdn(phoneRaw);
                if (phone == null || !MsisdnPattern.IsMatch(phone))
                    errors.Add($"phone number \"{phoneRaw.Trim()}\" is not a Kenyan mobile number (e.g. 0712345678)");
            }

            var batch = string.IsNullOrWhiteSpace(batchRaw) ? null : Regex.Replace(batchRaw.Trim(), @"\s+", " ");
            if (batch is { Length: > 100 }) errors.Add("batch reference is longer than 100 characters");

            return errors.Count > 0 ? (null, errors) : (new Clean(iccid, phone!, batch), errors);
        }

        /// <summary>Column name in the file (any case, spaces/underscores ignored) -> field.</summary>
        public static readonly Dictionary<string, string> HeaderAliases = new()
        {
            ["iccid"] = "iccid", ["simnumber"] = "iccid", ["serialnumber"] = "iccid", ["simserial"] = "iccid",
            ["phone"] = "phone", ["phonenumber"] = "phone", ["msisdn"] = "phone", ["mobilenumber"] = "phone", ["number"] = "phone",
            ["batchreference"] = "batch", ["batch"] = "batch", ["batchref"] = "batch", ["deliverynote"] = "batch",
            ["deliveryreference"] = "batch", ["ordernumber"] = "batch", ["reference"] = "batch",
        };
    }
}
