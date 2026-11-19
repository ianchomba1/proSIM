import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, X, Check } from 'lucide-react';

interface IdCameraCaptureProps {
  /** Called with the captured photo (JPEG) when the user accepts it. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** The camera could not be opened (no camera, permission refused, not HTTPS): fall back to the file picker. */
  onUnavailable: (message: string) => void;
}

/**
 * Full-screen camera for photographing the front of a Kenyan National ID.
 * Uses the back camera on phones and the webcam on laptops; a card-shaped frame helps the user fill the picture
 * with the ID, which is what the OCR needs. The whole camera frame is sent, not just the guide, so a slightly
 * misaligned card is not cut off.
 */
export const IdCameraCapture: React.FC<IdCameraCaptureProps> = ({ onCapture, onClose, onUnavailable }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      onUnavailable(
        name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or upload a photo instead.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No camera was found on this device. Upload a photo of your ID instead.'
            : 'The camera could not be opened. Upload a photo of your ID instead.',
      );
    }
  }, [onUnavailable]);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `national-id-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setShot({ url: URL.createObjectURL(blob), file });
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const retake = () => {
    setReady(false);
    setShot(null);
    startCamera();
  };

  const acceptPhoto = () => {
    if (!shot) return;
    stopCamera();
    onCapture(shot.file);
  };

  const roundBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer',
    borderRadius: '999px', padding: '12px 20px', fontSize: '14px', fontWeight: 600,
  };

  // Rendered on <body> so no parent layout (transforms, overflow) can clip the full-screen camera
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of your National ID"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#05070d', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', color: '#fff' }}>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>{shot ? 'Check the photo' : 'Front of your National ID'}</span>
        <button type="button" onClick={onClose} aria-label="Close camera"
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: '999px', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {shot && <img src={shot.url} alt="Captured National ID" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
        {/* The video stays mounted so a retake can reuse it */}
        <video
          ref={videoRef}
          playsInline
          muted
          onLoadedMetadata={() => setReady(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: shot ? 'none' : 'block' }}
        />
        {!shot && (
          <>
            {/* Card-shaped guide (ID-1 card, 85.6 x 54 mm) */}
            <div aria-hidden="true" style={{
              position: 'absolute', width: 'min(86%, 640px)', aspectRatio: '85.6 / 54', borderRadius: '14px',
              border: '2.5px solid rgba(255,255,255,0.9)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', pointerEvents: 'none',
            }} />
            {!ready && <span style={{ position: 'absolute', color: '#fff', fontSize: '14px' }}>Starting camera…</span>}
          </>
        )}
      </div>

      <div style={{ padding: '14px 16px 22px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
        <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.5 }}>
          {shot
            ? 'Make sure your name, ID number and date of birth are sharp and not covered by glare.'
            : 'Place the card flat in good light and fill the frame. Avoid glare from lights or windows.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {shot ? (
            <>
              <button type="button" onClick={retake} style={{ ...roundBtn, background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                <RefreshCw size={16} /> Retake
              </button>
              <button type="button" onClick={acceptPhoto} style={{ ...roundBtn, background: 'var(--accent-green, #16a34a)', color: '#fff' }}>
                <Check size={16} /> Use this photo
              </button>
            </>
          ) : (
            <button type="button" onClick={takePhoto} disabled={!ready} aria-label="Take photo"
              style={{ ...roundBtn, background: '#fff', color: '#05070d', opacity: ready ? 1 : 0.5, padding: '14px 28px' }}>
              <Camera size={18} /> Take photo
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
