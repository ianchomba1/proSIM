import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CircleCheck, CircleX, LoaderCircle, RotateCcw, Info } from 'lucide-react';
import {
  fetchSimDetail, misuseTypeLabel, reviewAlerts,
  type AlertLevel, type MisuseCase, type ReviewStatus, type SimMisuseDetail,
} from '../../services/misuseApi';
import { UsageChart } from './UsageChart';
import { LevelBadge, StatusBadge } from './MisuseBadges';
import {
  C, LEVEL_STYLE, buttonStyle, cardStyle, formatCount, formatDay, formatMb, formatPct, formatPeriod,
} from './misuseTheme';

interface Props {
  misuseCase: MisuseCase;
  reviewerId?: string;
  onBack: () => void;
  /** Called after a review is saved, so the case list can refresh. */
  onReviewed: () => void;
}

const MODEL_NAMES: Record<string, string> = {
  random_forest: 'Random Forest',
  data_isolation_forest: 'Data Isolation Forest',
  call_sms_isolation_forest: 'Call/SMS Isolation Forest',
};

export const MisuseCaseDetail: React.FC<Props> = ({ misuseCase, reviewerId, onBack, onReviewed }) => {
  const [detail, setDetail] = useState<SimMisuseDetail | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<ReviewStatus | null>(null);
  const [message, setMessage] = useState('');

  // State is only set when the request finishes; a newer request makes an older one's result ignored.
  useEffect(() => {
    let current = true;
    fetchSimDetail(misuseCase.simRef)
      .then((d) => { if (current) { setDetail(d); setError(''); } })
      .catch((e: Error) => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [misuseCase.simRef, reloadKey]);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const caseIds = useMemo(() => new Set(misuseCase.alertIds), [misuseCase.alertIds]);
  const caseAlerts = useMemo(
    () => (detail?.alerts ?? []).filter((a) => caseIds.has(a.alertId)).sort((a, b) => a.alertDate.localeCompare(b.alertDate)),
    [detail, caseIds],
  );
  const caseStatus: ReviewStatus = caseAlerts.some((a) => a.status === 'Open') ? 'Open'
    : caseAlerts.some((a) => a.status === 'Confirmed') ? 'Confirmed' : caseAlerts.length ? 'FalseAlarm' : misuseCase.status;
  const reviewed = caseAlerts.find((a) => a.status !== 'Open' && a.reviewedAt);
  const otherAlertDays = (detail?.alerts.length ?? 0) - caseAlerts.length;

  // Shade every alert day of this SIM in the charts (not only this case), coloured by level
  const alertByDate = useMemo(() => {
    const m = new Map<string, AlertLevel>();
    (detail?.alerts ?? []).forEach((a) => m.set(a.alertDate, a.alertLevel));
    return m;
  }, [detail]);
  const levelsShown = useMemo(() => Array.from(new Set(alertByDate.values())), [alertByDate]);

  const review = async (status: ReviewStatus) => {
    setSaving(status);
    setMessage('');
    try {
      const r = await reviewAlerts(misuseCase.alertIds, status, note.trim() || undefined, reviewerId);
      setMessage(status === 'Open'
        ? `Reopened ${r.updated} alert day(s).`
        : `Marked ${r.updated} alert day(s) as ${status === 'Confirmed' ? 'confirmed misuse' : 'a false alarm'}.`);
      setNote('');
      reload();
      onReviewed();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <button onClick={onBack} style={{ ...buttonStyle('secondary'), padding: '7px 12px' }}>
          <ArrowLeft size={15} /> Back to cases
        </button>
      </div>

      {/* Case header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
              {misuseCase.simRef}
            </h1>
            <LevelBadge level={misuseCase.alertLevel} />
            <StatusBadge status={caseStatus} />
          </div>
          <p style={{ fontSize: '14px', color: C.muted, margin: '6px 0 0 0' }}>
            {misuseCase.misuseTypes.map(misuseTypeLabel).join(', ')} · {formatPeriod(misuseCase.startDate, misuseCase.endDate)} ·{' '}
            {misuseCase.alertDays} alert day{misuseCase.alertDays === 1 ? '' : 's'}
            {misuseCase.maxConfidence !== null && <> · up to {formatPct(misuseCase.maxConfidence)} confidence</>}
          </p>
          <p style={{ fontSize: '13px', color: C.faint, margin: '4px 0 0 0' }}>
            {detail?.subscriberName ? `${detail.subscriberName}${detail.department ? ` · ${detail.department}` : ''}` : 'No registered subscriber linked to this SIM'}
            {detail?.tier && ` · ${detail.tier} tier`}
          </p>
        </div>
      </div>

      {error && <div style={{ ...cardStyle, padding: '16px', color: '#f87171' }}>{error}</div>}

      {/* Usage charts */}
      <div style={{ ...cardStyle, padding: '20px 20px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Daily usage, last {detail?.usage.length ?? 90} days</div>
            <div style={{ fontSize: '12.5px', color: C.faint, marginTop: '2px' }}>Shaded days are alert days on this SIM. Hover a day for its values.</div>
          </div>
          {/* Key: shading colour + level name, so identity is never colour alone */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {levelsShown.map((l) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.textSoft }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: LEVEL_STYLE[l].color, opacity: 0.5 }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        {!detail && !error && (
          <div style={{ padding: '40px', textAlign: 'center', color: C.faint }}>
            <LoaderCircle size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading usage…
          </div>
        )}
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <UsageChart title="Data used (MB per day)" days={detail.usage} value={(d) => d.totalMb} format={formatMb}
              alertByDate={alertByDate} hoverIndex={hoverIndex} onHover={setHoverIndex} />
            <UsageChart title="Calls per day" days={detail.usage} value={(d) => d.calls} format={formatCount}
              alertByDate={alertByDate} hoverIndex={hoverIndex} onHover={setHoverIndex} height={90} />
            <UsageChart title="SMS per day" days={detail.usage} value={(d) => d.sms} format={formatCount}
              alertByDate={alertByDate} hoverIndex={hoverIndex} onHover={setHoverIndex} height={90} showDates />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '20px', alignItems: 'start' }}>
        {/* Alert days in this case */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.rowBorder}` }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>What the models found</div>
            <div style={{ fontSize: '12.5px', color: C.faint, marginTop: '2px' }}>
              Each alert day in this case, with what was unusual about it.
              {otherAlertDays > 0 && ` This SIM has ${otherAlertDays} more alert day(s) in other cases.`}
            </div>
          </div>
          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {caseAlerts.map((a, i) => (
              <div key={a.alertId} style={{ padding: '14px 20px', borderBottom: i < caseAlerts.length - 1 ? `1px solid ${C.rowBorder}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: '13.5px', minWidth: '96px' }}>{formatDay(a.alertDate, true)}</span>
                  <LevelBadge level={a.alertLevel} />
                  <span style={{ color: C.textSoft, fontSize: '13px' }}>{misuseTypeLabel(a.misuseType)}</span>
                  {a.confidence !== null && <span style={{ color: C.faint, fontSize: '12.5px' }}>{formatPct(a.confidence)} confidence</span>}
                </div>
                {a.signals.length > 0 ? (
                  <ul style={{ margin: '8px 0 0 106px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {a.signals.map((s) => (
                      <li key={s} style={{ color: C.textSoft, fontSize: '13px' }}>• {s}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ margin: '8px 0 0 106px', color: C.faint, fontSize: '12.5px' }}>
                    No single measure stands out; the models flagged the overall pattern.
                  </div>
                )}
                <div style={{ margin: '6px 0 0 106px', color: C.faint, fontSize: '11.5px' }}>
                  Flagged by {a.flaggedBy.map((f) => MODEL_NAMES[f] ?? f).join(' + ') || '—'}
                </div>
              </div>
            ))}
            {detail && caseAlerts.length === 0 && (
              <div style={{ padding: '24px 20px', color: C.faint }}>These alerts are no longer present (the day may have been rescored).</div>
            )}
          </div>
        </div>

        {/* Review */}
        <div style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Review this case</div>
          <div style={{ fontSize: '12.5px', color: C.muted, lineHeight: 1.5 }}>
            Your decision applies to all {misuseCase.alertDays} alert day{misuseCase.alertDays === 1 ? '' : 's'}. Reviews are kept when days are rescored,
            and become labelled examples for retraining the models.
          </div>
          {reviewed && (
            <div style={{ fontSize: '12.5px', color: C.textSoft, backgroundColor: C.headRow, border: `1px solid ${C.rowBorder}`, borderRadius: '8px', padding: '10px 12px' }}>
              <StatusBadge status={reviewed.status} />
              <div style={{ marginTop: '4px', color: C.muted }}>
                {reviewed.reviewedByName ? `by ${reviewed.reviewedByName}, ` : ''}
                {reviewed.reviewedAt && new Date(reviewed.reviewedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              {reviewed.reviewNote && <div style={{ marginTop: '4px' }}>“{reviewed.reviewNote}”</div>}
            </div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional), e.g. what you checked"
            maxLength={1000}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', backgroundColor: C.headRow, border: '1px solid #1a2538', borderRadius: '8px',
              padding: '10px 12px', color: C.text, fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => review('Confirmed')} disabled={saving !== null} style={buttonStyle('danger', saving !== null)}>
              {saving === 'Confirmed' ? <LoaderCircle size={15} /> : <CircleCheck size={15} />} Confirm misuse
            </button>
            <button onClick={() => review('FalseAlarm')} disabled={saving !== null} style={buttonStyle('success', saving !== null)}>
              {saving === 'FalseAlarm' ? <LoaderCircle size={15} /> : <CircleX size={15} />} False alarm
            </button>
            {caseStatus !== 'Open' && (
              <button onClick={() => review('Open')} disabled={saving !== null} style={buttonStyle('secondary', saving !== null)}>
                <RotateCcw size={15} /> Reopen
              </button>
            )}
          </div>
          {message && <div style={{ fontSize: '12.5px', color: C.textSoft }}>{message}</div>}
          {!reviewerId && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: C.faint }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              Your account ID is not available, so the review will be saved without a reviewer name. Sign out and in again to fix this.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
