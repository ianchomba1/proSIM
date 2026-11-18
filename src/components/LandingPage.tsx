import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Check,
  Radar,
  ScanFace,
  Activity,
  ClipboardCheck,
  BrainCircuit,
  BellRing,
  FolderSearch,
  FileText,
  UserX,
  Users,
  ChartLine,
  Hourglass,
  Sun,
  Moon
} from 'lucide-react';
import { CrestLogo } from './CrestLogo';
import './LandingPage.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onSignIn,
  theme: controlledTheme,
  onToggleTheme
}) => {
  const [internalTheme, setInternalTheme] = useState<'light' | 'dark'>('light');
  const theme = controlledTheme ?? internalTheme;
  const isLight = theme === 'light';
  const toggleTheme = onToggleTheme ?? (() => setInternalTheme((t) => (t === 'light' ? 'dark' : 'light')));

  // Active Capability Tab in Hero Showcase
  const [activeCap, setActiveCap] = useState<number>(0);

  const capabilities = [
    {
      id: 'anomaly',
      title: 'AI Anomaly Detection',
      desc: 'Applies machine learning techniques, including Isolation Forest, to identify unusual SIM usage patterns and potential misuse.',
      pillText: 'Intelligent Misuse Detection',
      Icon: Radar
    },
    {
      id: 'identity',
      title: 'Identity Verification',
      desc: 'Supports identity document validation and photograph verification to help identify inconsistencies during SIM registration.',
      pillText: 'AI-Assisted Identity Verification',
      Icon: ScanFace
    },
    {
      id: 'monitoring',
      title: 'SIM Monitoring',
      desc: 'Tracks usage patterns such as data consumption, call duration, and changes in SIM activity to establish behavioural baselines.',
      pillText: 'SIM Usage Monitoring',
      Icon: Activity
    }
  ];

  const problems = [
    {
      title: 'Identity fraud and fake registrations',
      desc: 'Registration using falsified, stolen, or inaccurate subscriber information.',
      Icon: UserX
    },
    {
      title: 'Unauthorized SIM usage',
      desc: 'SIM cards being used by individuals other than their registered subscribers.',
      Icon: Users
    },
    {
      title: 'Unusual usage patterns',
      desc: 'Abnormal data consumption, unexpected call activity, or sudden changes in usage behaviour.',
      Icon: ChartLine
    },
    {
      title: 'Delayed detection of misuse',
      desc: 'Without intelligent monitoring, suspicious SIM activity may go unnoticed until significant damage occurs.',
      Icon: Hourglass
    }
  ];

  // Bento layout: wide cards alternate sides so three full rows form (2+1, 1+2, 1+2)
  const offers = [
    {
      title: 'Secure SIM Registration',
      desc: 'A structured registration process that captures subscriber information and supporting identity documents to improve registration accuracy and accountability.',
      Icon: ClipboardCheck,
      wide: true
    },
    {
      title: 'AI-Assisted Identity Verification',
      desc: 'Supports identity document validation and photograph verification to help identify inconsistencies during SIM registration.',
      Icon: ScanFace,
      wide: false
    },
    {
      title: 'Intelligent Misuse Detection',
      desc: 'Applies machine learning techniques, including Isolation Forest, to identify unusual SIM usage patterns and potential misuse.',
      Icon: BrainCircuit,
      wide: false
    },
    {
      title: 'SIM Usage Monitoring',
      desc: 'Tracks usage patterns such as data consumption, call duration, and changes in SIM activity to establish behavioural baselines.',
      Icon: Activity,
      wide: true
    },
    {
      title: 'Real-Time Suspicious Activity Alerts',
      desc: 'Generates alerts when SIM activity deviates significantly from established behavioural patterns, allowing administrators to investigate.',
      Icon: BellRing,
      wide: false
    },
    {
      title: 'Misuse Case Management',
      desc: 'Provides administrators with tools to investigate flagged SIM cards, document findings, and record appropriate remedial actions.',
      Icon: FolderSearch,
      wide: true
    }
  ];

  const steps = [
    {
      title: 'Register',
      desc: 'Subscriber details and identity documents are submitted through the SIM registration process.',
      Icon: FileText
    },
    {
      title: 'Verify',
      desc: 'Identity verification checks help assess the accuracy and consistency of registration information.',
      Icon: ShieldCheck
    },
    {
      title: 'Monitor',
      desc: 'SIM usage data is analysed against established behavioural patterns using AI models.',
      Icon: Activity
    },
    {
      title: 'Detect and Respond',
      desc: 'Suspicious activity is flagged, risk scores are generated, and administrators investigate potential misuse.',
      Icon: ShieldAlert
    }
  ];

  return (
    <div className="ps-page" data-theme={theme}>
      {/* Ambient Lighting */}
      <div className="ps-ambient-glow ps-glow-hero" />
      <div className="ps-ambient-glow ps-glow-middle" />

      {/* Transparent Sticky Navbar with Background Blur */}
      <header className="ps-navbar">
        <div className="ps-container ps-nav-inner">
          <div className="ps-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="ps-brand-emblem">
              <CrestLogo size={22} />
            </div>
            <div className="ps-brand-title">
              ProSIM <span className="ps-brand-dot" />
            </div>
          </div>

          {/* Navigation Pills with subtle green background */}
          <nav className="ps-nav-pills">
            <a href="#overview" className="ps-nav-pill">Overview</a>
            <a href="#problem" className="ps-nav-pill">The Problem</a>
            <a href="#features" className="ps-nav-pill">Features</a>
            <a href="#how-it-works" className="ps-nav-pill">How It Works</a>
          </nav>

          <div className="ps-nav-actions">
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="ps-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button type="button" className="ps-btn-ghost-pill" onClick={onSignIn}>
              Sign In
            </button>
            <button type="button" className="ps-btn-primary-pill" onClick={onGetStarted}>
              Get Started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="ps-hero" id="overview">
        <div className="ps-container">
          <div className="ps-hero-grid">
            {/* Hero Left Content */}
            <div>
              <div className="ps-hero-badge">
                <span className="ps-badge-pulse" />
                <span>AI-Powered Security</span>
              </div>

              <h1 className="ps-hero-title">
                Smarter SIM Registration.
                <br />
                <span className="ps-green-highlight">Safer SIM Usage.</span>
                <span className="ps-cursor-blink">|</span>
              </h1>

              <p className="ps-hero-desc">
                An intelligent SIM registration and misuse detection platform that uses artificial intelligence to identify suspicious SIM activity, verify subscriber identities, and strengthen SIM accountability.
              </p>

              <div className="ps-hero-actions">
                <button
                  type="button"
                  className="ps-btn-primary-pill ps-btn-large"
                  onClick={onGetStarted}
                >
                  Get Started <ArrowRight size={17} />
                </button>

                <a href="#features" className="ps-btn-outline-pill">
                  Explore Features ↓
                </a>
              </div>

              {/* Metrics Bar: Detect. Monitor. Protect. */}
              <div className="ps-hero-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="ps-metric-item">
                  <span className="ps-metric-val">Detect.</span>
                  <span className="ps-metric-lbl">Suspicious SIM activity</span>
                </div>
                <div className="ps-metric-item">
                  <span className="ps-metric-val">Monitor.</span>
                  <span className="ps-metric-lbl">SIM usage patterns</span>
                </div>
                <div className="ps-metric-item">
                  <span className="ps-metric-val">Protect.</span>
                  <span className="ps-metric-lbl">Subscriber identities</span>
                </div>
              </div>
            </div>

            {/* Hero Right: Interactive Showcase Card (Ramotion / Source Network Inspired) */}
            <div className="ps-showcase-card">
              {/* Left Capabilities Selector */}
              <div className="ps-caps-list">
                {capabilities.map((cap, index) => {
                  const isActive = activeCap === index;
                  return (
                    <button
                      key={cap.id}
                      type="button"
                      className={`ps-cap-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveCap(index)}
                    >
                      <div className="ps-cap-left">
                        <cap.Icon size={16} className="ps-cap-icon" />
                        <span>{cap.title}</span>
                      </div>
                      {isActive && <Check size={14} color={isLight ? "#1d4ed8" : "#2563EB"} />}
                    </button>
                  );
                })}
              </div>

              {/* Right Feature Illustration & Details */}
              <div className="ps-cap-display">
                {/* Clean Blue Wireframe Vector (Orbiting Satellite & Sphere) */}
                <div className="ps-vector-wrap">
                  <svg className="ps-vector-svg" viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Wireframe Sphere / Globe */}
                    <circle cx="120" cy="70" r="42" stroke={isLight ? "rgba(29, 78, 216, 0.35)" : "rgba(37, 99, 235, 0.35)"} strokeWidth="1.2" strokeDasharray="3 3" />
                    <ellipse cx="120" cy="70" rx="42" ry="16" stroke={isLight ? "rgba(29, 78, 216, 0.4)" : "rgba(37, 99, 235, 0.4)"} strokeWidth="1" />
                    <line x1="120" y1="28" x2="120" y2="112" stroke={isLight ? "rgba(29, 78, 216, 0.3)" : "rgba(37, 99, 235, 0.3)"} strokeWidth="1" />
                    
                    {/* Orbit Path */}
                    <path d="M 40,40 Q 120,-10 200,60" stroke={isLight ? "#1d4ed8" : "#2563EB"} strokeWidth="1.4" fill="none" opacity="0.85" />
                    
                    {/* Network Nodes on Sphere */}
                    <circle cx="100" cy="65" r="3.5" fill={isLight ? "#1d4ed8" : "#2563EB"} />
                    <circle cx="140" cy="74" r="3.5" fill={isLight ? "#1d4ed8" : "#2563EB"} />
                    <circle cx="100" cy="65" r="8" stroke={isLight ? "rgba(29, 78, 216, 0.35)" : "rgba(37, 99, 235, 0.4)"} strokeWidth="1" />
                    
                    {/* Satellite Geometric Cube */}
                    <g transform="translate(180, 48) scale(0.65)">
                      <rect x="0" y="8" width="16" height="16" stroke={isLight ? "#1d4ed8" : "#2563EB"} strokeWidth="1.5" fill={isLight ? "#ffffff" : "#07090c"} />
                      <line x1="-12" y1="16" x2="0" y2="16" stroke={isLight ? "#1d4ed8" : "#2563EB"} strokeWidth="1.5" />
                      <line x1="16" y1="16" x2="28" y2="16" stroke={isLight ? "#1d4ed8" : "#2563EB"} strokeWidth="1.5" />
                      <circle cx="8" cy="16" r="2" fill={isLight ? "#1d4ed8" : "#2563EB"} />
                    </g>
                  </svg>
                </div>

                <div className="ps-cap-content">
                  <h3 className="ps-cap-title">{capabilities[activeCap].title}</h3>
                  <p className="ps-cap-desc">{capabilities[activeCap].desc}</p>
                  
                  <div className="ps-cap-status-pill">
                    <CheckCircle2 size={13} />
                    <span>{capabilities[activeCap].pillText}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem ProSIM Solves */}
      <section className="ps-section" id="problem">
        <div className="ps-container">
          <div className="ps-section-header">
            <span className="ps-section-tag">The Problem</span>
            <h2 className="ps-section-title">The Challenge of SIM Card Misuse</h2>
            <p className="ps-section-desc">
              SIM cards are widely used for communication, digital transactions, and connected devices. However, inadequate registration controls and limited monitoring can create opportunities for:
            </p>
          </div>

          <div className="ps-steps-grid ps-steps-4">
            {problems.map((p, i) => (
              <div key={p.title} className="ps-step-card">
                <span className="ps-step-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="ps-step-icon">
                  <p.Icon size={22} />
                </div>
                <h3 className="ps-step-title">{p.title}</h3>
                <p className="ps-step-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What ProSIM Offers: Feature Bento Grid */}
      <section className="ps-section" id="features">
        <div className="ps-container">
          <div className="ps-section-header">
            <span className="ps-section-tag">What ProSIM Offers</span>
            <h2 className="ps-section-title">Secure Registration and Intelligent Misuse Detection</h2>
            <p className="ps-section-desc">
              ProSIM leverages AI-driven analytics and identity verification to detect SIM misuse, monitor suspicious activity, and promote secure and accountable SIM card management.
            </p>
          </div>

          <div className="ps-bento-grid">
            {offers.map((o) => (
              <div key={o.title} className={`ps-bento-card ${o.wide ? 'ps-bento-2col' : ''}`}>
                <div className="ps-bento-icon">
                  <o.Icon size={22} />
                </div>
                <h3 className="ps-bento-title">{o.title}</h3>
                <p className="ps-bento-desc">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How ProSIM Works: Step Cards */}
      <section className="ps-section" id="how-it-works">
        <div className="ps-container">
          <div className="ps-section-header">
            <span className="ps-section-tag">How ProSIM Works</span>
            <h2 className="ps-section-title">From Registration to Response in 4 Steps</h2>
          </div>

          <div className="ps-steps-grid ps-steps-4">
            {steps.map((s, i) => (
              <div key={s.title} className="ps-step-card">
                <span className="ps-step-num">STEP {String(i + 1).padStart(2, '0')}</span>
                <div className="ps-step-icon">
                  <s.Icon size={22} />
                </div>
                <h3 className="ps-step-title">{s.title}</h3>
                <p className="ps-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* High-Contrast Climax Banner (Stark White Balance + Emerald Glow) */}
      <section className="ps-climax-section">
        <div className="ps-container">
          <div className="ps-climax-card">
            <div className="ps-climax-content">
              <span className="ps-climax-tag">Detect • Monitor • Protect</span>
              <h2 className="ps-climax-title">
                Smarter SIM Registration. Safer SIM Usage.
              </h2>
              <p className="ps-climax-desc">
                Verify subscriber identities, monitor SIM activity, and strengthen SIM accountability with ProSIM.
              </p>
            </div>

            <button
              type="button"
              className="ps-btn-climax-dark"
              onClick={onGetStarted}
            >
              Get Started <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ps-footer">
        <div className="ps-container">
          <div className="ps-footer-grid">
            <div className="ps-footer-col" style={{ maxWidth: '360px' }}>
              <div className="ps-brand" style={{ marginBottom: '14px' }}>
                <div className="ps-brand-emblem">
                  <CrestLogo size={20} />
                </div>
                <div className="ps-brand-title">ProSIM</div>
              </div>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                An intelligent SIM registration and misuse detection platform that uses artificial intelligence to identify suspicious SIM activity, verify subscriber identities, and strengthen SIM accountability.
              </p>
            </div>

            <div className="ps-footer-col">
              <span className="ps-footer-head">Platform</span>
              <a href="#overview" className="ps-footer-link">Overview</a>
              <a href="#problem" className="ps-footer-link">The Problem</a>
              <a href="#features" className="ps-footer-link">Features</a>
              <a href="#how-it-works" className="ps-footer-link">How It Works</a>
            </div>

            <div className="ps-footer-col">
              <span className="ps-footer-head">Access</span>
              <span className="ps-footer-link" style={{ cursor: 'pointer' }} onClick={onSignIn}>
                Administrative Sign In
              </span>
              <span className="ps-footer-link" style={{ cursor: 'pointer' }} onClick={onGetStarted}>
                Get Started
              </span>
            </div>

            <div className="ps-footer-col">
              <span className="ps-footer-head">Statutory</span>
              <span className="ps-footer-link">Communications Authority of Kenya (CA)</span>
              <span className="ps-footer-link">Kenya Data Protection Act 2019</span>
              <span className="ps-footer-link">GOK ID-1 Document Standard</span>
            </div>
          </div>

          <div className="ps-footer-bar">
            <span>© 2026 ProSIM Enterprise Telecom Services. All rights reserved.</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ps-brand-dot" />
              <span style={{ color: 'var(--ps-green-text)' }}>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
