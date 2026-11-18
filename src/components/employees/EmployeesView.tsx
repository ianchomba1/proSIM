import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleAlert, CircleCheck, CircleDashed, CircleX, Clock, Download, FileSpreadsheet, FileUp, LoaderCircle, RefreshCw,
  Search, ShieldCheck, Upload, UserPlus, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  EMPLOYEE_CSV_COLUMNS, EMPLOYEE_CSV_TEMPLATE, EmployeeApiError, addEmployee, fetchEmployees, importEmployees,
  type Employee, type EmployeeImportResult, type SimApplicationStatus,
} from '../../services/employeesApi';
import { C, buttonStyle, cardStyle, selectStyle } from '../misuse/misuseTheme';

interface Props {
  /** users.id of the signed-in administrator, recorded as the one adding employees. */
  adminId?: string;
}

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const inputStyle: React.CSSProperties = {
  ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text', color: C.text, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: '12.5px', fontWeight: 600, color: C.textSoft, display: 'block', marginBottom: '6px' };
const hintStyle: React.CSSProperties = { fontSize: '12px', color: C.faint, marginTop: '4px' };

const formatDate = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

const SIM_STATUS: Record<SimApplicationStatus, { label: string; color: string; Icon: LucideIcon }> = {
  NotApplied: { label: 'Not applied', color: 'var(--text-muted)', Icon: CircleDashed },
  Pending: { label: 'Pending', color: '#d97706', Icon: Clock },
  Approved: { label: 'Approved', color: 'var(--accent-green)', Icon: CircleCheck },
  Rejected: { label: 'Rejected', color: 'var(--danger)', Icon: CircleX },
};
const TABS: (SimApplicationStatus | 'All')[] = ['All', 'NotApplied', 'Pending', 'Approved', 'Rejected'];

const SimStatusBadge: React.FC<{ status: SimApplicationStatus }> = ({ status }) => {
  const s = SIM_STATUS[status] ?? SIM_STATUS.NotApplied;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: s.color, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <s.Icon size={14} /> {s.label}
    </span>
  );
};

/** Latest date of birth allowed (16 years ago), as YYYY-MM-DD. */
const latestBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 16);
  return d.toISOString().slice(0, 10);
};

/** Employees: add one at a time or import a CSV. No SIM is issued here; SIMs come from approved applications. */
export const EmployeesView: React.FC<Props> = ({ adminId }) => {
  const [result, setResult] = useState<{ key: number; items: Employee[]; error: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [tab, setTab] = useState<SimApplicationStatus | 'All'>('All');
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => {
    let current = true;
    fetchEmployees()
      .then((items) => { if (current) setResult({ key: refreshKey, items, error: '' }); })
      .catch((e: Error) => { if (current) setResult({ key: refreshKey, items: [], error: e.message }); });
    return () => { current = false; };
  }, [refreshKey]);

  const loading = result?.key !== refreshKey;
  const all = useMemo(() => result?.items ?? [], [result]);
  const departments = useMemo(() => [...new Set(all.map((e) => e.department).filter(Boolean))].sort(), [all]);
  const counts = useMemo(() => {
    const c: Record<SimApplicationStatus | 'All', number> = { All: all.length, NotApplied: 0, Pending: 0, Approved: 0, Rejected: 0 };
    all.forEach((e) => { c[e.simStatus] = (c[e.simStatus] ?? 0) + 1; });
    return c;
  }, [all]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((e) => tab === 'All' || e.simStatus === tab)
      .filter((e) => dept === 'All' || e.department === dept)
      .filter((e) => !q || [e.fullName, e.staffNumber, e.email, e.phone, e.nationalIdNumber, e.simPhone]
        .some((v) => v?.toLowerCase().includes(q)));
  }, [all, tab, dept, search]);

  const onDone = (message: string) => {
    setDialog(null);
    setBanner(message);
    setRefreshKey((k) => k + 1);
  };

  const th: React.CSSProperties = { padding: '14px 18px' };
  const td: React.CSSProperties = { padding: '14px 18px', verticalAlign: 'top' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>Employees</h1>
          <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0 0', maxWidth: '640px' }}>
            The staff list. Only listed employees can apply for a company SIM; their status updates when they apply and when the application is approved or rejected.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={buttonStyle('secondary', loading)} aria-label="Refresh">
            {loading ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}
          </button>
          <button onClick={() => setDialog('import')} style={buttonStyle('secondary')}>
            <FileUp size={16} /> Import CSV
          </button>
          <button onClick={() => setDialog('add')} style={buttonStyle('primary')}>
            <UserPlus size={16} /> Add employee
          </button>
        </div>
      </div>

      {banner && (
        <div role="status" style={{ ...cardStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: C.text, fontSize: '13.5px' }}>
          <CircleCheck size={16} color="var(--accent-green)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{banner}</span>
          <button onClick={() => setBanner('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div role="tablist" aria-label="SIM application status" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button key={t} role="tab" aria-selected={active} onClick={() => setTab(t)}
              style={{
                ...buttonStyle('secondary'), padding: '8px 14px',
                backgroundColor: active ? 'var(--accent-green-dim)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-green)' : 'var(--card-border)'}`,
                color: active ? C.text : C.textSoft,
              }}>
              {t === 'All' ? 'All' : SIM_STATUS[t].label}
              <span style={{ fontSize: '12px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
          <Search size={16} color={C.faint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search name, staff number, email, phone" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, padding: '9px 14px 9px 36px' }} aria-label="Search employees" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={selectStyle} aria-label="Department">
          <option value="All">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {loading && !result ? '' : `${shown.length.toLocaleString()} of ${all.length.toLocaleString()} employees`}
        </span>
      </div>

      {result?.error && <div style={{ ...cardStyle, padding: '16px', color: 'var(--danger)' }}>{result.error}</div>}

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.rowBorder}`, backgroundColor: C.headRow, color: C.faint, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                <th style={th}>Employee</th>
                <th style={th}>Staff number</th>
                <th style={th}>Department</th>
                <th style={th}>Date of birth</th>
                <th style={th}>National ID</th>
                <th style={th}>SIM application</th>
                <th style={th}>Added</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result ? (
                <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>Loading employees…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>
                  {all.length === 0 ? 'No employees yet. Add one or import a CSV file.' : 'No employees match.'}
                </td></tr>
              ) : shown.map((e, i) => (
                <tr key={e.employeeId} style={{ borderBottom: i < shown.length - 1 ? `1px solid ${C.rowBorder}` : 'none' }}>
                  <td style={td}>
                    <div style={{ color: C.text, fontWeight: 600 }}>{e.fullName}</div>
                    <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>
                      {[e.email, e.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td style={{ ...td, color: C.text, fontFamily: mono, fontSize: '13px', whiteSpace: 'nowrap' }}>{e.staffNumber}</td>
                  <td style={{ ...td, color: C.textSoft }}>{e.department}</td>
                  <td style={{ ...td, color: C.textSoft, whiteSpace: 'nowrap' }}>{formatDate(e.dateOfBirth)}</td>
                  <td style={td}>
                    <div style={{ color: e.nationalIdNumber ? C.text : C.faint, fontFamily: mono, fontSize: '13px' }}>{e.nationalIdNumber ?? '—'}</div>
                    {e.idVerifiedAt && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-green)', fontSize: '12px', marginTop: '3px', whiteSpace: 'nowrap' }}>
                        <ShieldCheck size={13} /> ID verified
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <SimStatusBadge status={e.simStatus} />
                    {e.simPhone && (
                      <div style={{ color: C.text, fontSize: '12.5px', marginTop: '3px' }}>
                        {e.simPhone}{e.simCardStatus && e.simCardStatus !== 'Active' ? ` · ${e.simCardStatus}` : ''}
                      </div>
                    )}
                    {e.simStatus !== 'NotApplied' && e.simStatusUpdatedAt && (
                      <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>{formatDate(e.simStatusUpdatedAt)}</div>
                    )}
                  </td>
                  <td style={{ ...td, color: C.textSoft, whiteSpace: 'nowrap' }}>{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog === 'add' && <AddEmployeeDialog adminId={adminId} departments={departments} onCancel={() => setDialog(null)} onDone={onDone} />}
      {dialog === 'import' && <ImportDialog adminId={adminId} onCancel={() => setDialog(null)} onDone={onDone} />}
    </div>
  );
};

/* ------------------------------------------------------------------ shared modal frame */

const Modal: React.FC<{
  title: string; subtitle: string; busy: boolean; onClose: () => void; onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode; width?: number;
}> = ({ title, subtitle, busy, onClose, onSubmit, children, width = 520 }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div onClick={() => !busy && onClose()} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50,
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title" onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit ?? ((e) => e.preventDefault())}
        style={{
          ...cardStyle, backgroundColor: 'var(--card-bg-elevated, var(--card-bg))', width: '100%', maxWidth: `${width}px`,
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 id="employee-dialog-title" style={{ margin: 0, fontSize: '18px', color: C.text }}>{title}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: C.muted }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ add one employee */

const AddEmployeeDialog: React.FC<{
  adminId?: string; departments: string[]; onCancel: () => void; onDone: (message: string) => void;
}> = ({ adminId, departments, onCancel, onDone }) => {
  const [form, setForm] = useState({ fullName: '', staffNumber: '', email: '', department: '', dateOfBirth: '', phone: '', nationalIdNumber: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = [
      ['full name', form.fullName], ['staff number', form.staffNumber], ['email', form.email],
      ['department', form.department], ['date of birth', form.dateOfBirth],
    ].filter(([, v]) => !v.trim()).map(([k]) => k);
    if (missing.length) {
      setError(`Fill in the ${missing.join(', ')}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await addEmployee({
        fullName: form.fullName.trim(), staffNumber: form.staffNumber.trim(), email: form.email.trim(),
        department: form.department.trim(), dateOfBirth: form.dateOfBirth,
        phone: form.phone.trim() || undefined, nationalIdNumber: form.nationalIdNumber.trim() || undefined,
      }, adminId);
      onDone(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the employee.');
      setSaving(false);
    }
  };

  const req = <span style={{ color: 'var(--danger)' }} aria-hidden="true"> *</span>;
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '14px' };

  return (
    <Modal title="Add employee" subtitle="Register a staff member. No SIM card is issued yet." busy={saving} onClose={onCancel} onSubmit={submit}>
      <div>
        <label style={labelStyle} htmlFor="emp-name">Full name{req}</label>
        <input id="emp-name" value={form.fullName} onChange={set('fullName')} style={inputStyle} autoFocus autoComplete="off" maxLength={150} />
      </div>
      <div style={row}>
        <div>
          <label style={labelStyle} htmlFor="emp-staff">Staff number{req}</label>
          <input id="emp-staff" value={form.staffNumber} onChange={set('staffNumber')} style={{ ...inputStyle, fontFamily: mono }} autoComplete="off" maxLength={100} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="emp-dept">Department{req}</label>
          <input id="emp-dept" value={form.department} onChange={set('department')} style={inputStyle} list="emp-departments" autoComplete="off" maxLength={100} />
          <datalist id="emp-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
      </div>
      <div style={row}>
        <div>
          <label style={labelStyle} htmlFor="emp-email">Email{req}</label>
          <input id="emp-email" type="email" value={form.email} onChange={set('email')} style={inputStyle} autoComplete="off" maxLength={150} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="emp-dob">Date of birth{req}</label>
          <input id="emp-dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={latestBirthDate()} min="1926-01-01" style={inputStyle} />
        </div>
      </div>
      <div style={row}>
        <div>
          <label style={labelStyle} htmlFor="emp-phone">Phone (optional)</label>
          <input id="emp-phone" value={form.phone} onChange={set('phone')} style={inputStyle} inputMode="tel" placeholder="0712 345 678" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="emp-nid">National ID number (optional)</label>
          <input id="emp-nid" value={form.nationalIdNumber} onChange={set('nationalIdNumber')} style={{ ...inputStyle, fontFamily: mono }} inputMode="numeric" />
        </div>
      </div>

      {error && <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onCancel} disabled={saving} style={buttonStyle('secondary', saving)}>Cancel</button>
        <button type="submit" disabled={saving} style={buttonStyle('primary', saving)}>
          {saving ? <LoaderCircle size={15} /> : <UserPlus size={15} />} Add employee
        </button>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ CSV import */

const ImportDialog: React.FC<{ adminId?: string; onCancel: () => void; onDone: (message: string) => void }> = ({ adminId, onCancel, onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; errors: string[] } | null>(null);
  const [done, setDone] = useState<EmployeeImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | null | undefined) => {
    setFile(f ?? null);
    setFailure(null);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([EMPLOYEE_CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFailure({ message: 'Choose a CSV file first.', errors: [] });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      setDone(await importEmployees(file, adminId));
    } catch (err) {
      setFailure(err instanceof EmployeeApiError
        ? { message: err.message, errors: err.errors }
        : { message: 'The import failed.', errors: [] });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Import finished" subtitle={file?.name ?? ''} busy={false} onClose={() => onDone(done.message)}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: C.text, fontWeight: 600, fontSize: '14px' }}>
          <CircleCheck size={17} color="var(--accent-green)" /> {done.message}
        </div>
        {done.skipped.length > 0 && (
          <div>
            <div style={{ ...labelStyle, marginBottom: '8px' }}>Skipped (staff number already registered)</div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: C.textSoft, lineHeight: 1.6, maxHeight: '180px', overflowY: 'auto' }}>
              {done.skipped.map((s) => <li key={s.line}>Line {s.line}: {s.staffNumber}, {s.reason}</li>)}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => onDone(done.message)} style={buttonStyle('primary')}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import employees from CSV" subtitle="Every row is checked first; if any row has a problem, nothing is saved."
      busy={busy} onClose={onCancel} onSubmit={submit} width={600}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: C.textSoft }}>Start from the template, or use any CSV with these column names.</span>
        <button type="button" onClick={downloadTemplate} style={{ ...buttonStyle('secondary'), padding: '7px 14px' }}>
          <Download size={15} /> Download template
        </button>
      </div>

      <div style={{ border: `1px solid ${C.rowBorder}`, borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <tbody>
            {EMPLOYEE_CSV_COLUMNS.map((c, i) => (
              <tr key={c.name} style={{ borderTop: i ? `1px solid ${C.rowBorder}` : 'none' }}>
                <td style={{ padding: '7px 12px', fontFamily: mono, color: C.text, whiteSpace: 'nowrap' }}>{c.name}</td>
                <td style={{ padding: '7px 12px', color: c.required ? C.text : C.faint, whiteSpace: 'nowrap' }}>{c.required ? 'required' : 'optional'}</td>
                <td style={{ padding: '7px 12px', color: C.faint }}>{c.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
        style={{
          border: `1.5px dashed ${over ? 'var(--accent-green)' : 'var(--card-border)'}`, borderRadius: '10px', padding: '16px',
          backgroundColor: over ? 'var(--accent-green-dim)' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
        <input ref={input} id="employee-csv" type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {file ? (
          <>
            <FileSpreadsheet size={20} color="var(--accent-green)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div style={{ color: C.faint, fontSize: '12px' }}>{Math.max(1, Math.round(file.size / 1000))} KB</div>
            </div>
            <button type="button" onClick={() => pick(null)} disabled={busy} aria-label="Remove file"
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
              <X size={16} />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            style={{ ...buttonStyle('secondary'), width: '100%', justifyContent: 'center' }}>
            <Upload size={15} /> Choose CSV or drop it here
          </button>
        )}
      </div>

      <div style={hintStyle}>
        Rows whose staff number is already registered are skipped. Staff numbers and emails must be unique. In Excel, save as "CSV UTF-8".
      </div>

      {failure && (
        <div role="alert" style={{ border: '1px solid var(--danger)', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--danger)', fontWeight: 600, fontSize: '13.5px' }}>
            <CircleAlert size={16} style={{ flexShrink: 0 }} /> {failure.message}
          </div>
          {failure.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', fontSize: '12.5px', color: C.textSoft, lineHeight: 1.6, maxHeight: '200px', overflowY: 'auto' }}>
              {failure.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={buttonStyle('secondary', busy)}>Cancel</button>
        <button type="submit" disabled={busy || !file} style={buttonStyle('primary', busy || !file)}>
          {busy ? <LoaderCircle size={15} /> : <FileUp size={15} />} {busy ? 'Importing…' : 'Import employees'}
        </button>
      </div>
    </Modal>
  );
};
