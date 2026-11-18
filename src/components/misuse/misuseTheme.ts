import type React from 'react';
import { CircleCheck, CircleX, Clock, Eye, OctagonAlert, PhoneCall, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AlertLevel, ReviewStatus } from '../../services/misuseApi';

// Severity colours are reserved for alert levels and always shown with an icon + label.
export const LEVEL_STYLE: Record<AlertLevel, { color: string; bg: string; border: string; Icon: LucideIcon; hint: string }> = {
  High: {
    color: '#f87171', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', Icon: OctagonAlert,
    hint: 'Random Forest and data Isolation Forest agree',
  },
  Alert: {
    color: '#fb923c', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', Icon: TriangleAlert,
    hint: 'Random Forest recognised a misuse type',
  },
  Review: {
    color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', Icon: Eye,
    hint: 'Unusual data use, type unknown',
  },
  'Review (calls/SMS)': {
    color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', Icon: PhoneCall,
    hint: 'Unusual calling or texting, type unknown',
  },
};

export const STATUS_STYLE: Record<ReviewStatus, { color: string; Icon: LucideIcon }> = {
  Open: { color: '#93c5fd', Icon: Clock },
  Confirmed: { color: '#f87171', Icon: CircleCheck },
  FalseAlarm: { color: '#94a3b8', Icon: CircleX },
};

export const C = {
  page: 'var(--bg-dark)',
  card: 'var(--card-bg)',
  cardBorder: 'var(--card-border)',
  headRow: 'var(--card-bg-elevated)',
  rowBorder: 'var(--card-border)',
  text: 'var(--text-primary)',
  textSoft: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  faint: 'var(--text-muted)',
  accent: 'var(--accent-green)',
  accentSoft: 'var(--accent-green)',
};

export const cardStyle: React.CSSProperties = {
  backgroundColor: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: '12px',
  boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0, 0, 0, 0.4))',
};

export const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--input-bg, var(--card-bg))',
  border: '1px solid var(--input-border, var(--card-border))',
  borderRadius: '8px',
  padding: '9px 14px',
  color: C.textSoft,
  fontSize: '13.5px',
  cursor: 'pointer',
  outline: 'none',
};

export const buttonStyle = (kind: 'primary' | 'secondary' | 'danger' | 'success' = 'secondary', disabled = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  borderRadius: '9999px',
  padding: '9px 16px',
  fontSize: '13.5px',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  border: kind === 'secondary' ? '1px solid var(--card-border)' : 'none',
  backgroundColor:
    kind === 'primary' ? 'var(--btn-primary-bg)' : kind === 'danger' ? 'var(--danger)' : kind === 'success' ? 'var(--success)' : 'var(--accent-green-dim)',
  color: kind === 'primary' ? 'var(--btn-primary-text)' : kind === 'secondary' ? 'var(--text-primary)' : '#ffffff',
  boxShadow: kind === 'primary' ? '0 4px 12px var(--accent-glow)' : 'none',
  transition: 'all 0.2s ease',
});

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "2 Mar" or, with year, "2 Mar 2025". Dates are calendar days, so format in UTC. */
export function formatDay(iso: string, withYear = false): string {
  return toDate(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });
}

export function formatPeriod(start: string, end: string): string {
  return start === end ? formatDay(start, true) : `${formatDay(start)} – ${formatDay(end, true)}`;
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const formatMb = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} GB` : `${Math.round(v)} MB`);
export const formatCount = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
export const formatPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
