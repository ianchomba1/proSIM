// Hand-drawn chart pieces for the Analytics page (no chart library in the project).
// Rules followed: thin marks with 4px rounded data-ends, 2px surface gaps, hairline grid,
// legend for 2+ series, a hover/focus tooltip on every mark, and a table view on every chart card.
import React, { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { C, cardStyle } from '../misuse/misuseTheme';
import { VIZ, fmtNum, useWidth, type Series } from './vizTheme';

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Rounded top corners only: the data-end is rounded, the baseline end stays square. */
function topRoundedRect(x: number, yTop: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const yb = yTop + h;
  return `M${x},${yb} V${yTop + rr} Q${x},${yTop} ${x + rr},${yTop} H${x + w - rr} Q${x + w},${yTop} ${x + w},${yTop + rr} V${yb} Z`;
}

const tooltipBox: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  backgroundColor: VIZ.tipBg,
  border: `1px solid ${VIZ.tipBorder}`,
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '12px',
  color: C.textSoft,
  boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
  zIndex: 5,
  minWidth: '150px',
};

export const Swatch: React.FC<{ s: Series; size?: number }> = ({ s, size = 10 }) =>
  s.Icon ? <s.Icon size={size + 3} color={s.color} strokeWidth={2.4} aria-hidden />
    : <span aria-hidden style={{ width: size, height: size, borderRadius: 3, backgroundColor: s.color, display: 'inline-block', flexShrink: 0 }} />;

export const Legend: React.FC<{ series: Series[] }> = ({ series }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '12px', color: C.textSoft, marginBottom: '10px' }}>
    {series.map((s) => (
      <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Swatch s={s} />{s.label}
      </span>
    ))}
  </div>
);

// ---------------------------------------------------------------- column chart

interface ColumnChartProps {
  /** One label per column, used in the tooltip title. */
  titles: string[];
  /** Short axis label per column. */
  ticks: string[];
  series: Series[];
  /** values[seriesIndex][columnIndex] */
  values: number[][];
  layout?: 'stacked' | 'grouped';
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 8, right: 8, left: 40 };
const AXIS_H = 22;

export const ColumnChart: React.FC<ColumnChartProps> = ({
  titles, ticks, series, values, layout = 'stacked', height = 170, ariaLabel,
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = titles.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top;
  const slot = n > 0 ? plotW / n : 0;
  const totals = titles.map((_, i) => series.reduce((sum, _s, k) => sum + (values[k]?.[i] ?? 0), 0));
  const peak = layout === 'stacked' ? Math.max(0, ...totals) : Math.max(0, ...values.flat());
  const max = niceMax(peak);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const gridTicks = [0, max / 2, max];
  const base = PAD.top + plotH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 58))));

  const bars: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = PAD.left + i * slot;
    if (layout === 'stacked') {
      const w = Math.min(28, Math.max(2, slot - 6));
      const x = x0 + (slot - w) / 2;
      const nonZero = series.map((_, k) => k).filter((k) => (values[k]?.[i] ?? 0) > 0);
      let acc = 0;
      nonZero.forEach((k, j) => {
        const v = values[k][i];
        const yTop = y(acc + v);
        const yBottom = y(acc);
        const isTop = j === nonZero.length - 1;
        // 2px surface gap above every segment that has another one on top of it
        const segTop = isTop ? yTop : yTop + 2;
        const h = Math.max(1, yBottom - segTop);
        bars.push(isTop
          ? <path key={`${i}-${k}`} d={topRoundedRect(x, segTop, w, h, 4)} fill={series[k].color} />
          : <rect key={`${i}-${k}`} x={x} y={segTop} width={w} height={h} fill={series[k].color} />);
        acc += v;
      });
    } else {
      const k = series.length;
      const groupW = Math.min(slot - 6, k * 18 + (k - 1) * 2);
      const w = Math.max(1, (groupW - (k - 1) * 2) / k);
      series.forEach((s, j) => {
        const v = values[j]?.[i] ?? 0;
        if (v <= 0) return;
        const x = x0 + (slot - groupW) / 2 + j * (w + 2);
        bars.push(<path key={`${i}-${j}`} d={topRoundedRect(x, y(v), w, base - y(v), 4)} fill={s.color} />);
      });
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {series.length > 1 && <Legend series={series} />}
      {width > 0 && (
        <svg width={width} height={height + AXIS_H} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
          {hover !== null && <rect x={PAD.left + hover * slot} y={PAD.top} width={slot} height={plotH} fill={VIZ.hover} />}
          {gridTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={VIZ.label}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number.isInteger(t) ? fmtNum(t) : t.toFixed(1)}
              </text>
            </g>
          ))}
          {bars}
          {ticks.map((t, i) => (i % labelEvery === 0 ? (
            <text key={`t-${i}`} x={PAD.left + (i + 0.5) * slot} y={base + 15} textAnchor="middle" fontSize={10.5} fill={VIZ.label}>{t}</text>
          ) : null))}
          {titles.map((title, i) => (
            <rect key={`hit-${i}`} x={PAD.left + i * slot} y={0} width={slot} height={height + AXIS_H} fill="transparent"
              tabIndex={0} aria-label={`${title}: ${series.map((s, k) => `${s.label} ${values[k]?.[i] ?? 0}`).join(', ')}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)} style={{ outline: 'none' }} />
          ))}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div style={{
          ...tooltipBox,
          top: series.length > 1 ? 34 : 4,
          left: Math.min(Math.max(PAD.left + (hover + 1) * slot + 6, 0), Math.max(0, width - 190)),
        }}>
          <div style={{ color: C.muted, marginBottom: 4 }}>{titles[hover]}</div>
          {series.map((s, k) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Swatch s={s} size={8} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(values[k]?.[hover] ?? 0)}</span>
            </div>
          ))}
          {layout === 'stacked' && series.length > 1 && (
            <div style={{ display: 'flex', marginTop: 5, paddingTop: 5, borderTop: `1px solid ${VIZ.tipBorder}` }}>
              <span style={{ flex: 1 }}>Total</span>
              <span style={{ color: C.text, fontWeight: 700 }}>{fmtNum(totals[hover])}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- horizontal bars

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  /** Shown after the value, e.g. a share. */
  note?: string;
  muted?: boolean;
  tooltip?: React.ReactNode;
}

/** Ranked horizontal bars, one colour, value at the bar tip. */
export const HBarList: React.FC<{ rows: HBarRow[]; color?: string; labelWidth?: number; format?: (v: number) => string }> = ({
  rows, color = VIZ.blue, labelWidth = 170, format = fmtNum,
}) => {
  const [hover, setHover] = useState<string | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const stacked = width > 0 && width < 440;   // phones: label above the bar
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((r) => (
        <div key={r.key} tabIndex={0} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(r.key)} onBlur={() => setHover(null)}
          style={{ position: 'relative', display: 'flex', alignItems: stacked ? 'stretch' : 'center', flexDirection: stacked ? 'column' : 'row',
            gap: stacked ? 4 : 10, padding: '5px 4px', borderRadius: 6,
            backgroundColor: hover === r.key ? VIZ.hover : 'transparent', outline: 'none' }}>
          <span style={{ width: stacked ? 'auto' : labelWidth, flexShrink: 0, fontSize: 12.5, color: r.muted ? C.muted : C.textSoft,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ width: `calc((100% - 90px) * ${r.value / max})`, minWidth: r.value > 0 ? 3 : 0, height: 10,
              borderRadius: '0 4px 4px 0', backgroundColor: r.muted ? VIZ.neutral : color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {format(r.value)}{r.note && <span style={{ color: C.muted, fontWeight: 400 }}> {r.note}</span>}
            </span>
          </div>
          {hover === r.key && r.tooltip && (
            <div style={{ ...tooltipBox, top: '100%', left: stacked ? 4 : labelWidth + 14, marginTop: 2 }}>{r.tooltip}</div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- live vs test

export interface BulletRow {
  key: string;
  label: React.ReactNode;
  /** 0..1, null = nothing reviewed yet */
  live: number | null;
  /** 0..1, null = no test figure */
  test: number | null;
  tooltip: React.ReactNode;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Live precision bar against the held-out test figure (a tick), on one 0-100% scale. */
export const BulletList: React.FC<{ rows: BulletRow[]; labelWidth?: number }> = ({ rows, labelWidth = 170 }) => {
  const [hover, setHover] = useState<string | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const stacked = width > 0 && width < 520;   // phones: label and figures above a full-width bar
  const figures = (r: BulletRow) => (
    <span style={{ width: stacked ? 'auto' : 120, flexShrink: 0, fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
      <b style={{ color: r.live === null ? C.muted : C.text, fontWeight: 600 }}>{r.live === null ? 'not reviewed' : pct(r.live)}</b>
      {r.test !== null && <> · test {pct(r.test)}</>}
    </span>
  );
  return (
    <div ref={ref}>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.textSoft, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: VIZ.blue }} />Live: confirmed ÷ reviewed
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 2, height: 14, backgroundColor: C.text }} />Test: held-out data
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5, color: VIZ.label, padding: '0 4px 2px' }}>
        {!stacked && <span style={{ width: labelWidth, flexShrink: 0 }} />}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}><span>0%</span><span>50%</span><span>100%</span></div>
        {!stacked && <span style={{ width: 120, flexShrink: 0 }} />}
      </div>
      {rows.map((r) => (
        <div key={r.key} tabIndex={0} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(r.key)} onBlur={() => setHover(null)}
          style={{ position: 'relative', display: 'flex', alignItems: stacked ? 'stretch' : 'center', flexDirection: stacked ? 'column' : 'row',
            gap: stacked ? 5 : 10, padding: '7px 4px', borderRadius: 6,
            backgroundColor: hover === r.key ? VIZ.hover : 'transparent', outline: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, ...(stacked ? {} : { width: labelWidth, flexShrink: 0 }) }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.textSoft, display: 'flex', alignItems: 'center', gap: 6,
              overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.label}</span>
            {stacked && figures(r)}
          </div>
          <div style={{ flex: stacked ? 'none' : 1, position: 'relative', height: 16 }}>
            {[0, 0.5, 1].map((g) => (
              <span key={g} style={{ position: 'absolute', left: `${g * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: g === 0 ? VIZ.axis : VIZ.grid }} />
            ))}
            {r.live !== null && (
              <span style={{ position: 'absolute', left: 0, top: 3, height: 10, width: `${r.live * 100}%`, minWidth: r.live > 0 ? 3 : 0,
                borderRadius: '0 4px 4px 0', backgroundColor: VIZ.blue }} />
            )}
            {r.test !== null && (
              <span style={{ position: 'absolute', left: `calc(${r.test * 100}% - ${r.test * 2}px)`, top: 0, height: 16, width: 2, backgroundColor: C.text }} />
            )}
          </div>
          {!stacked && figures(r)}
          {hover === r.key && (
            <div style={{ ...tooltipBox, top: '100%', left: stacked ? 4 : labelWidth + 14, marginTop: 2, maxWidth: 'min(320px, 90%)' }}>{r.tooltip}</div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- part-to-whole

export interface Part extends Series { value: number; textOnFill?: string }

/** Tall segmented bar (one whole split into parts) with the share inside each part when it fits. */
export const SegmentedBar: React.FC<{ parts: Part[]; ariaLabel: string }> = ({ parts, ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  const gaps = Math.max(0, shown.length - 1) * 2;
  return (
    <div>
      <div ref={ref} role="img" aria-label={ariaLabel} style={{ position: 'relative', display: 'flex', gap: 2, height: 28 }}>
        {total === 0 && <div style={{ flex: 1, borderRadius: 4, backgroundColor: VIZ.grid }} />}
        {shown.map((p) => {
          const share = p.value / total;
          const px = (width - gaps) * share;
          const label = pct(share);
          return (
            <div key={p.key} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
              title={`${p.label}: ${fmtNum(p.value)} (${label})`}
              style={{ width: `calc((100% - ${gaps}px) * ${share})`, backgroundColor: p.color, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                color: p.textOnFill ?? '#ffffff', opacity: hover && hover !== p.key ? 0.6 : 1 }}>
              {px > label.length * 7 + 14 ? label : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12.5, color: C.textSoft, marginTop: 10 }}>
        {parts.map((p) => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: hover && hover !== p.key ? 0.6 : 1 }}>
            <Swatch s={p} />{p.label}
            <b style={{ color: C.text, fontWeight: 600 }}>{fmtNum(p.value)}</b>
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- cards

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

export const DataTable: React.FC<TableData> = ({ columns, rows }) => (
  <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={c} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '7px 10px', color: C.muted, fontWeight: 600,
              borderBottom: `1px solid ${C.rowBorder}`, position: 'sticky', top: 0, backgroundColor: C.card }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} style={{ textAlign: j === 0 ? 'left' : 'right', padding: '6px 10px', color: j === 0 ? C.textSoft : C.text,
                borderBottom: `1px solid ${C.rowBorder}`, fontVariantNumeric: 'tabular-nums' }}>
                {typeof cell === 'number' ? fmtNum(cell) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ChartCard: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  table?: TableData;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, subtitle, table, children, style }) => {
  const [asTable, setAsTable] = useState(false);
  return (
    <section style={{ ...cardStyle, padding: '18px 20px', minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: C.text }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable((v) => !v)}
            aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 10px', borderRadius: 9999,
              border: `1px solid ${C.cardBorder}`, background: 'transparent', color: C.textSoft, cursor: 'pointer' }}>
            {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}{asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {asTable && table ? <DataTable {...table} /> : children}
    </section>
  );
};

export const StatTile: React.FC<{ label: string; value: string; sub?: React.ReactNode; warning?: boolean }> = ({ label, value, sub, warning }) => (
  <div style={{ ...cardStyle, padding: '14px 16px', minWidth: 0, borderColor: warning ? 'var(--warning)' : C.cardBorder }}>
    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{sub}</div>}
  </div>
);
