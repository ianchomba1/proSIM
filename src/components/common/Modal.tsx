import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { C, cardStyle } from '../misuse/misuseTheme';

interface ModalProps {
  title: string;
  subtitle?: string;
  /** While busy, the window cannot be closed (Escape, backdrop or X). */
  busy?: boolean;
  onClose: () => void;
  /** When given, the window is a form and this runs on submit. */
  onSubmit?: (e: React.FormEvent) => void;
  width?: number;
  children: React.ReactNode;
}

/** Centred dialog with a dimmed backdrop; closes on Escape or a backdrop click unless busy. */
export const Modal: React.FC<ModalProps> = ({ title, subtitle, busy = false, onClose, onSubmit, width = 520, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div onClick={() => !busy && onClose()} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50,
    }}>
      <form role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit ?? ((e) => e.preventDefault())}
        style={{
          ...cardStyle, backgroundColor: 'var(--card-bg-elevated, var(--card-bg))', width: '100%', maxWidth: `${width}px`,
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column',
          gap: '16px', boxSizing: 'border-box',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 id="modal-title" style={{ margin: 0, fontSize: '18px', color: C.text }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: C.muted }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </form>
    </div>
  );
};
