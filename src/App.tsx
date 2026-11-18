import { useState, useEffect } from 'react';
import { CrestLogo } from './components/CrestLogo';
import { SignInForm } from './components/SignInForm';
import { SignUpForm } from './components/SignUpForm';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { DashboardView } from './components/DashboardView';
import { SimRegistrationPortal } from './components/SimRegistrationPortal';
import { LandingPage } from './components/LandingPage';
import { Shield, ArrowLeft, Sun, Moon } from 'lucide-react';
import './index.css';

type AuthMode = 'signin' | 'signup';
type ViewMode = 'landing' | 'auth';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('prosim_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string; role?: string; id?: string } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('prosim_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSignInSuccess = (email: string, name?: string, role?: string, id?: string) => {
    setUser({ email, name: name || email.split('@')[0].toUpperCase(), role, id });
  };

  const handleSignUpSuccess = (name: string, email: string, role?: string, id?: string) => {
    setUser({ name, email, role, id });
  };

  const handleSignOut = () => {
    setUser(null);
    setAuthMode('signin');
    setViewMode('landing');
  };

  if (user) {
    const isAdmin = user.role?.trim().toLowerCase() === 'administrator';
    if (isAdmin) {
      return (
        <DashboardView 
          userEmail={user.email} 
          userName={user.name} 
          userId={user.id}
          onSignOut={handleSignOut}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }

    return (
      <SimRegistrationPortal
        userEmail={user.email}
        userName={user.name}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (viewMode === 'landing') {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onGetStarted={() => {
          setAuthMode('signup');
          setViewMode('auth');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSignIn={() => {
          setAuthMode('signin');
          setViewMode('auth');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <main className="portal-wrapper">
      <div className="auth-top-bar">
        <button
          type="button"
          className="back-to-home-btn"
          onClick={() => setViewMode('landing')}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        <button
          type="button"
          className="global-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div className="portal-card">
        {/* Header with emblem, title and subtitle */}
        <div className="portal-header">
          <div className="crest-container">
            <CrestLogo size={36} />
          </div>

          <h1 className="portal-title">ProSIM Enterprise Portal</h1>
          <p className="portal-subtitle">Enterprise Telecom Identity & Access</p>
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
            Access is restricted to <strong>authorized telecom and administrative personnel</strong>. All activities are monitored and logged.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="portal-footer">
        <p>ProSIM Enterprise Telecom © 2026</p>
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
