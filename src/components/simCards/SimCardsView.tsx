import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban, CircleAlert, CircleCheck, CirclePause, Clock, Download, FileSpreadsheet, FileUp, LoaderCircle, Package, Plus,
  RefreshCw, Search, Trash2, TriangleAlert, Upload, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SIM_CSV_COLUMNS, SIM_CSV_TEMPLATE, SimCardApiError, addSimCard, fetchSimCards, importSimCards, removeSimCard,
  type SimCardItem, type SimImportResult,
} from '../../services/simCardsApi';
import { C, buttonStyle, cardStyle, selectStyle } from '../misuse/misuseTheme';
import { Modal } from '../common/Modal';

interface Props {
  /** users.id of the signed-in administrator, recorded as the one adding stock. */
  adminId?: string;
}

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const inputStyle: React.CSSProperties = {
  ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text', color: C.text, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: '12.5px', fontWeight: 600, color: C.textSoft, display: 'block', marginBottom: '6px' };
const hintStyle: React.CSSProperties = { fontSize: '12px', color: C.faint, marginTop: '4px' };

type Tab = 'All' | 'InStock' | 'Active' | 'Suspended' | 'Deactivated';
const STATUS: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  InStock: { label: 'In stock', color: '#2563eb', Icon: Package },
  Active: { label: 'Issued', color: 'var(--accent-green)', Icon: CircleCheck },
  Suspended: { label: 'Suspended', color: '#d97706', Icon: CirclePause },
  Deactivated: { label: 'Deactivated', color: 'var(--danger)', Icon: Ban },
  // Display only: a SIM tied to a still-pending application (created by the older flow before approval existed)
  Reserved: { label: 'Reserved', color: '#d97706', Icon: Clock },
};
const displayStatus = (s: SimCardItem) => (s.status === 'Active' && s.applicationStatus === 'Pending' ? 'Reserved' : s.status);
const TABS: Tab[] = ['All', 'InStock', 'Active', 'Suspended', 'Deactivated'];

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS[status] ?? { label: status, color: C.muted, Icon: CircleAlert };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: s.color, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <s.Icon size={14} /> {s.label}
    </span>
  );
};

/** SIM card stock: SIMs received from the operator wait here until an approved application issues one. */
export const SimCardsView: React.FC<Props> = ({ adminId }) => {
  const [result, setResult] = useState<{ key: number; items: SimCardItem[]; error: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'add' | 'import' | { remove: SimCardItem } | null>(null);
  const [banner, setBanner] = useState('');

  useEffect(() => {
    let current = true;
    fetchSimCards()
      .then((items) => { if (current) setResult({ key: refreshKey, items, error: '' }); })
      .catch((e: Error) => { if (current) setResult({ key: refreshKey, items: [], error: e.message }); });
    return () => { current = false; };
  }, [refreshKey]);

  const loading = result?.key !== refreshKey;
  const all = useMemo(() => result?.items ?? [], [result]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { All: all.length, InStock: 0, Active: 0, Suspended: 0, Deactivated: 0 };
    all.forEach((s) => { if (s.status in c) c[s.status as Tab] += 1; });
    return c;
  }, [all]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((s) => tab === 'All' || s.status === tab)
      .filter((s) => !q || [s.iccid, s.phone, s.batchReference, s.assignedTo, s.assignedStaffNumber]
        .some((v) => v?.toLowerCase().includes(q)));
  }, [all, tab, search]);

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
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>SIM Cards</h1>
          <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0 0', maxWidth: '640px' }}>
            SIM cards received from the telecom operator. They stay in stock until an approved application issues one to an employee.
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
            <Plus size={16} /> Add SIM card
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

      {!loading && !result?.error && counts.InStock === 0 && (
        <div role="alert" style={{ ...cardStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: C.text, fontSize: '13.5px', borderColor: '#d97706' }}>
          <TriangleAlert size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <span>No SIM cards in stock. Applications can't be approved until you add the SIMs received from the operator.</span>
        </div>
      )}

      <div role="tablist" aria-label="SIM card status" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
              {t === 'All' ? 'All' : STATUS[t].label}
              <span style={{ fontSize: '12px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
          <Search size={16} color={C.faint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search ICCID, number, batch, employee" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, padding: '9px 14px 9px 36px' }} aria-label="Search SIM cards" />
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {loading && !result ? '' : `${shown.length.toLocaleString()} of ${all.length.toLocaleString()} SIM cards`}
        </span>
      </div>

      {result?.error && <div style={{ ...cardStyle, padding: '16px', color: 'var(--danger)' }}>{result.error}</div>}

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.rowBorder}`, backgroundColor: C.headRow, color: C.faint, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                <th style={th}>ICCID</th>
                <th style={th}>Phone number</th>
                <th style={th}>Status</th>
                <th style={th}>Batch reference</th>
                <th style={th}>Received</th>
                <th style={th}>Issued to</th>
                <th style={{ ...th, width: '1%' }}><span style={{ position: 'absolute', left: '-9999px' }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && !result ? (
                <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>Loading SIM cards…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>
                  {all.length === 0 ? 'No SIM cards yet. Add the SIMs received from the operator, one at a time or from a CSV file.' : 'No SIM cards match.'}
                </td></tr>
              ) : shown.map((s, i) => (
                <tr key={s.simCardId} style={{ borderBottom: i < shown.length - 1 ? `1px solid ${C.rowBorder}` : 'none' }}>
                  <td style={{ ...td, color: C.text, fontFamily: mono, fontSize: '13px', whiteSpace: 'nowrap' }}>{s.iccid}</td>
                  <td style={{ ...td, color: C.text, whiteSpace: 'nowrap' }}>{s.phone}</td>
                  <td style={td}><StatusBadge status={displayStatus(s)} /></td>
                  <td style={{ ...td, color: s.batchReference ? C.textSoft : C.faint }}>{s.batchReference ?? '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ color: C.textSoft }}>{formatDate(s.receivedAt)}</div>
                    {s.addedByName && <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>by {s.addedByName}</div>}
                  </td>
                  <td style={td}>
                    {s.assignedTo ? (
                      <>
                        <div style={{ color: C.text, fontWeight: 600 }}>{s.assignedTo}</div>
                        <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>
                          {[s.assignedStaffNumber, s.issuedAt ? formatDate(s.issuedAt) : s.applicationStatus?.toLowerCase()].filter(Boolean).join(' · ')}
                        </div>
                      </>
                    ) : <span style={{ color: C.faint }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {s.status === 'InStock' && !s.assignedTo && (
                      <button onClick={() => setDialog({ remove: s })} aria-label={`Remove SIM ${s.iccid}`} title="Remove from stock"
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '2px' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog === 'add' && <AddSimDialog adminId={adminId} onCancel={() => setDialog(null)} onDone={onDone} onAdded={() => setRefreshKey((k) => k + 1)} />}
      {dialog === 'import' && <ImportSimDialog adminId={adminId} onCancel={() => setDialog(null)} onDone={onDone} />}
      {dialog && typeof dialog === 'object' && <RemoveSimDialog sim={dialog.remove} onCancel={() => setDialog(null)} onDone={onDone} />}
    </div>
  );
};

/* ------------------------------------------------------------------ add one SIM */

const AddSimDialog: React.FC<{
  adminId?: string; onCancel: () => void; onDone: (message: string) => void; onAdded: () => void;
}> = ({ adminId, onCancel, onDone, onAdded }) => {
  const [iccid, setIccid] = useState('');
  const [phone, setPhone] = useState('');
  const [batch, setBatch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const iccidInput = useRef<HTMLInputElement>(null);
  const another = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iccid.trim() || !phone.trim()) {
      setError('Fill in the ICCID and the phone number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await addSimCard({ iccid: iccid.trim(), phone: phone.trim(), batchReference: batch.trim() || undefined }, adminId);
      if (another.current) {
        // Keep the batch reference; clear the card's own numbers for the next one.
        setAdded((a) => [...a, iccid.trim()]);
        setIccid('');
        setPhone('');
        setSaving(false);
        onAdded();
        iccidInput.current?.focus();
      } else {
        onDone(added.length ? `${added.length + 1} SIM cards added to stock.` : res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the SIM card.');
      setSaving(false);
    }
  };

  const req = <span style={{ color: 'var(--danger)' }} aria-hidden="true"> *</span>;
  const close = () => (added.length ? onDone(`${added.length} SIM card(s) added to stock.`) : onCancel());

  return (
    <Modal title="Add SIM card" subtitle="Record a SIM received from the operator. It goes into stock until it is issued."
      busy={saving} onClose={close} onSubmit={submit}>
      <div>
        <label style={labelStyle} htmlFor="sim-iccid">ICCID{req}</label>
        <input id="sim-iccid" ref={iccidInput} value={iccid} onChange={(e) => setIccid(e.target.value)} autoFocus autoComplete="off"
          style={{ ...inputStyle, fontFamily: mono }} placeholder="8925402000001234567" inputMode="numeric" />
        <div style={hintStyle}>The number printed on the SIM card: starts with 89, 19–21 digits.</div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="sim-phone">Phone number{req}</label>
        <input id="sim-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel"
          placeholder="0712 345 678" autoComplete="off" />
        <div style={hintStyle}>The number the operator issued with this SIM.</div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="sim-batch">Batch / delivery reference (optional)</label>
        <input id="sim-batch" value={batch} onChange={(e) => setBatch(e.target.value)} style={inputStyle} maxLength={100}
          placeholder="e.g. DN-2026-0142" autoComplete="off" />
      </div>

      {added.length > 0 && (
        <div style={{ fontSize: '12.5px', color: C.textSoft }}>
          <CircleCheck size={13} color="var(--accent-green)" style={{ verticalAlign: '-2px' }} /> Added: {added.join(', ')}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={close} disabled={saving} style={buttonStyle('secondary', saving)}>{added.length ? 'Done' : 'Cancel'}</button>
        <button type="submit" onClick={() => { another.current = true; }} disabled={saving} style={buttonStyle('secondary', saving)}>
          Add and add another
        </button>
        <button type="submit" onClick={() => { another.current = false; }} disabled={saving} style={buttonStyle('primary', saving)}>
          {saving ? <LoaderCircle size={15} /> : <Plus size={15} />} Add SIM card
        </button>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ CSV import */

const ImportSimDialog: React.FC<{ adminId?: string; onCancel: () => void; onDone: (message: string) => void }> = ({ adminId, onCancel, onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; errors: string[] } | null>(null);
  const [done, setDone] = useState<SimImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | null | undefined) => {
    setFile(f ?? null);
    setFailure(null);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([SIM_CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sim_cards_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      setDone(await importSimCards(file, batch, adminId));
    } catch (err) {
      setFailure(err instanceof SimCardApiError ? { message: err.message, errors: err.errors } : { message: 'The import failed.', errors: [] });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Import finished" subtitle={file?.name} onClose={() => onDone(done.message)}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: C.text, fontWeight: 600, fontSize: '14px' }}>
          <CircleCheck size={17} color="var(--accent-green)" /> {done.message}
        </div>
        {done.skipped.length > 0 && (
          <div>
            <div style={{ ...labelStyle, marginBottom: '8px' }}>Skipped (ICCID already recorded)</div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: C.textSoft, lineHeight: 1.6, maxHeight: '180px', overflowY: 'auto' }}>
              {done.skipped.map((s) => <li key={s.line}>Line {s.line}: {s.iccid}</li>)}
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
    <Modal title="Import SIM cards from CSV" subtitle="Every row is checked first; if any row has a problem, nothing is saved."
      busy={busy} onClose={onCancel} onSubmit={submit} width={600}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: C.textSoft }}>Use the operator's SIM list, or start from the template.</span>
        <button type="button" onClick={downloadTemplate} style={{ ...buttonStyle('secondary'), padding: '7px 14px' }}>
          <Download size={15} /> Download template
        </button>
      </div>

      <div style={{ border: `1px solid ${C.rowBorder}`, borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <tbody>
            {SIM_CSV_COLUMNS.map((c, i) => (
              <tr key={c.name} style={{ borderTop: i ? `1px solid ${C.rowBorder}` : 'none' }}>
                <td style={{ padding: '7px 12px', fontFamily: mono, color: C.text, whiteSpace: 'nowrap' }}>{c.name}</td>
                <td style={{ padding: '7px 12px', color: c.required ? C.text : C.faint, whiteSpace: 'nowrap' }}>{c.required ? 'required' : 'optional'}</td>
                <td style={{ padding: '7px 12px', color: C.faint }}>{c.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label style={labelStyle} htmlFor="sim-import-batch">Batch / delivery reference for this file (optional)</label>
        <input id="sim-import-batch" value={batch} onChange={(e) => setBatch(e.target.value)} style={inputStyle} maxLength={100}
          placeholder="Used for rows without their own batch_reference" autoComplete="off" />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
        style={{
          border: `1.5px dashed ${over ? 'var(--accent-green)' : 'var(--card-border)'}`, borderRadius: '10px', padding: '16px',
          backgroundColor: over ? 'var(--accent-green-dim)' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
        <input ref={input} id="sim-csv" type="file" accept=".csv,text/csv" style={{ display: 'none' }}
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
        Rows whose ICCID is already recorded are skipped. Phone numbers must be unique. In Excel, save as "CSV UTF-8".
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
          {busy ? <LoaderCircle size={15} /> : <FileUp size={15} />} {busy ? 'Importing…' : 'Import SIM cards'}
        </button>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ remove from stock */

const RemoveSimDialog: React.FC<{ sim: SimCardItem; onCancel: () => void; onDone: (message: string) => void }> = ({ sim, onCancel, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone((await removeSimCard(sim.simCardId)).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the SIM card.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Remove SIM card from stock?" busy={busy} onClose={onCancel} onSubmit={confirm} width={460}>
      <div style={{ fontSize: '13.5px', color: C.textSoft, lineHeight: 1.6 }}>
        SIM <span style={{ fontFamily: mono, color: C.text }}>{sim.iccid}</span> ({sim.phone}) will be deleted from the stock list.
        Use this for a SIM entered by mistake; it can be added again later.
      </div>
      {error && <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={buttonStyle('secondary', busy)}>Cancel</button>
        <button type="submit" disabled={busy} style={buttonStyle('danger', busy)}>
          {busy ? <LoaderCircle size={15} /> : <Trash2 size={15} />} Remove
        </button>
      </div>
    </Modal>
  );
};
