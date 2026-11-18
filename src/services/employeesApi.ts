import { API_BASE_URL } from './api';

/** Where an employee is with their company SIM application. */
export type SimApplicationStatus = 'NotApplied' | 'Pending' | 'Approved' | 'Rejected';

/** An employee on the staff list, as returned by GET /api/employees. */
export interface Employee {
  employeeId: string;
  fullName: string;
  staffNumber: string;
  email: string | null;
  department: string;
  dateOfBirth: string | null;
  phone: string | null;
  nationalIdNumber: string | null;
  simStatus: SimApplicationStatus;
  simStatusUpdatedAt: string | null;
  /** Set once their application is approved. */
  subscriberId: string | null;
  idVerifiedAt: string | null;
  /** Phone number of the SIM issued through an approved application, if any. */
  simPhone: string | null;
  simCardStatus: string | null;
  createdAt: string;
}

export interface NewEmployee {
  fullName: string;
  staffNumber: string;
  email: string;
  department: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  phone?: string;
  nationalIdNumber?: string;
}

export interface ImportSkip { line: number; staffNumber: string; reason: string }
export interface EmployeeImportResult { message: string; added: number; skipped: ImportSkip[] }

/** A rejected request; `errors` lists row problems for a CSV import. */
export class EmployeeApiError extends Error {
  readonly errors: string[];
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.errors = errors;
  }
}

/** Columns of the CSV template (required first). */
export const EMPLOYEE_CSV_COLUMNS = [
  { name: 'full_name', required: true, hint: 'e.g. Jane Wanjiru Kamau' },
  { name: 'staff_number', required: true, hint: 'unique per employee' },
  { name: 'email', required: true, hint: 'work email, unique' },
  { name: 'department', required: true, hint: 'e.g. Finance' },
  { name: 'date_of_birth', required: true, hint: 'YYYY-MM-DD or DD/MM/YYYY' },
  { name: 'phone', required: false, hint: 'Kenyan mobile, e.g. 0712345678' },
  { name: 'national_id_number', required: false, hint: 'digits only' },
] as const;

export const EMPLOYEE_CSV_TEMPLATE =
  EMPLOYEE_CSV_COLUMNS.map((c) => c.name).join(',') + '\r\n' +
  'Jane Wanjiru Kamau,STF-0001,jane.kamau@example.co.ke,Finance,1990-04-15,0712345678,\r\n';

async function readError(res: Response): Promise<EmployeeApiError> {
  try {
    const body = await res.json();
    const errors: string[] = Array.isArray(body?.errors) ? body.errors : [];
    return new EmployeeApiError(body?.message ?? `Request failed (${res.status}).`, errors);
  } catch {
    return new EmployeeApiError(`Request failed (${res.status}).`);
  }
}

export async function fetchEmployees(): Promise<Employee[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/employees`);
  } catch {
    throw new EmployeeApiError('Could not reach the server. Check that the backend is running.');
  }
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function addEmployee(employee: NewEmployee, addedBy?: string): Promise<{ message: string; employee: Employee }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...employee, addedBy: addedBy || undefined }),
    });
  } catch {
    throw new EmployeeApiError('Could not reach the server. Check that the backend is running.');
  }
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function importEmployees(file: File, addedBy?: string): Promise<EmployeeImportResult> {
  const form = new FormData();
  form.append('file', file);
  if (addedBy) form.append('addedBy', addedBy);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/employees/import`, { method: 'POST', body: form });
  } catch {
    throw new EmployeeApiError('Could not reach the server. Check that the backend is running.');
  }
  if (res.status === 413) throw new EmployeeApiError('The file is too large (5 MB at most).');
  if (!res.ok) throw await readError(res);
  return res.json();
}
