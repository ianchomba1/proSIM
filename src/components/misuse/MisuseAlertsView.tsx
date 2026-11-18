import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import {
  ALERT_LEVELS, fetchMisuseCases, fetchMisuseSummary, misuseTypeLabel, runMisuseScoring,
  type MisuseCase, type MisuseSummary,
} from '../../services/misuseApi';
import { MisuseCaseDetail } from './MisuseCaseDetail';
import { LevelBadge, StatusBadge } from './MisuseBadges';
import {
  C, LEVEL_STYLE, addDays, buttonStyle, cardStyle, formatDay, formatPct, formatPeriod, selectStyle,
} from './misuseTheme';

interface Props {
  reviewerId?: string;
}

const PAGE_SIZE = 20;
const WINDOWS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

/** Admin view of misuse alerts, grouped into cases (consecutive alert days on one SIM). */
export const MisuseAlertsView: React.FC<Props> = ({ reviewerId }) => {
  const [summary, setSummary] = useState<MisuseSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState('Open');
  const [level, setLevel] = useState('');
  const [type, setType] = useState('');
  const [windowDays, setWindowDays] = useState(30);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MisuseCase | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [result, setResult] = useState<{ key: string; items: MisuseCase[]; error: string }>({ key: '', items: [], error: '' });

  // Summary (re)loads when refreshKey changes: after scoring and after a review.
  useEffect(() => {
    let current = true;
    fetchMisuseSummary()
      .then((s) => { if (current) { setSummary(s); setSummaryError(''); } })
      .catch((e: Error) => { if (current) setSummaryError(e.message); });
    return () => { current = false; };
  }, [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Cases for the current filters. State is only set when a request finishes; stale results are ignored.
  const lastDay = summary?.lastScoredDay ?? null;
  const from = lastDay ? addDays(lastDay, -(windowDays - 1)) : '';
  const queryKey = lastDay ? JSON.stringify({ status, level, type, from, lastDay, refreshKey }) : '';
  useEffect(() => {
    if (!lastDay) return;
    let current = true;
    fetchMisuseCases({ status, level, type, from, to: lastDay })
      .then((r) => { if (current) setResult({ key: queryKey, items: r.items, error: '' }); })
      .catch((e: Error) => { if (current) setResult({ key: queryKey, items: [], error: e.message }); });
    return () => { current = false; };
  }, [queryKey, lastDay, status, level, type, from]);

  const loading = !summary && !summaryError ? true : !!lastDay && result.key !== queryKey;
  const error = summaryError || result.error;
  const cases = result.items;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? cases.filter((c) => c.simRef.toLowerCase().includes(q)) : cases;
  }, [cases, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const setFilter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { set(e.target.value); setPage(1); };

  const typeOptions = useMemo(() => {
    const fromModel = summary?.model?.misuse_types ?? [];
    return Array.from(new Set([...fromModel, 'unusual data use', 'unusual calling/SMS']));
  }, [summary]);

  const handleRun = async () => {
    setRunning(true);
    setRunMessage('');
    try {
      const r = await runMisuseScoring();
      setRunMessage(`Scored ${formatDay(r.to, true)}: ${r.sims} SIMs, ${r.alertsSaved} alert(s) in ${Math.round(r.seconds)}s.`);
      refresh();
    } catch (e) {
      setRunMessage((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (selected) {
    return (
      <MisuseCaseDetail
        misuseCase={selected}
        reviewerId={reviewerId}
        onBack={() => setSelected(null)}
        onReviewed={refresh}
      />
    );
  }

  const th: React.CSSProperties = { padding: '14px 18px' };
  const td: React.CSSProperties = { padding: '14px 18px', verticalAlign: 'top' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0 }}>Misuse Alerts</h1>
          <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0 0' }}>
            {summary?.usageData
              ? <>Usage data {formatDay(summary.usageData.from)} – {formatDay(summary.usageData.to, true)} for {summary.usageData.sims.toLocaleString()} SIMs
                  {lastDay && <> · scored up to {formatDay(lastDay, true)}</>}
                  {summary.model && <> · model {summary.model.model_version}</>}</>
              : 'SIM-days flagged by the misuse-detection models, grouped into cases.'}
          </p>
          {summary && !summary.model && (
            <p style={{ fontSize: '12.5px', color: '#fbbf24', margin: '4px 0 0 0' }}>
              The ML service is not reachable, so new days cannot be scored. Existing alerts are still shown.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button onClick={handleRun} disabled={running || !summary?.usageData} style={buttonStyle('primary', running || !summary?.usageData)}>
            {running ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}
            {running ? 'Scoring…' : 'Score latest day'}
          </button>
          {runMessage && <span style={{ fontSize: '12px', color: C.muted, maxWidth: '320px', textAlign: 'right' }}>{runMessage}</span>}
        </div>
      </div>

      {/* Summary tiles: open alert days by level */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
        {ALERT_LEVELS.map((l) => {
          const s = LEVEL_STYLE[l];
          const active = level === l;
          return (
            <button key={l} onClick={() => { setLevel(active ? '' : l); setPage(1); }} title={s.hint}
              style={{
                ...cardStyle, padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                border: `1px solid ${active ? s.border : C.cardBorder}`, display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: s.color, fontSize: '12.5px', fontWeight: 600 }}>
                <s.Icon size={15} /> {l}
              </span>
              <span style={{ fontSize: '26px', fontWeight: 700, color: C.text, lineHeight: 1.1 }}>
                {(summary?.openByLevel[l] ?? 0).toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: C.faint }}>open alert days · {s.hint.toLowerCase()}</span>
            </button>
          );
        })}
      </div>
      {summary && (
        <div style={{ fontSize: '12.5px', color: C.faint, marginTop: '-12px' }}>
          Reviewed so far: {summary.byStatus.Confirmed.toLocaleString()} confirmed misuse, {summary.byStatus.FalseAlarm.toLocaleString()} false alarm alert days.
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '300px' }}>
          <Search size={16} color={C.faint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search SIM, e.g. SIM-0087" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', padding: '9px 14px 9px 36px', color: C.text, cursor: 'text' }} />
        </div>
        <select value={status} onChange={setFilter(setStatus)} style={selectStyle}>
          <option value="Open">Status: Open</option>
          <option value="Confirmed">Status: Confirmed misuse</option>
          <option value="FalseAlarm">Status: False alarm</option>
          <option value="">Status: All</option>
        </select>
        <select value={level} onChange={setFilter(setLevel)} style={selectStyle}>
          <option value="">Level: All</option>
          {ALERT_LEVELS.map((l) => <option key={l} value={l}>Level: {l}</option>)}
        </select>
        <select value={type} onChange={setFilter(setType)} style={selectStyle}>
          <option value="">Type: All</option>
          {typeOptions.map((t) => <option key={t} value={t}>Type: {misuseTypeLabel(t)}</option>)}
        </select>
        <select value={windowDays} onChange={(e) => { setWindowDays(Number(e.target.value)); setPage(1); }} style={selectStyle}>
          {WINDOWS.map((w) => <option key={w.days} value={w.days}>{w.label}</option>)}
        </select>
      </div>

      {error && <div style={{ ...cardStyle, padding: '16px', color: '#f87171' }}>{error}</div>}

      {/* Case table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid #172235`, backgroundColor: C.headRow, color: C.faint, fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                <th style={th}>SIM</th>
                <th style={th}>Level</th>
                <th style={th}>Misuse type</th>
                <th style={th}>Period</th>
                <th style={th}>What stands out</th>
                <th style={{ ...th, textAlign: 'right' }}>Confidence</th>
                <th style={th}>Status</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>Loading cases…</td></tr>
              ) : !summary?.usageData ? (
                <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>
                  No usage data yet. Import CDRs with <code>dotnet run -- import-cdr &lt;folder&gt;</code>, then score them.
                </td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: C.faint }}>No cases match these filters.</td></tr>
              ) : shown.map((c, i) => (
                <tr key={`${c.simRef}-${c.startDate}`}
                  onClick={() => setSelected(c)}
                  style={{ borderBottom: i < shown.length - 1 ? `1px solid ${C.rowBorder}` : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(24, 35, 55, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <td style={{ ...td, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: C.text, whiteSpace: 'nowrap' }}>{c.simRef}</td>
                  <td style={td}><LevelBadge level={c.alertLevel} /></td>
                  <td style={{ ...td, color: C.textSoft }}>{c.misuseTypes.map(misuseTypeLabel).join(', ')}</td>
                  <td style={{ ...td, color: C.textSoft, whiteSpace: 'nowrap' }}>
                    {formatPeriod(c.startDate, c.endDate)}
                    <div style={{ color: C.faint, fontSize: '12px', marginTop: '2px' }}>{c.alertDays} alert day{c.alertDays === 1 ? '' : 's'}</div>
                  </td>
                  <td style={{ ...td, color: C.muted, fontSize: '13px', maxWidth: '340px' }}>{c.signals[0] ?? 'Overall pattern unusual'}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.textSoft, fontVariantNumeric: 'tabular-nums' }}>{formatPct(c.maxConfidence)}</td>
                  <td style={td}><StatusBadge status={c.status} /></td>
                  <td style={{ ...td, color: C.faint }}><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: `1px solid ${C.rowBorder}`, fontSize: '13px', color: C.muted }}>
          <span>
            {filtered.length.toLocaleString()} case{filtered.length === 1 ? '' : 's'}
            {lastDay && ` between ${formatDay(addDays(lastDay, -(windowDays - 1)))} and ${formatDay(lastDay, true)}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} style={{ ...buttonStyle('secondary', currentPage <= 1), padding: '6px 10px' }} aria-label="Previous page">
              <ChevronLeft size={15} />
            </button>
            <span>Page {currentPage} of {pages}</span>
            <button onClick={() => setPage(Math.min(pages, currentPage + 1))} disabled={currentPage >= pages} style={{ ...buttonStyle('secondary', currentPage >= pages), padding: '6px 10px' }} aria-label="Next page">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
