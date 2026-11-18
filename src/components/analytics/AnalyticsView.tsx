import React, { useEffect, useMemo, useState } from 'react';
import { CircleCheck, CircleDashed, CircleX, Clock, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import {
  fetchMisuseAnalytics, fetchOperationsAnalytics,
  type MisuseAnalytics, type OperationsAnalytics, type EmployeeSimStatus,
} from '../../services/analyticsApi';
import { ALERT_LEVELS, misuseTypeLabel, type AlertLevel } from '../../services/misuseApi';
import { C, LEVEL_STYLE, addDays, buttonStyle, cardStyle, formatDay, formatPeriod, selectStyle } from '../misuse/misuseTheme';
import { LevelBadge } from '../misuse/MisuseBadges';
import {
  BulletList, ChartCard, ColumnChart, HBarList, SegmentedBar, StatTile, type BulletRow, type Part,
} from './charts';
import { VIZ, fmtNum, type Series } from './vizTheme';
import { useIsMobile } from '../../hooks/useMediaQuery';

const PERIODS = [
  { weeks: 4, label: 'Last 4 weeks' },
  { weeks: 13, label: 'Last 13 weeks' },
  { weeks: 26, label: 'Last 26 weeks' },
  { weeks: 0, label: 'All time' },
];

// ---------------------------------------------------------------- helpers

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

function duration(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

function mondayOf(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day + 6) % 7));
}

const maxIso = (a: string, b: string) => (a > b ? a : b);
const minIso = (a: string, b: string) => (a < b ? a : b);

/** Tooltip title for a week bucket, clipped to the range shown. */
const weekTitle = (start: string, from: string, to: string) => formatPeriod(maxIso(start, from), minIso(addDays(start, 6), to));

// Review and Review (calls/SMS) share a colour on the Alerts page, so the stacked chart merges them
// (the table view keeps them apart).
const TREND_SERIES: Series[] = [
  { key: 'High', label: 'High', color: LEVEL_STYLE.High.color, Icon: LEVEL_STYLE.High.Icon },
  { key: 'Alert', label: 'Alert', color: LEVEL_STYLE.Alert.color, Icon: LEVEL_STYLE.Alert.Icon },
  { key: 'Review', label: 'Review (data or calls/SMS)', color: LEVEL_STYLE.Review.color, Icon: LEVEL_STYLE.Review.Icon },
];

const DECISION_SERIES: Series[] = [
  { key: 'approved', label: 'Approved', color: 'var(--success)', Icon: CircleCheck },
  { key: 'rejected', label: 'Rejected', color: 'var(--danger)', Icon: CircleX },
];

const STOCK_FLOW_SERIES: Series[] = [
  { key: 'received', label: 'Received from operator', color: VIZ.blue },
  { key: 'issued', label: 'Issued to employees', color: VIZ.orange },
];

const EMPLOYEE_PARTS: Record<EmployeeSimStatus, Omit<Part, 'value'>> = {
  NotApplied: { key: 'NotApplied', label: 'Not applied', color: VIZ.neutral, Icon: CircleDashed },
  Pending: { key: 'Pending', label: 'Pending', color: 'var(--warning)', Icon: Clock, textOnFill: '#0b0b0b' },
  Approved: { key: 'Approved', label: 'Approved', color: 'var(--success)', Icon: CircleCheck },
  Rejected: { key: 'Rejected', label: 'Rejected', color: 'var(--danger)', Icon: CircleX },
};

const grid = (min: number): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap: 16,
});

const SectionHead: React.FC<{ title: string; range?: string; note?: React.ReactNode }> = ({ title, range, note }) => (
  <div style={{ margin: '30px 0 14px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h2>
      {range && <span style={{ fontSize: 12.5, color: C.muted }}>{range}</span>}
    </div>
    {note && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{note}</div>}
  </div>
);

const Notice: React.FC<{ tone?: 'info' | 'warning'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const Icon = tone === 'warning' ? TriangleAlert : Info;
  return (
    <div role={tone === 'warning' ? 'alert' : undefined} style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, fontSize: 13,
      color: C.textSoft, marginBottom: 16, lineHeight: 1.45,
      border: `1px solid ${tone === 'warning' ? 'var(--warning)' : C.cardBorder}`,
      backgroundColor: tone === 'warning' ? 'rgba(245, 158, 11, 0.08)' : 'var(--card-bg-elevated)',
    }}>
      <Icon size={16} color={tone === 'warning' ? 'var(--warning)' : C.muted} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------- page

export const AnalyticsView: React.FC = () => {
  const [weeks, setWeeks] = useState(13);
  const [department, setDepartment] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useIsMobile();

  const [misuse, setMisuse] = useState<MisuseAnalytics | null>(null);
  const [misuseLoading, setMisuseLoading] = useState(true);
  const [misuseError, setMisuseError] = useState<string | null>(null);
  const [ops, setOps] = useState<OperationsAnalytics | null>(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchMisuseAnalytics(weeks)
      .then((m) => { if (current) { setMisuse(m); setMisuseError(null); } })
      .catch((e: Error) => { if (current) setMisuseError(e.message); })
      .finally(() => { if (current) setMisuseLoading(false); });
    return () => { current = false; };
  }, [weeks, refreshKey]);

  useEffect(() => {
    let current = true;
    fetchOperationsAnalytics(weeks, department)
      .then((o) => { if (current) { setOps(o); setOpsError(null); } })
      .catch((e: Error) => { if (current) setOpsError(e.message); })
      .finally(() => { if (current) setOpsLoading(false); });
    return () => { current = false; };
  }, [weeks, department, refreshKey]);

  const changeWeeks = (w: number) => { setWeeks(w); setMisuseLoading(true); setOpsLoading(true); };
  const changeDepartment = (d: string) => { setDepartment(d); setOpsLoading(true); };
  const refresh = () => { setRefreshKey((k) => k + 1); setMisuseLoading(true); setOpsLoading(true); };

  return (
    <div style={{ paddingBottom: 48, maxWidth: 1400 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.5px' }}>Analytics</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: C.muted, maxWidth: 820 }}>
          Misuse trends, how the detection model is doing on reviewed alerts, and SIM and employee operations.
        </p>
      </div>

      {/* One filter row for the whole page */}
      <div style={{ ...cardStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        ...(isMobile ? {} : { position: 'sticky', top: 0, zIndex: 10 }) }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}>
          Period
          <select value={weeks} onChange={(e) => changeWeeks(Number(e.target.value))} style={selectStyle} aria-label="Period">
            {PERIODS.map((p) => <option key={p.weeks} value={p.weeks}>{p.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}>
          Department
          <select value={department} onChange={(e) => changeDepartment(e.target.value)} style={selectStyle} aria-label="Department">
            <option value="">All departments</option>
            {(ops?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 12, color: C.muted, flex: 1, minWidth: 220 }}>
          Misuse figures count back from the latest scored day; operations count back from today.
          Department applies to operations only.
        </span>
        <button type="button" onClick={refresh} style={buttonStyle('secondary', misuseLoading || opsLoading)}
          disabled={misuseLoading || opsLoading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <MisuseSections data={misuse} loading={misuseLoading} error={misuseError} />
      <OperationsSection data={ops} loading={opsLoading} error={opsError} />
    </div>
  );
};

// ---------------------------------------------------------------- 1 + 2: misuse and model

const MisuseSections: React.FC<{ data: MisuseAnalytics | null; loading: boolean; error: string | null }> = ({ data, loading, error }) => {
  const trend = useMemo(() => {
    if (!data?.hasData || !data.range || !data.daily) return null;
    const { from, to } = data.range;
    const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    const weekly = spanDays > 35;
    const keys: string[] = [];
    for (let d = weekly ? mondayOf(from) : from; d <= to; d = addDays(d, weekly ? 7 : 1)) keys.push(d);
    const index = new Map(keys.map((k, i) => [k, i]));
    const perLevel = Object.fromEntries(ALERT_LEVELS.map((l) => [l, keys.map(() => 0)])) as Record<AlertLevel, number[]>;
    for (const r of data.daily) {
      const i = index.get(weekly ? mondayOf(r.date) : r.date);
      if (i !== undefined && perLevel[r.level]) perLevel[r.level][i] += r.count;
    }
    const review = perLevel.Review.map((v, i) => v + perLevel['Review (calls/SMS)'][i]);
    // Days in the last weekly bucket when it is cut short by the latest scored day (0 = full week)
    const lastDays = weekly ? Math.round((Date.parse(to) - Date.parse(keys[keys.length - 1])) / 86_400_000) + 1 : 7;
    return {
      weekly, keys, perLevel, partialDays: lastDays < 7 ? lastDays : 0,
      values: [perLevel.High, perLevel.Alert, review],
      titles: keys.map((k) => (weekly ? weekTitle(k, from, to) : formatDay(k, true))),
      ticks: keys.map((k) => formatDay(maxIso(k, from))),
    };
  }, [data]);

  if (!data) {
    return error ? <Notice tone="warning">{error}</Notice>
      : <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13.5 }}>Loading analytics…</div>;
  }

  const body = (() => {
    if (!data.hasData || !data.totals || !data.range || !trend) {
      return <Notice>No misuse alerts yet. Run scoring on the Misuse Alerts page and the trends will appear here.</Notice>;
    }
    const t = data.totals;
    const review = data.review!;
    const test = data.model?.testResults ?? null;
    const currentVersion = data.model?.modelVersion ?? null;
    const reviewedAny = t.confirmed + t.falseAlarm > 0;
    const olderVersions = (data.modelVersionsInAlerts ?? []).filter((v) => v !== currentVersion);

    const levelRows: BulletRow[] = (data.byLevel ?? []).map((l) => {
      const st = LEVEL_STYLE[l.level];
      const testLevel = test?.alert_levels?.[l.level];
      return {
        key: l.level,
        label: <><st.Icon size={14} color={st.color} aria-hidden />{l.level}</>,
        live: l.livePrecision,
        test: testLevel ? testLevel['real misuse (%)'] / 100 : null,
        tooltip: (
          <>
            <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>{l.level} — {st.hint}</div>
            <div>{fmtNum(l.total)} alert days: {fmtNum(l.confirmed)} confirmed, {fmtNum(l.falseAlarm)} false alarm, {fmtNum(l.open)} not reviewed</div>
            {testLevel && <div style={{ marginTop: 4 }}>Test: {testLevel['real misuse (%)']}% of {fmtNum(testLevel['test days'])} held-out {l.level} days were real misuse</div>}
          </>
        ),
      };
    });

    const typeRows: BulletRow[] = (data.byType ?? []).map((ty) => {
      const testType = test?.per_misuse_type?.[ty.type];
      return {
        key: ty.type,
        label: <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{misuseTypeLabel(ty.type)}</span>,
        live: ty.livePrecision,
        test: testType ? testType.precision : null,
        tooltip: (
          <>
            <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>{misuseTypeLabel(ty.type)}</div>
            <div>{fmtNum(ty.total)} alert days: {fmtNum(ty.confirmed)} confirmed, {fmtNum(ty.falseAlarm)} false alarm, {fmtNum(ty.open)} not reviewed</div>
            <div style={{ marginTop: 4 }}>
              {testType
                ? `Test: Random Forest precision ${pct(testType.precision)}, recall ${pct(testType.recall)} (${fmtNum(testType['test days'])} test days)`
                : ty.fromIsolationForest ? 'Raised by an Isolation Forest (type unknown), so there is no per-type test figure.' : 'No test figure for this type.'}
            </div>
          </>
        ),
      };
    });

    return (
      <>
        {/* ---- 1. Misuse trends ---- */}
        <div style={grid(140)}>
          <StatTile label="Alert days" value={fmtNum(t.alerts)} sub="one SIM flagged on one day" />
          <StatTile label="SIMs flagged" value={fmtNum(t.simsFlagged)} sub={`${fmtNum(t.simsFlaggedMoreThanOnce)} on more than one day`} />
          <StatTile label="Waiting for review" value={fmtNum(t.open)} sub={`${pct(t.alerts ? t.open / t.alerts : null)} of alert days`} />
          <StatTile label="Reviewed" value={pct(review.reviewedShare)}
            sub={`${fmtNum(t.confirmed)} confirmed · ${fmtNum(t.falseAlarm)} false alarm`} />
          <StatTile label="Median time to review" value={duration(review.medianHoursToReview)} sub="from alert raised to decision" />
        </div>

        <div style={{ ...grid(420), marginTop: 16 }}>
          <ChartCard
            title={`Alert days per ${trend.weekly ? 'week' : 'day'}, by level`}
            subtitle={trend.weekly && trend.partialDays
              ? `Severity colours match the Misuse Alerts page. The last bar covers only ${trend.partialDays} day${trend.partialDays === 1 ? '' : 's'}.`
              : 'Severity colours match the Misuse Alerts page'}
            style={{ gridColumn: '1 / -1' }}
            table={{
              columns: [trend.weekly ? 'Week' : 'Day', ...ALERT_LEVELS, 'Total'],
              rows: trend.keys.map((_, i) => {
                const vals = ALERT_LEVELS.map((l) => trend.perLevel[l][i]);
                return [trend.titles[i], ...vals, vals.reduce((a, b) => a + b, 0)];
              }),
            }}>
            <ColumnChart titles={trend.titles} ticks={trend.ticks} series={TREND_SERIES} values={trend.values}
              ariaLabel={`Alert days per ${trend.weekly ? 'week' : 'day'} by level`} />
          </ChartCard>

          <ChartCard
            title="Alert days by misuse type"
            subtitle="Types in grey were raised by an Isolation Forest, which spots unusual use but cannot name a type"
            table={{
              columns: ['Misuse type', 'Alert days', 'Open', 'Confirmed', 'False alarm'],
              rows: (data.byType ?? []).map((ty) => [misuseTypeLabel(ty.type), ty.total, ty.open, ty.confirmed, ty.falseAlarm]),
            }}>
            <HBarList rows={(data.byType ?? []).map((ty) => ({
              key: ty.type,
              label: misuseTypeLabel(ty.type),
              value: ty.total,
              note: `(${pct(ty.total / t.alerts)})`,
              muted: ty.fromIsolationForest,
              tooltip: <>{fmtNum(ty.open)} open · {fmtNum(ty.confirmed)} confirmed · {fmtNum(ty.falseAlarm)} false alarm</>,
            }))} />
          </ChartCard>

          <ChartCard title="SIMs flagged most often" subtitle="Repeat alerts on the same SIM are the strongest lead for a review">
            {(data.repeatSims ?? []).length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>No SIM was flagged on more than one day in this period.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {['SIM', 'Alert days', 'Highest level', 'Main type', 'Last alert'].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 1 ? 'right' : 'left', padding: '6px 8px', color: C.muted, fontWeight: 600,
                          borderBottom: `1px solid ${C.rowBorder}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.repeatSims!.map((s) => (
                      <tr key={s.simRef}>
                        <td style={{ padding: '6px 8px', color: C.text, fontWeight: 600, borderBottom: `1px solid ${C.rowBorder}` }}>{s.simRef}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: C.text, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${C.rowBorder}` }}>
                          {s.alertDays}{s.openDays < s.alertDays && <span style={{ color: C.muted }}> ({s.openDays} open)</span>}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: `1px solid ${C.rowBorder}` }}><LevelBadge level={s.highestLevel} /></td>
                        <td style={{ padding: '6px 8px', color: C.textSoft, borderBottom: `1px solid ${C.rowBorder}` }}>{misuseTypeLabel(s.mainType)}</td>
                        <td style={{ padding: '6px 8px', color: C.textSoft, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.rowBorder}` }}>{formatDay(s.lastAlert, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ---- 2. Model performance in practice ---- */}
        <SectionHead
          title="Model performance in practice"
          range={currentVersion ? `Model ${currentVersion}` : undefined}
          note={<>Live precision = confirmed ÷ (confirmed + false alarm) among alerts an operator has reviewed.
            Test figures come from held-out SIMs in training notebook 01
            {test && <> (misuse vs normal: precision {pct(test.misuse_vs_normal.precision)}, recall {pct(test.misuse_vs_normal.recall)})</>}.</>}
        />
        {!data.model && <Notice tone="warning">The ML service isn't reachable, so test results can't be shown. Live figures below still work.</Notice>}
        {data.model && !test && <Notice>No saved test results for model {currentVersion}. Re-run the metrics cell in notebook 01 to save them.</Notice>}
        {!reviewedAny && (
          <Notice>No alerts in this period have been reviewed yet. Mark alerts as Confirmed or False alarm on the
            Misuse Alerts page and the live bars will appear next to the test figures.</Notice>
        )}
        {olderVersions.length > 0 && (
          <Notice>Some alerts in this period were scored by an earlier model ({olderVersions.join(', ')}).
            Test figures describe the current model only.</Notice>
        )}
        <div style={{ display: 'grid', gap: 16 }}>
          <ChartCard title="By alert level"
            subtitle="Higher levels should be right more often"
            table={{
              columns: ['Level', 'Alert days', 'Confirmed', 'False alarm', 'Not reviewed', 'Live precision', 'Test (real misuse)'],
              rows: (data.byLevel ?? []).map((l) => [l.level, l.total, l.confirmed, l.falseAlarm, l.open, pct(l.livePrecision),
                test?.alert_levels?.[l.level] ? `${test.alert_levels[l.level]['real misuse (%)']}%` : '—']),
            }}>
            <BulletList rows={levelRows} />
          </ChartCard>
          <ChartCard title="By misuse type"
            subtitle="Test figure = Random Forest precision for that type"
            table={{
              columns: ['Misuse type', 'Alert days', 'Confirmed', 'False alarm', 'Not reviewed', 'Live precision', 'Test precision'],
              rows: (data.byType ?? []).map((ty) => [misuseTypeLabel(ty.type), ty.total, ty.confirmed, ty.falseAlarm, ty.open,
                pct(ty.livePrecision), pct(test?.per_misuse_type?.[ty.type]?.precision)]),
            }}>
            <BulletList rows={typeRows} />
          </ChartCard>
        </div>
      </>
    );
  })();

  return (
    <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s ease' }} aria-busy={loading}>
      <SectionHead
        title="Misuse trends"
        range={data.range ? `Scored days ${formatPeriod(data.range.from, data.range.to)}` : undefined}
        note="All departments: usage data is not linked to employees yet."
      />
      {error && <Notice tone="warning">{error} Showing the last figures loaded.</Notice>}
      {body}
    </div>
  );
};

// ---------------------------------------------------------------- 4: operations

const OperationsSection: React.FC<{ data: OperationsAnalytics | null; loading: boolean; error: string | null }> = ({ data, loading, error }) => {
  if (!data) {
    return error ? <><SectionHead title="SIM and employee operations" /><Notice tone="warning">{error}</Notice></> : null;
  }
  const a = data.applications;
  const { from, to } = data.range;
  const weekTitles = a.weekly.map((w) => weekTitle(w.weekStart, from, to));
  const weekTicks = a.weekly.map((w) => formatDay(maxIso(w.weekStart, from)));
  const stockTitles = data.stock.weekly.map((w) => weekTitle(w.weekStart, from, to));
  const s = data.stock;
  const statusCount = (st: string) => s.byStatus.find((b) => b.status === st)?.count ?? 0;
  const notApplied = data.employees.byStatus.find((b) => b.status === 'NotApplied')?.count ?? 0;
  const shortOfPending = s.inStock < s.pendingApplications;
  const lowStock = shortOfPending || s.inStock < s.lowStockMinimum;
  const scope = data.department ?? 'All departments';

  return (
    <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s ease' }} aria-busy={loading}>
      <SectionHead title="SIM and employee operations" range={`${scope} · ${formatPeriod(from, to)}`} />
      {error && <Notice tone="warning">{error} Showing the last figures loaded.</Notice>}

      <div style={grid(140)}>
        <StatTile label="Applications submitted" value={fmtNum(a.submitted)} sub={`${fmtNum(a.pendingNow)} pending now`} />
        <StatTile label="Approval rate" value={pct(a.approvalRate)} sub={`${fmtNum(a.approved)} approved · ${fmtNum(a.rejected)} rejected`} />
        <StatTile label="Median time to decision" value={duration(a.medianHoursToDecision)} sub="from applying to approval or rejection" />
        <StatTile label="Employees not applied" value={fmtNum(notApplied)} sub={`of ${fmtNum(data.employees.total)} on the staff list`} />
        <StatTile label="SIMs in stock" value={fmtNum(s.inStock)} warning={lowStock}
          sub={lowStock
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warning)' }}>
                <TriangleAlert size={13} />{shortOfPending ? `${fmtNum(s.pendingApplications)} applications pending` : `below ${s.lowStockMinimum}`}
              </span>
            : 'all departments'} />
      </div>

      {lowStock && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="warning">
            {shortOfPending
              ? `Not enough SIMs in stock to approve every pending application (${fmtNum(s.inStock)} in stock, ${fmtNum(s.pendingApplications)} pending across all departments).`
              : `Stock is low: ${fmtNum(s.inStock)} SIM${s.inStock === 1 ? '' : 's'} left.`}
            {' '}Add the SIMs received from the operator on the SIM Cards page.
          </Notice>
        </div>
      )}

      <div style={{ ...grid(420), marginTop: 16 }}>
        <ChartCard title="Applications per week" subtitle={scope}
          table={{
            columns: ['Week', 'Submitted', 'Approved', 'Rejected'],
            rows: a.weekly.map((w, i) => [weekTitles[i], w.submitted, w.approved, w.rejected]),
          }}>
          <div style={grid(220)}>
            <div>
              <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600, marginBottom: 8 }}>Submitted</div>
              <ColumnChart titles={weekTitles} ticks={weekTicks} height={140}
                series={[{ key: 'submitted', label: 'Submitted', color: VIZ.blue }]}
                values={[a.weekly.map((w) => w.submitted)]} ariaLabel="Applications submitted per week" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600, marginBottom: 8 }}>Decided</div>
              <ColumnChart titles={weekTitles} ticks={weekTicks} height={112} series={DECISION_SERIES}
                values={[a.weekly.map((w) => w.approved), a.weekly.map((w) => w.rejected)]}
                ariaLabel="Applications approved and rejected per week" />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Employees by SIM application" subtitle={`${scope} · today`}
          table={{
            columns: ['Status', 'Employees'],
            rows: data.employees.byStatus.map((b) => [EMPLOYEE_PARTS[b.status]?.label ?? b.status, b.count]),
          }}>
          <SegmentedBar ariaLabel="Employees by SIM application status"
            parts={data.employees.byStatus.map((b) => ({ ...EMPLOYEE_PARTS[b.status], value: b.count }))} />
          <div style={{ marginTop: 18, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            {data.employees.total === 0
              ? 'No employees on the staff list for this selection.'
              : `${pct(notApplied / data.employees.total)} of listed employees haven't applied for a company SIM yet.`}
          </div>
        </ChartCard>

        <ChartCard title="SIM stock" subtitle="All departments · stock is shared"
          table={{
            columns: ['Week', 'Received', 'Issued', 'In stock at end of week'],
            rows: s.weekly.map((w, i) => [stockTitles[i], w.received, w.issued, w.inStockAtEnd]),
          }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
            {[['In stock', 'InStock'], ['Active', 'Active'], ['Suspended', 'Suspended'], ['Deactivated', 'Deactivated']].map(([label, key]) => (
              <span key={key}>{label} <b style={{ color: C.text, fontWeight: 600 }}>{fmtNum(statusCount(key))}</b></span>
            ))}
          </div>
          <div style={grid(220)}>
            <div>
              <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600, marginBottom: 8 }}>In stock at end of week</div>
              <ColumnChart titles={stockTitles} ticks={weekTicks} height={140}
                series={[{ key: 'stock', label: 'In stock', color: VIZ.blue }]}
                values={[s.weekly.map((w) => w.inStockAtEnd)]} ariaLabel="SIMs in stock at the end of each week" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600, marginBottom: 8 }}>Received and issued</div>
              <ColumnChart titles={stockTitles} ticks={weekTicks} height={112} layout="grouped" series={STOCK_FLOW_SERIES}
                values={[s.weekly.map((w) => w.received), s.weekly.map((w) => w.issued)]}
                ariaLabel="SIMs received and issued per week" />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Issued SIMs by department"
          subtitle="Active and suspended SIMs issued through an approved application (reserved SIMs not counted)"
          table={{ columns: ['Department', 'SIMs'], rows: data.issuedByDepartment.map((d) => [d.department, d.sims]) }}>
          {data.issuedByDepartment.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>No SIMs have been issued yet.</div>
          ) : (
            <HBarList rows={data.issuedByDepartment.map((d) => ({
              key: d.department,
              label: d.department,
              value: d.sims,
              // With a department picked, the others stay for context but recede
              muted: data.department !== null && d.department.toLowerCase() !== data.department.toLowerCase(),
            }))} />
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default AnalyticsView;
