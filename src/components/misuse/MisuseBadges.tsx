import React from 'react';
import type { AlertLevel, ReviewStatus } from '../../services/misuseApi';
import { STATUS_LABELS } from '../../services/misuseApi';
import { LEVEL_STYLE, STATUS_STYLE } from './misuseTheme';

/** Alert level: colour + icon + label, so the level never depends on colour alone. */
export const LevelBadge: React.FC<{ level: AlertLevel }> = ({ level }) => {
  const s = LEVEL_STYLE[level];
  return (
    <span title={s.hint} style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px',
      backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '12px', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <s.Icon size={13} />
      {level}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: s.color, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <s.Icon size={14} />
      {status === 'Confirmed' ? 'Confirmed misuse' : STATUS_LABELS[status]}
    </span>
  );
};
