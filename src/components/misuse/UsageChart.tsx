import React, { useEffect, useRef, useState } from 'react';
import type { AlertLevel, SimUsageDay } from '../../services/misuseApi';
import { LEVEL_STYLE, formatDay } from './misuseTheme';

interface UsageChartProps {
  title: string;
  days: SimUsageDay[];
  value: (d: SimUsageDay) => number;
  format: (v: number) => string;
  /** Alert level per date (YYYY-MM-DD); those days get a shaded band. */
  alertByDate: Map<string, AlertLevel>;
  /** Shared across the stacked charts so the hover line moves on all of them together. */
  hoverIndex: number | null;
  onHover: (i: number | null) => void;
  showDates?: boolean;
  height?: number;
}

const PAD = { top: 10, right: 12, bottom: 4, left: 46 };
const AXIS_H = 22;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Daily column chart for one measure (one series, so the title names it and there is no legend). */
export const UsageChart: React.FC<UsageChartProps> = ({
  title, days, value, format, alertByDate, hoverIndex, onHover, showDates = false, height = 120,
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const plotH = height - PAD.top - PAD.bottom;
  const svgH = height + (showDates ? AXIS_H : 0);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const n = days.length;
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(1, slot - 2);           // 2px surface gap between columns
  const values = days.map(value);
  const max = niceMax(Math.max(0, ...values));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  // Date labels on the 1st and 15th of each month, plus the first day shown
  const dateTicks = days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i === 0 || d.date.endsWith('-01') || d.date.endsWith('-15'));

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left) / slot);
    onHover(i >= 0 && i < n ? i : null);
  };

  const hovered = hoverIndex !== null ? days[hoverIndex] : null;
  const hoveredLevel = hovered ? alertByDate.get(hovered.date) : undefined;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px', paddingLeft: `${PAD.left}px` }}>
        {title}
      </div>
      {width > 0 && (
        <svg width={width} height={svgH} role="img" aria-label={`${title}, daily, ${n} days`} style={{ display: 'block' }}>
          {/* Alert-day bands, behind everything */}
          {days.map((d, i) => {
            const lvl = alertByDate.get(d.date);
            if (!lvl) return null;
            return (
              <rect key={`band-${d.date}`} x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH}
                fill={LEVEL_STYLE[lvl].color} opacity={0.16} />
            );
          })}

          {/* Recessive grid + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke="#172235" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="#64748b">
                {format(t)}
              </text>
            </g>
          ))}

          {/* Columns: rounded top, anchored to the baseline */}
          {days.map((d, i) => {
            const v = values[i];
            if (v <= 0) return null;
            const top = y(v);
            const h = PAD.top + plotH - top;
            const r = Math.min(2, barW / 2, h);
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const active = hoverIndex === i;
            return (
              <path key={`bar-${d.date}`}
                d={`M${x},${PAD.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + plotH} Z`}
                fill={active ? '#93c5fd' : '#60a5fa'} />
            );
          })}

          {/* Hover line */}
          {hoverIndex !== null && (
            <line x1={PAD.left + (hoverIndex + 0.5) * slot} x2={PAD.left + (hoverIndex + 0.5) * slot}
              y1={PAD.top} y2={PAD.top + plotH} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 3" />
          )}

          {/* Date axis (bottom chart only) */}
          {showDates && dateTicks.map(({ d, i }) => (
            <text key={`dt-${d.date}`} x={PAD.left + (i + 0.5) * slot} y={PAD.top + plotH + 16} textAnchor="middle"
              fontSize={10.5} fill="#64748b">
              {formatDay(d.date)}
            </text>
          ))}

          {/* Hit area larger than the marks */}
          <rect x={PAD.left} y={0} width={plotW} height={svgH} fill="transparent"
            onMouseMove={handleMove} onMouseLeave={() => onHover(null)} />
        </svg>
      )}

      {/* Tooltip */}
      {hovered && hoverIndex !== null && width > 0 && (
        <div style={{
          position: 'absolute',
          top: '18px',
          left: `${Math.min(Math.max(PAD.left + (hoverIndex + 0.5) * slot + 10, 0), width - 190)}px`,
          width: '180px',
          pointerEvents: 'none',
          backgroundColor: '#0e1524',
          border: '1px solid #233552',
          borderRadius: '8px',
          padding: '8px 10px',
          fontSize: '12px',
          color: '#cbd5e1',
          boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
          zIndex: 5,
        }}>
          <div style={{ color: '#8c9cb0', marginBottom: '2px' }}>{formatDay(hovered.date, true)}</div>
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '13px' }}>{format(value(hovered))}</div>
          {hoveredLevel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: LEVEL_STYLE[hoveredLevel].color }} />
              <span>{hoveredLevel} alert</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
