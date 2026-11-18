// Client for the admin CDR upload (POST /api/misuse/import) and import history.
import { API_BASE_URL } from "./api";

export type ImportMode = "merge" | "replace";

export interface CdrImportRecord {
  importId: string;
  importedAt: string;
  importedByName: string | null;
  mode: "Merge" | "Replace";
  dailyFileName: string;
  eventsFileName: string;
  simDays: number;
  simDaysAdded: number;
  simDaysUpdated: number;
  events: number;
  eventsSkipped: number;
  sims: number;
  dateFrom: string;
  dateTo: string;
  warnings: string[];
  alertsSaved: number | null;
}

export interface ImportResponse {
  import: CdrImportRecord;
  scoring: { alertsSaved: number; alertCounts: Record<string, number>; seconds: number } | null;
  scoringError: string | null;
}

export class ImportError extends Error {
  errors: string[];
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.errors = errors;
  }
}

/** Columns each file must have (any extra columns are ignored). */
export const DAILY_COLUMNS = [
  "sim_id", "date", "tier", "total_download_mb", "total_upload_mb", "total_mb", "session_count", "data_session_count",
  "total_duration_s", "max_session_mb", "hotspot_flag_count", "geo_flag_count", "roaming_sessions", "unique_towers",
  "apn_public_count", "offpeak_session_count", "offpeak_mb", "billed_mb", "voice_minutes_used", "sms_count",
];
export const EVENT_COLUMNS = ["sim_id", "session_timestamp", "session_duration", "event_type", "call_destination"];

/**
 * Upload both CSV files. Uses XMLHttpRequest so upload progress can be shown (fetch cannot report it).
 * `onProgress(fraction)` runs while the files upload; once it reaches 1 the server is importing (and scoring).
 */
export function uploadCdrFiles(
  opts: { dailyFile: File; eventsFile: File; mode: ImportMode; scoreAfter: boolean; importedBy?: string },
  onProgress: (fraction: number) => void,
): Promise<ImportResponse> {
  const form = new FormData();
  form.append("dailyFile", opts.dailyFile);
  form.append("eventsFile", opts.eventsFile);
  form.append("mode", opts.mode);
  form.append("scoreAfter", String(opts.scoreAfter));
  if (opts.importedBy) form.append("importedBy", opts.importedBy);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/misuse/import`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.upload.onload = () => onProgress(1);
    xhr.onerror = () => reject(new ImportError("Could not connect to the backend server."));
    xhr.onload = () => {
      let data: { message?: string; errors?: string[] } & Partial<ImportResponse> = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as ImportResponse);
      else if (xhr.status === 413) reject(new ImportError("The files are too large (300 MB limit for both together)."));
      else reject(new ImportError(data.message || `Import failed (${xhr.status}).`, data.errors ?? []));
    };
    xhr.send(form);
  });
}

export async function fetchImportHistory(limit = 20): Promise<CdrImportRecord[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/misuse/imports?limit=${limit}`);
  } catch {
    throw new Error("Could not connect to the backend server.");
  }
  if (!response.ok) throw new Error(`Failed to load import history (${response.status}).`);
  return response.json();
}
