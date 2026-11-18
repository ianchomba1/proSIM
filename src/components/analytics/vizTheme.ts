import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { LucideIcon } from 'lucide-react';

/** Chart colours and chrome; each theme sets its own steps in index.css (--viz-*). */
export const VIZ = {
  blue: 'var(--viz-1)',
  orange: 'var(--viz-2)',
  neutral: 'var(--viz-neutral)',
  grid: 'var(--viz-grid)',
  axis: 'var(--viz-axis)',
  label: 'var(--viz-label)',
  hover: 'var(--viz-hover)',
  tipBg: 'var(--viz-tip-bg)',
  tipBorder: 'var(--viz-tip-border)',
};

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Status series (alert level, approved/rejected) carry an icon so colour is never the only cue. */
  Icon?: LucideIcon;
}

export const fmtNum = (v: number) => v.toLocaleString('en-GB');

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
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
