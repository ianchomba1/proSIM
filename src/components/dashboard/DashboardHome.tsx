import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Bell, CalendarDays, CircleCheck, CircleDashed, CircleOff, CircleX, Clock, CreditCard, Mail,
  PauseCircle, RefreshCw, ShieldCheck, Smartphone, TriangleAlert, UserPlus, Users,
} from 'lucide-react';
import { fetchProfile, type UserProfile } from '../../services/profileApi';
import { fetchOperationsAnalytics, type OperationsAnalytics, type EmployeeSimStatus, type SimStockStatus } from '../../services/analyticsApi';
import { fetchMisuseSummary, ALERT_LEVELS, type MisuseSummary } from '../../services/misuseApi';
import { C, LEVEL_STYLE, buttonStyle, cardStyle } from '../misuse/misuseTheme';
import { ChartCard, HBarList, SegmentedBar, StatTile, type Part } from '../analytics/charts';
import { VIZ, fmtNum } from '../analytics/vizTheme';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props {
  userId?: string;
  userName?: string;
  userEmail?: string;
  /** Open another admin page (nav key, e.g. 'analytics', 'alerts', 'inventory'). */
  onNavigate: (key: string) => void;
}

const EMPLOYEE_PARTS: Record<EmployeeSimStatus, Omit<Part, 'value'>> = {
  Approved: { key: 'Approved', label: 'Has a company SIM', color: 'var(--success)', Icon: CircleCheck },
  Pending: { key: 'Pending', label: 'Application pending', color: 'var(--warning)', Icon: Clock, textOnFill: '#0b0b0b' },
  Rejected: { key: 'Rejected', label: 'Rejected', color: 'var(--danger)', Icon: CircleX },
  NotApplied: { key: 'NotApplied', label: 'Not applied', color: VIZ.neutral, Icon: CircleDashed },
};

const SIM_PARTS: Record<SimStockStatus, Omit<Part, 'value'>> = {
  Active: { key: 'Active', label: 'Active', color: 'var(--success)', Icon: CircleCheck },
  InStock: { key: 'InStock', label: 'In stock', color: VIZ.blue, Icon: CreditCard },
  Suspended: { key: 'Suspended', label: 'Suspended', color: 'var(--warning)', Icon: PauseCircle, textOnFill: '#0b0b0b' },
  Deactivated: { key: 'Deactivated', label: 'Deactivated', color: VIZ.neutral, Icon: CircleOff },
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A';

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ActivityItem: React.FC<{ Icon: typeof Users; label: string; value: number; sub?: string }> = ({ Icon, label, value, sub }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
    <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--card-bg-elevated)', border: `1px solid ${C.cardBorder}`, color: C.accent }}>
      <Icon size={16} />
    </span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>{fmtNum(value)}</div>
      <div style={{ fontSize: 12.5, color: C.textSoft }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

export const DashboardHome: React.FC<Props> = ({ userId, userName, userEmail, onNavigate }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ops, setOps] = useState<OperationsAnalytics | null>(null);
  const [misuse, setMisuse] = useState<MisuseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    let current = true;
    Promise.allSettled([
      userId ? fetchProfile(userId) : Promise.resolve(null),
      fetchOperationsAnalytics(0, ''),
      fetchMisuseSummary(),
    ]).then(([p, o, m]) => {
      if (!current) return;
      if (p.status === 'fulfilled') setProfile(p.value);
      if (o.status === 'fulfilled') setOps(o.value);
      if (m.status === 'fulfilled') setMisuse(m.value);
      const failed = [p, o, m].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      setError(failed ? (failed.reason as Error).message : null);
      setLoading(false);
    });
    return () => { current = false; };
  }, [userId, refreshKey]);

  const refresh = () => { setLoading(true); setRefreshKey((k) => k + 1); };

  const name = profile?.fullName || userName || 'Administrator';
  const email = profile?.email || userEmail || '';
  const firstName = name.split(/\s+/)[0];
  const a = profile?.activity;

  const stock = ops?.stock;
  const count = (st: SimStockStatus) => stock?.byStatus.find((b) => b.status === st)?.count ?? 0;
  const totalSims = stock?.byStatus.reduce((s, b) => s + b.count, 0) ?? 0;
  const employeesTotal = ops?.employees.total ?? 0;
  const withSim = ops?.employees.byStatus.find((b) => b.status === 'Approved')?.count ?? 0;
  const shortOfPending = !!stock && stock.inStock < stock.pendingApplications;
  const lowStock = !!stock && (shortOfPending || stock.inStock < stock.lowStockMinimum);
  const openAlerts = misuse ? ALERT_LEVELS.reduce((s, l) => s + (misuse.openByLevel[l] ?? 0), 0) : 0;

  return (
    <div style={{ maxWidth: 1400, paddingBottom: 48, opacity: loading && (profile || ops) ? 0.6 : 1, transition: 'opacity 0.2s ease' }}
      aria-busy={loading}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: C.muted }}>Welcome back, {firstName}. Here's your profile and where your company's SIM cards stand.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} style={buttonStyle('secondary', loading)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          border: '1px solid var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: C.textSoft, fontSize: 13 }}>
          <TriangleAlert size={16} color="var(--warning)" /> {error}
        </div>
      )}

      {/* ---------------- Profile ---------------- */}
      <section style={{ ...cardStyle, padding: isMobile ? '18px 16px' : '24px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 28 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', minWidth: 0 }}>
          <div aria-hidden style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#ffffff',
            background: 'linear-gradient(135deg, var(--accent-green), var(--accent-green-dim, #1d4ed8))' }}>
            {initialsOf(name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>{name}</h2>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '3px 10px',
                borderRadius: 9999, color: C.accent, border: `1px solid ${C.cardBorder}`, backgroundColor: 'var(--card-bg-elevated)' }}>
                <ShieldCheck size={12} /> {profile?.role || 'Administrator'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10, fontSize: 13, color: C.textSoft }}>
              {email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, overflowWrap: 'anywhere' }}><Mail size={14} color={C.muted} />{email}</span>}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={14} color={C.muted} />Member since {formatDate(profile?.memberSince)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color={C.muted} />Last review {formatDate(a?.lastReviewAt)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ minWidth: 0, ...(isMobile
          ? { borderTop: `1px solid ${C.cardBorder}`, paddingTop: 20 }
          : { borderLeft: `1px solid ${C.cardBorder}`, paddingLeft: 26 }) }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.muted, marginBottom: 14 }}>
            Your activity
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: 18 }}>
            <ActivityItem Icon={CircleCheck} label="Applications decided" value={(a?.applicationsApproved ?? 0) + (a?.applicationsRejected ?? 0)}
              sub={`${fmtNum(a?.applicationsApproved ?? 0)} approved · ${fmtNum(a?.applicationsRejected ?? 0)} rejected`} />
            <ActivityItem Icon={Bell} label="Misuse alerts reviewed" value={(a?.alertsConfirmed ?? 0) + (a?.alertsFalseAlarm ?? 0)}
              sub={`${fmtNum(a?.alertsConfirmed ?? 0)} confirmed · ${fmtNum(a?.alertsFalseAlarm ?? 0)} false alarm`} />
            <ActivityItem Icon={CreditCard} label="SIMs added to stock" value={a?.simsAdded ?? 0} />
            <ActivityItem Icon={UserPlus} label="Employees added" value={a?.employeesAdded ?? 0} />
          </div>
        </div>
      </section>

      {/* ---------------- Company SIM overview ---------------- */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '30px 0 14px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text, flex: 1 }}>Your company's SIM cards</h2>
        <button type="button" onClick={() => onNavigate('analytics')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
            color: C.accent, fontSize: 13, fontWeight: 600, padding: 0 }}>
          Full analytics <ArrowRight size={14} />
        </button>
      </div>

      {!ops && !loading && !error && <div style={{ color: C.muted, fontSize: 13.5 }}>No data yet.</div>}
      {!ops && loading && <div style={{ color: C.muted, fontSize: 13.5, padding: 20 }}>Loading…</div>}

      {ops && stock && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 16 }}>
            <StatTile label="SIM cards" value={fmtNum(totalSims)} sub="received from the operator" />
            <StatTile label="Active SIMs" value={fmtNum(count('Active'))} sub={`${fmtNum(count('Suspended'))} suspended · ${fmtNum(count('Deactivated'))} deactivated`} />
            <StatTile label="In stock" value={fmtNum(stock.inStock)} warning={lowStock}
              sub={lowStock
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warning)' }}>
                    <TriangleAlert size={13} />{shortOfPending ? `${fmtNum(stock.pendingApplications)} applications waiting` : `below ${stock.lowStockMinimum}`}
                  </span>
                : 'ready to issue'} />
            <StatTile label="Pending applications" value={fmtNum(ops.applications.pendingNow)} sub="waiting for a decision" />
            <StatTile label="Employees with a SIM" value={`${fmtNum(withSim)} of ${fmtNum(employeesTotal)}`}
              sub={employeesTotal ? `${Math.round((withSim / employeesTotal) * 100)}% of the staff list` : 'no employees listed yet'} />
          </div>

          {lowStock && (
            <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderRadius: 10, marginTop: 16,
              border: '1px solid var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: C.textSoft, fontSize: 13 }}>
              <TriangleAlert size={16} color="var(--warning)" />
              <span style={{ flex: 1, minWidth: 220 }}>
                {shortOfPending
                  ? `Not enough SIMs in stock to approve every pending application (${fmtNum(stock.inStock)} in stock, ${fmtNum(stock.pendingApplications)} pending).`
                  : `Stock is low: ${fmtNum(stock.inStock)} SIM${stock.inStock === 1 ? '' : 's'} left.`}
              </span>
              <button type="button" onClick={() => onNavigate('inventory')} style={buttonStyle('secondary')}>
                <Smartphone size={14} /> Add SIMs
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 16, marginTop: 16 }}>
            <ChartCard title="SIM cards by status" subtitle="Every SIM received from the operator"
              table={{ columns: ['Status', 'SIMs'], rows: stock.byStatus.map((b) => [SIM_PARTS[b.status]?.label ?? b.status, b.count]) }}>
              <SegmentedBar ariaLabel="SIM cards by status"
                parts={(['Active', 'InStock', 'Suspended', 'Deactivated'] as SimStockStatus[]).map((s) => ({ ...SIM_PARTS[s], value: count(s) }))} />
            </ChartCard>

            <ChartCard title="Employees and company SIMs" subtitle="Staff list by SIM application status"
              table={{ columns: ['Status', 'Employees'], rows: ops.employees.byStatus.map((b) => [EMPLOYEE_PARTS[b.status]?.label ?? b.status, b.count]) }}>
              <SegmentedBar ariaLabel="Employees by SIM application status"
                parts={(['Approved', 'Pending', 'Rejected', 'NotApplied'] as EmployeeSimStatus[]).map((s) => ({
                  ...EMPLOYEE_PARTS[s], value: ops.employees.byStatus.find((b) => b.status === s)?.count ?? 0,
                }))} />
            </ChartCard>

            <ChartCard title="Issued SIMs by department"
              table={{ columns: ['Department', 'SIMs'], rows: ops.issuedByDepartment.map((d) => [d.department, d.sims]) }}>
              {ops.issuedByDepartment.length === 0
                ? <div style={{ fontSize: 13, color: C.muted }}>No SIMs have been issued yet.</div>
                : <HBarList labelWidth={150} rows={ops.issuedByDepartment.map((d) => ({ key: d.department, label: d.department, value: d.sims }))} />}
            </ChartCard>

            <ChartCard title="Misuse alerts waiting for review"
              subtitle={misuse?.lastScoredDay ? `Latest scored day: ${formatDate(misuse.lastScoredDay)}` : 'No usage data scored yet'}>
              {misuse ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                    {fmtNum(openAlerts)} <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>open alert days</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ALERT_LEVELS.map((l) => {
                      const st = LEVEL_STYLE[l];
                      return (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSoft }}>
                          <st.Icon size={15} color={st.color} aria-hidden />
                          <span style={{ flex: 1 }}>{l}</span>
                          <b style={{ color: C.text, fontWeight: 600 }}>{fmtNum(misuse.openByLevel[l] ?? 0)}</b>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => onNavigate('alerts')} style={{ ...buttonStyle('secondary'), marginTop: 16 }}>
                    Review alerts <ArrowRight size={14} />
                  </button>
                </>
              ) : <div style={{ fontSize: 13, color: C.muted }}>Misuse figures aren't available right now.</div>}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};
