import React, { useEffect, useMemo, useState } from 'react';
import { CircleCheck, CircleX, Clock, LoaderCircle, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  approveApplicationApi, fetchApplicationsApi, rejectApplicationApi,
  type ApplicationItem, type ApplicationStatus,
} from '../../services/api';
import { C, buttonStyle, cardStyle, selectStyle } from '../misuse/misuseTheme';
import { fetchSimCards, type SimCardItem } from '../../services/simCardsApi';

interface Props {
  /** users.id of the signed-in administrator, recorded as the reviewer. */
  reviewerId?: string;
}

const STATUS_STYLE: Record<ApplicationStatus, { color: string; Icon: LucideIcon; label: string }> = {
  Pending: { color: '#fbbf24', Icon: Clock, label: 'Pending' },
  Approved: { color: 'var(--accent-green)', Icon: CircleCheck, label: 'Approved' },
  Rejected: { color: 'var(--danger)', Icon: CircleX, label: 'Rejected' },
};
const TABS: (ApplicationStatus | 'All')[] = ['Pending', 'Approved', 'Rejected', 'All'];
const mono = "'JetBrains Mono', 'Fira Code', monospace";

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const StatusBadge: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: s.color, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <s.Icon size={14} /> {s.label}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text', color: C.text, fontFamily: 'inherit',
};

/** Admin review of SIM applications: approving issues the SIM card and registers the applicant as a subscriber. */
export const ApplicationsView: React.FC<Props> = ({ reviewerId }) => {
  const [result, setResult] = useState<{ key: number; items: ApplicationItem[]; error: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<ApplicationStatus | 'All'>('Pending');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject'; app: ApplicationItem } | null>(null);
  const [banner, setBanner] = useState('');

  // State is only set when the request finishes; a newer request makes an older one's result ignored.
  useEffect(() => {
    let current = true;
    fetchApplicationsApi()
      .then((items) => { if (current) setResult({ key: refreshKey, items, error: '' }); })
      .catch((e: Error) => { if (current) setResult({ key: refreshKey, items: [], error: e.message }); });
    return () => { current = false; };
  }, [refreshKey]);

  const loading = result?.key !== refreshKey;
  const all = useMemo(() => result?.items ?? [], [result]);
  const counts = useMemo(() => ({
    Pending: all.filter((a) => a.applicationStatus === 'Pending').length,
    Approved: all.filter((a) => a.applicationStatus === 'Approved').length,
    Rejected: all.filter((a) => a.applicationStatus === 'Rejected').length,
    All: all.length,
  }), [all]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((a) => tab === 'All' || a.applicationStatus === tab)
      .filter((a) => !q || [a.fullName, a.institutionalId, a.nationalIdNumber, a.department, a.contactPhone, a.iccid, a.simPhone]
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>SIM Applications</h1>
          <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0 0', maxWidth: '640px' }}>
            Customers whose National ID has been verified. Approving an application issues the SIM card and registers the customer as a subscriber.
          </p>
        </div>
        <button onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={buttonStyle('secondary', loading)}>
          {loading ? <LoaderCircle size={16} /> : <RefreshCw size={16} />} Refresh
        </button>
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

      {/* Status tabs + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div role="tablist" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                {t}
                <span style={{ fontSize: '12px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{counts[t]}</span>
              </button>
            );
          })}
        </div>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px', marginLeft: 'auto' }}>
          <Search size={16} color={C.faint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search name, ID, phone, ICCID" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, padding: '9px 14px 9px 36px' }} />
        </div>
      </div>

      {result?.error && <div style={{ ...cardStyle, padding: '16px', color: 'var(--danger)' }}>{result.error}</div>}

      {/* Applications table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.rowBorder}`, backgroundColor: C.headRow, color: C.faint, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                <th style={th}>Applicant</th>
                <th style={th}>Department</th>
                <th style={th}>National ID</th>
                <th style={th}>Submitted</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>{tab === 'Pending' ? 'Decision' : 'Outcome'}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !result ? (
                <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>Loading applications…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>
                  {tab === 'Pending' && !search ? 'No applications waiting for approval.' : 'No applications match.'}
                </td></tr>
              ) : shown.map((a, i) => (
                <tr key={a.applicationId} style={{ borderBottom: i < shown.length - 1 ? `1px solid ${C.rowBorder}` : 'none' }}>
                  <td style={td}>
                    <div style={{ color: C.text, fontWeight: 600 }}>{a.fullName}</div>
                    <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>{a.institutionalId} · {a.contactPhone}</div>
                  </td>
                  <td style={{ ...td, color: C.textSoft }}>{a.department}</td>
                  <td style={td}>
                    <div style={{ color: C.text, fontFamily: mono, fontSize: '13px' }}>{a.nationalIdNumber ?? '—'}</div>
                    {a.idVerifiedAt ? (
                      <div title={`Verified ${formatDateTime(a.idVerifiedAt)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-green)', fontSize: '12px', marginTop: '3px', whiteSpace: 'nowrap' }}>
                        <ShieldCheck size={13} /> ID verified
                      </div>
                    ) : (
                      <div style={{ color: C.faint, fontSize: '12px', marginTop: '3px' }}>Not verified</div>
                    )}
                  </td>
                  <td style={{ ...td, color: C.textSoft, whiteSpace: 'nowrap' }}>{formatDateTime(a.submissionDate)}</td>
                  <td style={td}><StatusBadge status={a.applicationStatus} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {a.applicationStatus === 'Pending' ? (
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => setDialog({ kind: 'approve', app: a })} style={{ ...buttonStyle('primary'), padding: '7px 14px' }}>
                          <CircleCheck size={15} /> Approve
                        </button>
                        <button onClick={() => setDialog({ kind: 'reject', app: a })} style={{ ...buttonStyle('secondary'), padding: '7px 14px' }}>
                          <CircleX size={15} /> Reject
                        </button>
                      </div>
                    ) : a.applicationStatus === 'Approved' ? (
                      <div style={{ fontSize: '12.5px', color: C.textSoft }}>
                        <div style={{ fontFamily: mono, color: C.text }}>{a.iccid ?? '—'}</div>
                        <div>{a.simPhone} · SIM {a.simStatus?.toLowerCase()}</div>
                        <div style={{ color: C.faint }}>{a.reviewedByName ? `by ${a.reviewedByName}, ` : ''}{formatDateTime(a.reviewDate)}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12.5px', color: C.textSoft, maxWidth: '260px', marginLeft: 'auto' }}>
                        <div>“{a.remarks}”</div>
                        <div style={{ color: C.faint }}>{a.reviewedByName ? `by ${a.reviewedByName}, ` : ''}{formatDateTime(a.reviewDate)}</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <ReviewDialog kind={dialog.kind} app={dialog.app} reviewerId={reviewerId}
          onCancel={() => setDialog(null)} onDone={onDone} />
      )}
    </div>
  );
};

interface DialogProps {
  kind: 'approve' | 'reject';
  app: ApplicationItem;
  reviewerId?: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}

const ReviewDialog: React.FC<DialogProps> = ({ kind, app, reviewerId, onCancel, onDone }) => {
  const [iccid, setIccid] = useState('');   // '' = the SIM that has been in stock longest
  const [stock, setStock] = useState<{ items: SimCardItem[]; error: string } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const approve = kind === 'approve';
  const legacySim = approve && !!app.iccid;   // applied before approval existed: a SIM was already created

  // SIM cards in stock, oldest first (the order approval uses when none is picked).
  useEffect(() => {
    if (!approve || legacySim) return;
    let current = true;
    fetchSimCards()
      .then((all) => {
        if (!current) return;
        const items = all.filter((s) => s.status === 'InStock')
          .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.iccid.localeCompare(b.iccid));
        setStock({ items, error: '' });
      })
      .catch((e: Error) => { if (current) setStock({ items: [], error: e.message }); });
    return () => { current = false; };
  }, [approve, legacySim]);
  const stockLoading = approve && !legacySim && stock === null;
  const noStock = approve && !legacySim && !!stock && !stock.error && stock.items.length === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approve && remarks.trim().length < 3) {
      setError('Give a reason for rejecting this application.');
      return;
    }
    setSaving(true);
    setError('');
    const res = approve
      ? await approveApplicationApi(app.applicationId, { iccid, phone: '', remarks: remarks.trim(), reviewerUserId: reviewerId })
      : await rejectApplicationApi(app.applicationId, remarks.trim(), reviewerId);
    setSaving(false);
    if (res.success) onDone(approve ? res.message : `Rejected ${app.fullName}'s application.`);
    else setError(res.message);
  };

  const label: React.CSSProperties = { fontSize: '12.5px', fontWeight: 600, color: C.textSoft, display: 'block', marginBottom: '6px' };
  const hint: React.CSSProperties = { fontSize: '12px', color: C.faint, marginTop: '4px' };

  return (
    <div onClick={() => !saving && onCancel()} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50,
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}
        style={{ ...cardStyle, backgroundColor: 'var(--card-bg-elevated, var(--card-bg))', width: '100%', maxWidth: '480px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 id="review-title" style={{ margin: 0, fontSize: '18px', color: C.text }}>
              {approve ? 'Approve and issue SIM card' : 'Reject application'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: C.muted }}>
              {app.fullName} · {app.institutionalId} · {app.department}
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Close"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        {approve && (legacySim ? (
          <div style={{ fontSize: '13px', color: C.textSoft, lineHeight: 1.5 }}>
            This application already has SIM <span style={{ fontFamily: mono }}>{app.iccid}</span> ({app.simPhone}).
            Approving activates it and confirms {app.fullName} as a subscriber.
          </div>
        ) : (
          <>
            <div style={{ fontSize: '13px', color: C.textSoft, lineHeight: 1.5 }}>
              A SIM card from stock will be issued and {app.fullName} registered as a subscriber.
            </div>
            <div>
              <label style={label} htmlFor="stock-sim">SIM card to issue</label>
              {stockLoading ? (
                <div style={{ ...hint, display: 'flex', alignItems: 'center', gap: '6px' }}><LoaderCircle size={14} /> Loading SIM stock…</div>
              ) : stock?.error ? (
                <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>Could not load SIM stock: {stock.error}</div>
              ) : noStock ? (
                <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)', lineHeight: 1.5 }}>
                  There are no SIM cards in stock. Add the SIMs received from the operator on the SIM Cards page, then approve.
                </div>
              ) : (
                <>
                  <select id="stock-sim" value={iccid} onChange={(e) => setIccid(e.target.value)} style={{ ...selectStyle, width: '100%', fontFamily: mono }}>
                    <option value="">Next in stock: {stock?.items[0]?.iccid} ({stock?.items[0]?.phone})</option>
                    {stock?.items.map((s) => (
                      <option key={s.simCardId} value={s.iccid}>
                        {s.iccid} · {s.phone}{s.batchReference ? ` · ${s.batchReference}` : ''}
                      </option>
                    ))}
                  </select>
                  <div style={hint}>{stock?.items.length} in stock. Pick the SIM you are handing over, or leave the oldest one selected.</div>
                </>
              )}
            </div>
          </>
        ))}

        <div>
          <label style={label} htmlFor="remarks">{approve ? 'Remarks (optional)' : 'Reason for rejecting'}</label>
          <textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} maxLength={1000}
            placeholder={approve ? 'e.g. checked against staff records' : 'e.g. institutional ID not found in staff records'}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onCancel} disabled={saving} style={buttonStyle('secondary', saving)}>Cancel</button>
          <button type="submit" disabled={saving || stockLoading || noStock || !!stock?.error}
            style={buttonStyle(approve ? 'primary' : 'danger', saving || stockLoading || noStock || !!stock?.error)}>
            {saving ? <LoaderCircle size={15} /> : approve ? <CircleCheck size={15} /> : <CircleX size={15} />}
            {approve ? 'Approve and issue SIM' : 'Reject application'}
          </button>
        </div>
      </form>
    </div>
  );
};
