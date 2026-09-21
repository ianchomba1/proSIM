import React, { useState } from 'react';
import { Mail, X, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid institutional email address.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1000);
  };

  const handleReset = () => {
    setIsSent(false);
    setEmail('');
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleReset}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Reset Portal Password</h3>
          <button className="modal-close-btn" onClick={handleReset}>
            <X size={20} />
          </button>
        </div>

        {isSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', alignItems: 'center', padding: '10px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'grid', placeContent: 'center', color: '#10b981' }}>
              <CheckCircle2 size={28} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h4 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>Recovery Link Dispatched</h4>
              <p style={{ color: '#8c9cb0', fontSize: '13.5px', lineHeight: 1.5 }}>
                We have sent authentication reset instructions to <strong style={{ color: '#ffffff' }}>{email}</strong>. Please check your institutional inbox.
              </p>
            </div>
            <button className="btn-primary" onClick={handleReset} style={{ marginTop: '8px' }}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#8c9cb0', fontSize: '13.5px', lineHeight: 1.5 }}>
              Enter your registered institutional email. We will send a secure verification code and password recovery link.
            </p>

            {error && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Institutional Email Address
              </label>
              <div className="input-container">
                <Mail className="input-icon" size={18} />
                <input
                  id="reset-email"
                  type="email"
                  className="form-input"
                  placeholder="admin@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>Dispatching Request...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Email</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
