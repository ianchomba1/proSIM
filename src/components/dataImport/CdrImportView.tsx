import React, { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, FileSpreadsheet, LoaderCircle, TriangleAlert, Upload, X } from 'lucide-react';
import {
  DAILY_COLUMNS, EVENT_COLUMNS, ImportError, fetchImportHistory, uploadCdrFiles,
  type CdrImportRecord, type ImportMode, type ImportResponse,
} from '../../services/importApi';
import { C, buttonStyle, cardStyle, formatDay } from '../misuse/misuseTheme';

interface Props {
  /** users.id of the signed-in administrator, recorded on the import. */
  reviewerId?: string;
  /** Opens the Misuse Alerts section (after a scored import). */
  onViewAlerts?: () => void;
}

type Phase = { kind: 'idle' } | { kind: 'uploading'; fraction: number } | { kind: 'processing' }
  | { kind: 'done'; result: ImportResponse } | { kind: 'failed'; message: string; errors: string[] };

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const n = (v: number) => v.toLocaleString('en-GB');
const period = (from: string, to: string) =>
  from === to ? formatDay(to, true) : `${formatDay(from)} – ${formatDay(to, true)}`;
const formatSize = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
const formatDateTime = (iso: string) =>
  new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** One CSV picker: click to browse or drop a file on it. */
const FilePicker: React.FC<{
  id: string; title: string; hint: string; file: File | null; disabled: boolean; onChange: (f: File | null) => void;
}> = ({ id, title, hint, file, disabled, onChange }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (f: File | undefined | null) => onChange(f ?? null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files[0]); }}
      style={{
        flex: '1 1 280px', border: `1.5px dashed ${over ? 'var(--accent-green)' : 'var(--card-border)'}`, borderRadius: '12px',
        padding: '16px', backgroundColor: over ? 'var(--accent-green-dim)' : 'transparent', transition: 'all 0.15s ease',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
      <label htmlFor={id} style={{ fontSize: '13.5px', fontWeight: 700, color: C.text }}>{title}</label>
      <div style={{ fontSize: '12.5px', color: C.muted, lineHeight: 1.45 }}>{hint}</div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', backgroundColor: C.headRow }}>
          <FileSpreadsheet size={18} color="var(--accent-green)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '13px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            <div style={{ fontSize: '12px', color: C.faint }}>{formatSize(file.size)}</div>
          </div>
          <button type="button" onClick={() => { onChange(null); if (input.current) input.current.value = ''; }} disabled={disabled}
            aria-label={`Remove ${file.name}`} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={disabled}
          style={{ ...buttonStyle('secondary', disabled), justifyContent: 'center' }}>
          <Upload size={15} /> Choose CSV or drop it here
        </button>
      )}
      <input ref={input} id={id} type="file" accept=".csv,text/csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
};

/** Admin upload of CDR files for misuse detection, with the import history. */
export const CdrImportView: React.FC<Props> = ({ reviewerId, onViewAlerts }) => {
  const [dailyFile, setDailyFile] = useState<File | null>(null);
  const [eventsFile, setEventsFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [scoreAfter, setScoreAfter] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [history, setHistory] = useState<{ key: number; items: CdrImportRecord[]; error: string } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    let current = true;
    fetchImportHistory()
      .then((items) => { if (current) setHistory({ key: historyKey, items, error: '' }); })
      .catch((e: Error) => { if (current) setHistory({ key: historyKey, items: [], error: e.message }); });
    return () => { current = false; };
  }, [historyKey]);

  const busy = phase.kind === 'uploading' || phase.kind === 'processing';
  const ready = !!dailyFile && !!eventsFile && (mode === 'merge' || confirmReplace) && !busy;

  const start = async () => {
    if (!dailyFile || !eventsFile) return;
    setPhase({ kind: 'uploading', fraction: 0 });
    try {
      const result = await uploadCdrFiles({ dailyFile, eventsFile, mode, scoreAfter, importedBy: reviewerId },
        (fraction) => setPhase(fraction >= 1 ? { kind: 'processing' } : { kind: 'uploading', fraction }));
      setPhase({ kind: 'done', result });
      setDailyFile(null);
      setEventsFile(null);
      setConfirmReplace(false);
      setHistoryKey((k) => k + 1);
    } catch (e) {
      const err = e as ImportError;
      setPhase({ kind: 'failed', message: err.message, errors: err.errors ?? [] });
    }
  };

  const radio = (value: ImportMode, title: string, text: string) => (
    <label style={{
      flex: '1 1 260px', display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px',
      cursor: busy ? 'default' : 'pointer',
      border: `1px solid ${mode === value ? 'var(--accent-green)' : 'var(--card-border)'}`,
      backgroundColor: mode === value ? 'var(--accent-green-dim)' : 'transparent',
    }}>
      <input type="radio" name="import-mode" value={value} checked={mode === value} disabled={busy}
        onChange={() => { setMode(value); setConfirmReplace(false); }} style={{ marginTop: '3px', accentColor: 'var(--accent-green)' }} />
      <span>
        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: C.text }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12.5px', color: C.muted, marginTop: '2px', lineHeight: 1.45 }}>{text}</span>
      </span>
    </label>
  );

  const th: React.CSSProperties = { padding: '12px 16px' };
  const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' };

  const renderResult = () => {
    if (phase.kind === 'failed') {
      return (
        <div role="alert" style={{ ...cardStyle, padding: '16px 18px', borderColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--danger)', fontWeight: 700, fontSize: '14px' }}>
            <CircleAlert size={17} /> {phase.message}
          </div>
          {phase.errors.length > 0 && (
            <>
              <ul style={{ margin: '10px 0 0 0', paddingLeft: '22px', color: C.textSoft, fontSize: '13px', lineHeight: 1.6 }}>
                {phase.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
              <div style={{ marginTop: '8px', fontSize: '12.5px', color: C.muted }}>Fix the file and import it again.</div>
            </>
          )}
        </div>
      );
    }
    if (phase.kind !== 'done') return null;
    const r = phase.result.import;
    const s = phase.result.scoring;
    const notes = [...r.warnings, ...(phase.result.scoringError ? [phase.result.scoringError] : [])];
    return (
      <div role="status" style={{ ...cardStyle, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: C.text, fontWeight: 700, fontSize: '14px' }}>
          <CircleCheck size={17} color="var(--accent-green)" />
          Imported {n(r.simDays)} SIM-days for {n(r.sims)} SIMs, {period(r.dateFrom, r.dateTo)}
        </div>
        <div style={{ fontSize: '13px', color: C.textSoft, lineHeight: 1.6 }}>
          {n(r.simDaysAdded)} new and {n(r.simDaysUpdated)} updated SIM-days, {n(r.events)} calls and SMS.
          {s && (
            <> Checked for misuse: <strong>{n(s.alertsSaved)} alert days</strong> (High {n(s.alertCounts.High ?? 0)},
              Alert {n(s.alertCounts.Alert ?? 0)}, Review {n((s.alertCounts.Review ?? 0) + (s.alertCounts['Review (calls/SMS)'] ?? 0))}).</>
          )}
        </div>
        {notes.map((w) => (
          <div key={w} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', color: '#d97706' }}>
            <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {w}
          </div>
        ))}
        {s && onViewAlerts && (
          <div><button onClick={onViewAlerts} style={buttonStyle('secondary')}>View misuse alerts</button></div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>Data Import</h1>
        <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0 0', maxWidth: '680px' }}>
          Upload call detail records (CDRs) from your operator so the misuse models can check them. Both files are needed:
          daily usage per SIM, and the individual calls and SMS.
        </p>
      </div>

      {/* Upload form */}
      <div style={{ ...cardStyle, padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <FilePicker id="daily-file" title="1. Daily usage (CSV)" file={dailyFile} onChange={setDailyFile} disabled={busy}
            hint="One row per SIM per day: data used, sessions, hotspot, towers, billing, call minutes and SMS count." />
          <FilePicker id="events-file" title="2. Calls and SMS (CSV)" file={eventsFile} onChange={setEventsFile} disabled={busy}
            hint="One row per call or SMS: time, duration and number. Rows for data sessions are ignored." />
        </div>

        <details style={{ fontSize: '12.5px', color: C.muted }}>
          <summary style={{ cursor: 'pointer', color: C.textSoft, fontWeight: 600 }}>Required columns</summary>
          <div style={{ marginTop: '8px', lineHeight: 1.6 }}>
            <div><strong style={{ color: C.textSoft }}>Daily usage:</strong> <span style={{ fontFamily: mono }}>{DAILY_COLUMNS.join(', ')}</span></div>
            <div style={{ marginTop: '4px' }}><strong style={{ color: C.textSoft }}>Calls and SMS:</strong> <span style={{ fontFamily: mono }}>{EVENT_COLUMNS.join(', ')}</span></div>
            <div style={{ marginTop: '4px' }}>
              Dates as YYYY-MM-DD, times as YYYY-MM-DD HH:MM:SS, <span style={{ fontFamily: mono }}>event_type</span> Voice, SMS or Data.
              Extra columns are ignored. This is the format the CDR generator produces.
            </div>
          </div>
        </details>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {radio('merge', 'Add or update (recommended)', 'New days are added. Days already stored for a SIM are replaced by the file, including their calls and SMS.')}
          {radio('replace', 'Replace all usage data', 'Deletes all stored usage and call records first, then imports the files. Existing alerts and reviews are kept.')}
        </div>
        {mode === 'replace' && (
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--danger)', cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} disabled={busy}
              style={{ marginTop: '2px', accentColor: 'var(--danger)' }} />
            I understand that all stored usage data and call records will be deleted and replaced by these files.
          </label>
        )}

        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: C.textSoft, cursor: 'pointer' }}>
          <input type="checkbox" checked={scoreAfter} onChange={(e) => setScoreAfter(e.target.checked)} disabled={busy}
            style={{ accentColor: 'var(--accent-green)' }} />
          Check the imported days for misuse straight away (about 30 seconds per week of data for 1,000 SIMs)
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button onClick={start} disabled={!ready} style={buttonStyle('primary', !ready)}>
            {busy ? <LoaderCircle size={16} /> : <Upload size={16} />} {busy ? 'Importing…' : 'Import files'}
          </button>
          {phase.kind === 'uploading' && (
            <div style={{ flex: '1 1 240px', maxWidth: '420px' }} aria-live="polite">
              <div style={{ fontSize: '12.5px', color: C.muted, marginBottom: '4px' }}>Uploading… {Math.round(phase.fraction * 100)}%</div>
              <div role="progressbar" aria-valuenow={Math.round(phase.fraction * 100)} aria-valuemin={0} aria-valuemax={100}
                style={{ height: '6px', borderRadius: '999px', backgroundColor: C.headRow, overflow: 'hidden' }}>
                <div style={{ width: `${phase.fraction * 100}%`, height: '100%', backgroundColor: 'var(--accent-green)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          )}
          {phase.kind === 'processing' && (
            <span style={{ fontSize: '13px', color: C.muted }} aria-live="polite">
              Uploaded. Checking and importing the records{scoreAfter ? ', then checking them for misuse' : ''}… please keep this page open.
            </span>
          )}
        </div>
      </div>

      {renderResult()}

      {/* History */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.rowBorder}`, fontSize: '15px', fontWeight: 700, color: C.text }}>
          Import history
        </div>
        {history?.error && <div style={{ padding: '14px 16px', color: 'var(--danger)', fontSize: '13px' }}>{history.error}</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: C.headRow, color: C.faint, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                <th style={th}>Imported</th>
                <th style={th}>Files</th>
                <th style={th}>Mode</th>
                <th style={th}>Period</th>
                <th style={{ ...th, textAlign: 'right' }}>SIM-days</th>
                <th style={{ ...th, textAlign: 'right' }}>Calls/SMS</th>
                <th style={{ ...th, textAlign: 'right' }}>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {!history ? (
                <tr><td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', color: C.faint }}>Loading…</td></tr>
              ) : history.items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', color: C.faint }}>No files imported from the dashboard yet.</td></tr>
              ) : history.items.map((h, i) => (
                <tr key={h.importId} style={{ borderTop: i ? `1px solid ${C.rowBorder}` : 'none' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ color: C.text }}>{formatDateTime(h.importedAt)}</div>
                    <div style={{ color: C.faint, fontSize: '12px' }}>{h.importedByName ?? 'Unknown user'}</div>
                  </td>
                  <td style={{ ...td, color: C.textSoft, fontSize: '12.5px' }}>
                    <div>{h.dailyFileName}</div><div>{h.eventsFileName}</div>
                  </td>
                  <td style={{ ...td, color: C.textSoft }}>{h.mode === 'Merge' ? 'Add or update' : 'Replace all'}</td>
                  <td style={{ ...td, color: C.textSoft, whiteSpace: 'nowrap' }}>{period(h.dateFrom, h.dateTo)}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.textSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <div style={{ color: C.text }}>{n(h.simDays)}</div>
                    <div style={{ fontSize: '12px', color: C.faint }}>{n(h.simDaysAdded)} new · {n(h.simDaysUpdated)} updated</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: C.textSoft, fontVariantNumeric: 'tabular-nums' }}>{n(h.events)}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.textSoft, fontVariantNumeric: 'tabular-nums' }}>
                    {h.alertsSaved === null ? <span style={{ color: C.faint }}>not checked</span> : n(h.alertsSaved)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
