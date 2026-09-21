import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

interface SignInFormProps {
  onSuccess: (email: string) => void;
  onForgotPassword: () => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({ onSuccess, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your institutional email address.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid institutional email address (e.g., admin@university.edu).');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    // Simulate API sign-in delay
    setTimeout(() => {
      setIsLoading(false);
      onSuccess(email);
    }, 1000);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Institutional Email Field */}
      <div className="form-group">
        <label className="form-label" htmlFor="email-input">
          Institutional Email
        </label>
        <div className="input-container">
          <Mail className="input-icon" size={18} />
          <input
            id="email-input"
            type="email"
            className="form-input"
            placeholder="admin@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="username"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label" htmlFor="password-input">
            Password
          </label>
          <button
            type="button"
            className="form-link"
            onClick={onForgotPassword}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Forgot password?
          </button>
        </div>
        <div className="input-container">
          <Lock className="input-icon" size={18} />
          <input
            id="password-input"
            type={showPassword ? 'text' : 'password'}
            className="form-input has-toggle"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Remember Me Option */}
      <div className="remember-row">
        <input
          id="remember-me"
          type="checkbox"
          className="remember-checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <label htmlFor="remember-me" className="remember-label">
          Keep me signed in on this device
        </label>
      </div>

      {/* Submit Button */}
      <button type="submit" className="btn-primary" disabled={isLoading}>
        {isLoading ? (
          <>
            <div className="spinner" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <span>Sign in</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
};
