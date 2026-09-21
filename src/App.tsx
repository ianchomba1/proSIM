import { useState } from 'react';
import { CrestLogo } from './components/CrestLogo';
import { SignInForm } from './components/SignInForm';
import { SignUpForm } from './components/SignUpForm';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { DashboardView } from './components/DashboardView';
import { Shield } from 'lucide-react';
import './index.css';

type AuthMode = 'signin' | 'signup';

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

  const handleSignInSuccess = (email: string) => {
    setUser({ email, name: email.split('@')[0].toUpperCase() });
  };

  const handleSignUpSuccess = (name: string, email: string) => {
    setUser({ name, email });
  };

  const handleSignOut = () => {
    setUser(null);
    setAuthMode('signin');
  };

  if (user) {
    return (
      <main style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <DashboardView 
          userEmail={user.email} 
          userName={user.name} 
          onSignOut={handleSignOut} 
        />
      </main>
    );
  }

  return (
    <main className="portal-wrapper">
      <div className="portal-card">
        {/* Header with emblem, title and subtitle */}
        <div className="portal-header">
          <div className="crest-container">
            <CrestLogo size={36} />
          </div>

          <h1 className="portal-title">SIM Usage Management Portal</h1>
          <p className="portal-subtitle">Secure Institutional Access</p>
        </div>

        {/* Auth Mode Toggle Tabs (Sign In / Sign Up) */}
        <div className="auth-nav-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'signin' ? 'active' : ''}`}
            onClick={() => setAuthMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => setAuthMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Dynamic Form View */}
        {authMode === 'signin' ? (
          <SignInForm
            onSuccess={handleSignInSuccess}
            onForgotPassword={() => setIsForgotPasswordOpen(true)}
          />
        ) : (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
          />
        )}

        {/* Security Notice Disclaimer Box */}
        <div className="security-disclaimer">
          <Shield className="security-icon" size={18} />
          <p className="security-text">
            Access is restricted to <strong>authorized administrative personnel</strong>. All activities are monitored and logged.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="portal-footer">
        <p>University © 2026</p>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </main>
  );
}

export default App;
