import React, { useEffect, useState } from 'react';
import {
  LayoutGrid,
  CreditCard,
  Bell,
  TrendingUp,
  Settings,
  Radio,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  ClipboardList,
  Upload,
  Users,
  Menu,
  X
} from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MisuseAlertsView } from './misuse/MisuseAlertsView';
import { ApplicationsView } from './applications/ApplicationsView';
import { CdrImportView } from './dataImport/CdrImportView';
import { EmployeesView } from './employees/EmployeesView';
import { SimCardsView } from './simCards/SimCardsView';
import { AnalyticsView } from './analytics/AnalyticsView';
import { DashboardHome } from './dashboard/DashboardHome';

/** Page names shown in the phone top bar. */
const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', inventory: 'SIM Cards', employees: 'Employees', applications: 'Applications',
  alerts: 'Misuse Alerts', import: 'Data Import', analytics: 'Analytics',
  settings: 'System Settings', network: 'Network Config', security: 'Security Audit',
};

/** Titles of the sections that are not built yet. */
const SECTION_TITLES: Record<string, string> = {
  settings: 'System Settings', network: 'Network Config', security: 'Security Audit',
};

interface DashboardViewProps {
  userEmail: string;
  userName?: string;
  /** users.id of the signed-in administrator (recorded on misuse reviews). */
  userId?: string;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userEmail,
  userName = 'Admin',
  userId,
  onSignOut,
  theme = 'light',
  onToggleTheme
}) => {
  const [activeNav, setActiveNavState] = useState('dashboard');
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  // Picking a page also closes the slide-out menu on phones
  const setActiveNav = (key: string) => { setActiveNavState(key); setMenuOpen(false); };

  // Escape closes the phone menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const mainStyle: React.CSSProperties = {
    flex: 1, padding: isMobile ? '20px 16px 32px' : '36px 40px', overflowY: 'auto', minWidth: 0,
  };

  // Compute clean monogram initials for realistic enterprise avatar
  const getInitials = (name: string, email?: string) => {
    const clean = name.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const initials = getInitials(userName, userEmail);

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '10px 14px',
    borderRadius: '9999px',
    border: isActive ? '1px solid var(--card-border)' : '1px solid transparent',
    backgroundColor: isActive ? 'var(--accent-green-dim)' : 'transparent',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: '13.5px',
    fontWeight: isActive ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-dark)',
      backgroundImage: 'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
      backgroundSize: '54px 54px',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      {/* PHONE TOP BAR (the sidebar slides out from the menu button) */}
      {isMobile && (
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--card-border)'
        }}>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px',
              borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--card-bg-elevated)',
              color: 'var(--text-primary)', cursor: 'pointer'
            }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ProSIM
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {SECTION_LABELS[activeNav] ?? ''}
          </span>
          <span style={{
            marginLeft: 'auto', flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 800,
            color: 'var(--accent-green)', background: 'var(--accent-green-dim)', border: '1px solid var(--card-border)'
          }}>
            {initials}
          </span>
        </header>
      )}

      {/* Backdrop behind the open menu on phones */}
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 55, backgroundColor: 'rgba(2, 6, 23, 0.55)' }}
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside
        aria-label="Admin navigation"
        style={{
          width: isMobile ? 'min(300px, 86vw)' : '264px',
          backgroundColor: 'var(--card-bg)',
          borderRight: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
          flexShrink: 0,
          transition: 'all 0.3s ease',
          ...(isMobile ? {
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 60,
            overflowY: 'auto',
            transform: menuOpen ? 'translateX(0)' : 'translateX(-105%)',
            visibility: menuOpen ? 'visible' : 'hidden',
            boxShadow: menuOpen ? '0 20px 60px rgba(0, 0, 0, 0.45)' : 'none'
          } : {})
        }}
      >
        {/* Brand Logo Header */}
        <div style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          marginBottom: '26px',
          paddingLeft: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span>ProSIM</span>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)',
            boxShadow: '0 0 10px var(--accent-glow)'
          }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-green)',
            background: 'var(--accent-green-dim)',
            border: '1px solid var(--card-border)',
            padding: '2px 8px',
            borderRadius: '9999px',
            marginLeft: 'auto'
          }}>
            ADMIN
          </span>
          {isMobile && (
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px',
                borderRadius: '10px', border: '1px solid var(--card-border)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Enterprise Operator Profile Box (Realistic Monogram + Presence) */}
        <div style={{
          backgroundColor: 'var(--card-bg-elevated)',
          border: '1px solid var(--card-border)',
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '26px',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
        }}>
          {/* Monogram Avatar with Live Presence Indicator */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, var(--accent-green-dim) 0%, rgba(37, 99, 235, 0.22) 100%)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
              fontWeight: 800,
              fontSize: '14.5px',
              letterSpacing: '0.04em',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              {initials}
            </div>
            {/* Live presence pip */}
            <span
              title="Session Active • Encrypted TLS"
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)',
                border: '2px solid var(--card-bg-elevated)',
                boxShadow: '0 0 8px var(--accent-glow)'
              }}
            />
          </div>

          {/* Profile Identity Details */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {userName || 'Administrator'}
              </span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 800,
                color: 'var(--accent-green)',
                backgroundColor: 'var(--accent-green-dim)',
                border: '1px solid var(--card-border)',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.05em'
              }}>
                ADMIN
              </span>
            </div>

            <span style={{
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {userEmail || 'Telecom Operations'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)'
              }} />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Online • SecOps Root
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu (Top section) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setActiveNav('dashboard')}
            style={navItemStyle(activeNav === 'dashboard')}
          >
            <LayoutGrid size={17} color={activeNav === 'dashboard' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveNav('inventory')}
            style={navItemStyle(activeNav === 'inventory')}
          >
            <CreditCard size={17} color={activeNav === 'inventory' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>SIM Cards</span>
          </button>

          <button
            onClick={() => setActiveNav('employees')}
            style={navItemStyle(activeNav === 'employees')}
          >
            <Users size={17} color={activeNav === 'employees' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Employees</span>
          </button>

          <button
            onClick={() => setActiveNav('applications')}
            style={navItemStyle(activeNav === 'applications')}
          >
            <ClipboardList size={17} color={activeNav === 'applications' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Applications</span>
          </button>

          <button
            onClick={() => setActiveNav('alerts')}
            style={navItemStyle(activeNav === 'alerts')}
          >
            <Bell size={17} color={activeNav === 'alerts' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Misuse Alerts</span>
          </button>

          <button
            onClick={() => setActiveNav('import')}
            style={navItemStyle(activeNav === 'import')}
          >
            <Upload size={17} color={activeNav === 'import' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Data Import</span>
          </button>

          <button
            onClick={() => setActiveNav('analytics')}
            style={navItemStyle(activeNav === 'analytics')}
          >
            <TrendingUp size={17} color={activeNav === 'analytics' ? 'var(--accent-green)' : 'var(--text-muted)'} />
            <span>Analytics</span>
          </button>
        </nav>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '20px 8px' }} />

        {/* Navigation Menu (Bottom section) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setActiveNav('settings')}
            style={navItemStyle(activeNav === 'settings')}
          >
            <Settings size={17} color="var(--text-muted)" />
            <span>System Settings</span>
          </button>

          <button
            onClick={() => setActiveNav('network')}
            style={navItemStyle(activeNav === 'network')}
          >
            <Radio size={17} color="var(--text-muted)" />
            <span>Network Config</span>
          </button>

          <button
            onClick={() => setActiveNav('security')}
            style={navItemStyle(activeNav === 'security')}
          >
            <ShieldCheck size={17} color="var(--text-muted)" />
            <span>Security Audit</span>
          </button>
        </nav>

        {/* Theme Toggle & Sign Out at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '9999px',
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--accent-green-dim)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
            </button>
          )}

          <button
            onClick={onSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              backgroundColor: 'var(--danger-dim)',
              color: 'var(--danger)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT */}
      {activeNav === 'dashboard' ? (
        <main style={mainStyle}>
          <DashboardHome userId={userId} userName={userName} userEmail={userEmail} onNavigate={setActiveNav} />
        </main>
      ) : activeNav === 'employees' ? (
        <main style={mainStyle}>
          <EmployeesView adminId={userId} />
        </main>
      ) : activeNav === 'import' ? (
        <main style={mainStyle}>
          <CdrImportView reviewerId={userId} onViewAlerts={() => setActiveNav('alerts')} />
        </main>
      ) : activeNav === 'applications' ? (
        <main style={mainStyle}>
          <ApplicationsView reviewerId={userId} />
        </main>
      ) : activeNav === 'alerts' ? (
        <main style={mainStyle}>
          <MisuseAlertsView reviewerId={userId} />
        </main>
      ) : activeNav === 'inventory' ? (
        <main style={mainStyle}>
          <SimCardsView adminId={userId} />
        </main>
      ) : activeNav === 'analytics' ? (
        <main style={mainStyle}>
          <AnalyticsView />
        </main>
      ) : (
        <main style={mainStyle}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
            {SECTION_TITLES[activeNav] ?? 'Coming soon'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>This section isn't built yet.</p>
        </main>
      )}
    </div>
  );
};
