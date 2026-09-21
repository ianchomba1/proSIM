import React from 'react';
import { CrestLogo } from './CrestLogo';
import { Cpu, Wifi, Activity, ShieldCheck, LogOut, CheckCircle } from 'lucide-react';

interface DashboardViewProps {
  userEmail: string;
  userName?: string;
  onSignOut: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ userEmail, userName = 'Administrative User', onSignOut }) => {
  return (
    <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div 
        style={{
          background: 'rgba(18, 25, 38, 0.94)',
          border: '1px solid #222f42',
          borderRadius: '16px',
          padding: '24px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="crest-container" style={{ margin: 0, width: '48px', height: '48px' }}>
            <CrestLogo size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SIM Management Console
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '13px', color: '#8c9cb0' }}>{userName} ({userEmail})</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>
                <CheckCircle size={12} /> Active Session
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={onSignOut}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '13.5px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(18, 25, 38, 0.85)', border: '1px solid #222f42', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8c9cb0', fontSize: '13px' }}>
            <span>Total Active SIM Cards</span>
            <Cpu size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            1,428
          </div>
          <div style={{ fontSize: '12px', color: '#10b981' }}>+12 provisioned this week</div>
        </div>

        <div style={{ background: 'rgba(18, 25, 38, 0.85)', border: '1px solid #222f42', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8c9cb0', fontSize: '13px' }}>
            <span>Institutional Data Usage</span>
            <Wifi size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            84.2 TB
          </div>
          <div style={{ fontSize: '12px', color: '#8c9cb0' }}>68% of monthly allocation</div>
        </div>

        <div style={{ background: 'rgba(18, 25, 38, 0.85)', border: '1px solid #222f42', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8c9cb0', fontSize: '13px' }}>
            <span>Security Auditing</span>
            <ShieldCheck size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Encrypted
          </div>
          <div style={{ fontSize: '12px', color: '#10b981' }}>All telemetry logs active</div>
        </div>
      </div>

      {/* Activity Status Box */}
      <div style={{ background: 'rgba(18, 25, 38, 0.85)', border: '1px solid #222f42', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Activity size={24} color="#3b82f6" />
        <div style={{ flex: 1 }}>
          <h4 style={{ color: '#ffffff', fontSize: '14.5px', fontWeight: 600 }}>Institutional Telecom Gateway Connected</h4>
          <p style={{ color: '#8c9cb0', fontSize: '13px', marginTop: '2px' }}>
            Authenticated access established with University SIM Provisioning Server v4.2
          </p>
        </div>
      </div>
    </div>
  );
};
