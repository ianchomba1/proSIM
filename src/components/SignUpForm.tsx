import React, { useState } from 'react';
import { User, Mail, Building, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SignUpFormProps {
  onSuccess: (name: string, email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('it_admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple password strength check
  const getPasswordStrength = () => {
    if (!password) return { label: '', color: '', percent: 0 };
    if (password.length < 6) return { label: 'Weak', color: '#ef4444', percent: 33 };
    if (password.length < 10 || !/\d/.test(password)) return { label: 'Moderate', color: '#f59e0b', percent: 66 };
    return { label: 'Strong', color: '#10b981', percent: 100 };
  };

  const strength = getPasswordStrength();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid institutional email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    // Simulate API registration delay
    setTimeout(() => {
      setIsLoading(false);
      onSuccess(fullName, email);
    }, 1200);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Full Name Field */}
      <div className="form-group">
        <label className="form-label" htmlFor="fullname-input">
          Full Name
        </label>
        <div className="input-container">
          <User className="input-icon" size={18} />
          <input
            id="fullname-input"
            type="text"
            className="form-input"
            placeholder="Dr. Alexander Vance"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Institutional Email Field */}
      <div className="form-group">
        <label className="form-label" htmlFor="signup-email">
          Institutional Email
        </label>
        <div className="input-container">
          <Mail className="input-icon" size={18} />
          <input
            id="signup-email"
            type="email"
            className="form-input"
            placeholder="a.vance@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Department / Role Dropdown */}
      <div className="form-group">
        <label className="form-label" htmlFor="department-select">
          Department / Administrative Role
        </label>
        <div className="input-container">
          <Building className="input-icon" size={18} />
          <select
            id="department-select"
            className="form-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={isLoading}
            style={{ appearance: 'none', cursor: 'pointer' }}
          >
            <option value="it_admin">IT & Telecom Infrastructure</option>
            <option value="network_ops">Network Operations Center</option>
            <option value="faculty_lead">Faculty Research Lead</option>
            <option value="campus_security">Campus Security & Assets</option>
            <option value="finance">Institutional Finance & Logistics</option>
          </select>
        </div>
      </div>

      {/* Password Field */}
      <div className="form-group">
        <label className="form-label" htmlFor="signup-password">
          Create Password
        </label>
        <div className="input-container">
          <Lock className="input-icon" size={18} />
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input has-toggle"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Strength Indicator */}
        {password && (
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8c9cb0' }}>
              <span>Security level</span>
              <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
            </div>
            <div style={{ height: '4px', background: '#172233', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${strength.percent}%`, height: '100%', background: strength.color, transition: 'all 0.3s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="form-group">
        <label className="form-label" htmlFor="confirm-password">
          Confirm Password
        </label>
        <div className="input-container">
          <Lock className="input-icon" size={18} />
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
          />
          {confirmPassword && confirmPassword === password && (
            <div style={{ position: 'absolute', right: '14px', color: '#10b981', display: 'flex' }}>
              <CheckCircle2 size={16} />
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button type="submit" className="btn-primary" disabled={isLoading}>
        {isLoading ? (
          <>
            <div className="spinner" />
            <span>Creating Institutional Account...</span>
          </>
        ) : (
          <>
            <span>Create Account</span>
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
};
