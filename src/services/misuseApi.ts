// Client for the backend's misuse-detection endpoints (/api/misuse).
import { API_BASE_URL as API_ROOT } from "./api";

const API_BASE_URL = `${API_ROOT}/misuse`;

export type AlertLevel = "High" | "Alert" | "Review" | "Review (calls/SMS)";
export type ReviewStatus = "Open" | "Confirmed" | "FalseAlarm";

export const ALERT_LEVELS: AlertLevel[] = ["High", "Alert", "Review", "Review (calls/SMS)"];

export interface MisuseSummary {
  usageData: { from: string; to: string; sims: number } | null;
  lastScoredDay: string | null;
  openByLevel: Record<AlertLevel, number>;
  byStatus: Record<ReviewStatus, number>;
  openByType: Record<string, number>;
  model: { model_version: string; misuse_types: string[] } | null;
}

export interface MisuseCase {
  simRef: string;
  startDate: string;
  endDate: string;
  alertDays: number;
  alertLevel: AlertLevel;
  misuseTypes: string[];
  maxConfidence: number | null;
  signals: string[];
  status: ReviewStatus;
  alertIds: string[];
}

export interface MisuseAlert {
  alertId: string;
  simRef: string;
  alertDate: string;
  alertLevel: AlertLevel;
  misuseType: string;
  confidence: number | null;
  misuseScore: number;
  dataAnomalyScore: number;
  callAnomalyScore: number;
  flaggedBy: string[];
  signals: string[];
  modelVersion: string;
  status: ReviewStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface SimUsageDay {
  date: string;
  totalMb: number;
  offpeakMb: number;
  hotspotSessions: number;
  billedMb: number;
  calls: number;
  callMinutes: number;
  sms: number;
}

export interface SimMisuseDetail {
  simRef: string;
  tier: string | null;
  subscriberName: string | null;
  department: string | null;
  usage: SimUsageDay[];
  alerts: MisuseAlert[];
}

export interface RunResult {
  from: string;
  to: string;
  sims: number;
  daysScored: number;
  alertsSaved: number;
  alertsRemoved: number;
  alertCounts: Record<AlertLevel, number>;
  modelVersion: string;
  seconds: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Could not connect to the backend server. Is it running on port 5000?");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.message) || `Request failed (${response.status}).`);
  }
  return data as T;
}

export const fetchMisuseSummary = () => request<MisuseSummary>("/summary");

export function fetchMisuseCases(params: { status?: string; level?: string; type?: string; from?: string; to?: string }) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  return request<{ from: string | null; to: string | null; total: number; items: MisuseCase[] }>(`/cases?${q}`);
}

export const fetchSimDetail = (simRef: string, days = 90) =>
  request<SimMisuseDetail>(`/sims/${encodeURIComponent(simRef)}?days=${days}`);

export const reviewAlerts = (alertIds: string[], status: ReviewStatus, note?: string, reviewerId?: string) =>
  request<{ updated: number; status: ReviewStatus }>("/alerts/review", {
    method: "POST",
    body: JSON.stringify({ alertIds, status, note: note || null, reviewerId: reviewerId || null }),
  });

export const runMisuseScoring = (from?: string, to?: string) =>
  request<RunResult>("/run", { method: "POST", body: JSON.stringify({ from: from || null, to: to || null }) });

// ---- display helpers ----

const TYPE_LABELS: Record<string, string> = {
  unauthorized_sharing: "Unauthorized sharing",
  data_reselling: "Data reselling",
  ghost_usage: "Ghost usage",
  inactive_billing: "Inactive billing",
  call_abuse: "Call abuse",
  sim_box: "SIM-box",
  bulk_sms: "Bulk SMS",
  "unusual data use": "Unusual data use",
  "unusual calling/SMS": "Unusual calling/SMS",
};

export const misuseTypeLabel = (t: string) => TYPE_LABELS[t] ?? t;

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  Open: "Open",
  Confirmed: "Confirmed",
  FalseAlarm: "False alarm",
};
