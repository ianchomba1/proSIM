import { API_BASE_URL } from './api';

/** InStock until issued on approval (Active); Suspended / Deactivated take it out of service. */
export type SimCardStatus = 'InStock' | 'Active' | 'Suspended' | 'Deactivated';

/** A SIM card from the operator, as returned by GET /api/simcards. */
export interface SimCardItem {
  simCardId: string;
  iccid: string;
  phone: string;
  status: SimCardStatus | string;
  batchReference: string | null;
  receivedAt: string;
  addedByName: string | null;
  /** The employee it was issued (or, for older applications, reserved) to. */
  assignedTo: string | null;
  assignedStaffNumber: string | null;
  applicationStatus: string | null;
  issuedAt: string | null;
}

export interface SimImportResult {
  message: string;
  added: number;
  skipped: { line: number; iccid: string; reason: string }[];
}

/** A rejected request; `errors` lists row problems for a CSV import. */
export class SimCardApiError extends Error {
  readonly errors: string[];
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.errors = errors;
  }
}

export const SIM_CSV_COLUMNS = [
  { name: 'iccid', required: true, hint: 'printed on the SIM: 89…, 19-21 digits' },
  { name: 'phone', required: true, hint: 'the number issued with it, e.g. 0712345678' },
  { name: 'batch_reference', required: false, hint: "operator's delivery note / order number" },
] as const;

export const SIM_CSV_TEMPLATE = 'iccid,phone,batch_reference\r\n8925402000001234567,0712345678,DN-2026-0142\r\n';

const offline = () => new SimCardApiError('Could not reach the server. Check that the backend is running.');

async function readError(res: Response): Promise<SimCardApiError> {
  try {
    const body = await res.json();
    return new SimCardApiError(body?.message ?? `Request failed (${res.status}).`, Array.isArray(body?.errors) ? body.errors : []);
  } catch {
    return new SimCardApiError(`Request failed (${res.status}).`);
  }
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw offline();
  }
  if (res.status === 413) throw new SimCardApiError('The file is too large (5 MB at most).');
  if (!res.ok) throw await readError(res);
  return res.json();
}

export const fetchSimCards = () => send<SimCardItem[]>(`${API_BASE_URL}/simcards`);

export const addSimCard = (sim: { iccid: string; phone: string; batchReference?: string }, addedBy?: string) =>
  send<{ message: string }>(`${API_BASE_URL}/simcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...sim, addedBy: addedBy || undefined }),
  });

export function importSimCards(file: File, batchReference: string, addedBy?: string) {
  const form = new FormData();
  form.append('file', file);
  if (batchReference.trim()) form.append('batchReference', batchReference.trim());
  if (addedBy) form.append('addedBy', addedBy);
  return send<SimImportResult>(`${API_BASE_URL}/simcards/import`, { method: 'POST', body: form });
}

export const removeSimCard = (id: string) =>
  send<{ message: string }>(`${API_BASE_URL}/simcards/${id}`, { method: 'DELETE' });
