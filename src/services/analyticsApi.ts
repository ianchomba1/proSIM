// Client for the Analytics page (/api/analytics).
import { API_BASE_URL as API_ROOT } from "./api";
import type { AlertLevel } from "./misuseApi";

const API_BASE_URL = `${API_ROOT}/analytics`;

export interface Outcome {
  total: number;
  open: number;
  confirmed: number;
  falseAlarm: number;
  /** confirmed / (confirmed + falseAlarm); null until something has been reviewed */
  livePrecision: number | null;
}

/** Held-out test results saved by training notebook 01 (null if the ML service is down or the file is missing). */
export interface TestResults {
  model_version: string;
  evaluated_on: string;
  misuse_vs_normal: { precision: number; recall: number; f1: number };
  per_misuse_type: Record<string, { precision: number; recall: number; "f1-score": number; "test days": number }>;
  alert_levels: Record<AlertLevel, { "test days": number; "real misuse (%)": number }>;
}

export interface MisuseAnalytics {
  hasData: boolean;
  weeks: number;
  range?: { from: string; to: string };
  dataRange?: { from: string; to: string };
  totals?: {
    alerts: number; open: number; confirmed: number; falseAlarm: number;
    simsFlagged: number; simsFlaggedMoreThanOnce: number;
  };
  review?: { reviewed: number; reviewedShare: number | null; medianHoursToReview: number | null };
  daily?: { date: string; level: AlertLevel; count: number }[];
  byLevel?: (Outcome & { level: AlertLevel })[];
  byType?: (Outcome & { type: string; fromIsolationForest: boolean })[];
  repeatSims?: {
    simRef: string; alertDays: number; openDays: number; lastAlert: string;
    highestLevel: AlertLevel; mainType: string;
  }[];
  modelVersionsInAlerts?: string[];
  model: { modelVersion: string | null; testResults: TestResults | null } | null;
}

export type EmployeeSimStatus = "NotApplied" | "Pending" | "Approved" | "Rejected";
export type SimStockStatus = "InStock" | "Active" | "Suspended" | "Deactivated";

export interface OperationsAnalytics {
  weeks: number;
  department: string | null;
  range: { from: string; to: string };
  departments: string[];
  applications: {
    submitted: number; approved: number; rejected: number;
    approvalRate: number | null; medianHoursToDecision: number | null; pendingNow: number;
    weekly: { weekStart: string; submitted: number; approved: number; rejected: number }[];
  };
  employees: { total: number; byStatus: { status: EmployeeSimStatus; count: number }[] };
  stock: {
    inStock: number; pendingApplications: number; lowStockMinimum: number;
    byStatus: { status: SimStockStatus; count: number }[];
    weekly: { weekStart: string; received: number; issued: number; inStockAtEnd: number }[];
  };
  issuedByDepartment: { department: string; sims: number }[];
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new Error("Could not connect to the backend server. Is it running on port 5000?");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.message) || `Request failed (${response.status}).`);
  }
  return data as T;
}

/** weeks = how many weeks back from the latest scored day (0 = all scored days). */
export const fetchMisuseAnalytics = (weeks: number) => request<MisuseAnalytics>(`/misuse?weeks=${weeks}`);

/** weeks = how many weeks back from today (0 = everything); department optional. */
export function fetchOperationsAnalytics(weeks: number, department: string) {
  const q = new URLSearchParams({ weeks: String(weeks) });
  if (department) q.set("department", department);
  return request<OperationsAnalytics>(`/operations?${q}`);
}
