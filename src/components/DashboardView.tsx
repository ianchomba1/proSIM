import React, { useState } from 'react';
import {
  LayoutGrid,
  CreditCard,
  Bell,
  TrendingUp,
  Settings,
  Radio,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  X,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

interface SimItem {
  id: string;
  iccid: string;
  phone: string;
  user: string;
  dept: string;
  status: 'Active' | 'Suspended' | 'Deactivated';
  lastActive: string;
  riskLevel: 1 | 2 | 3;
}

interface DashboardViewProps {
  userEmail: string;
  userName?: string;
  onSignOut: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userEmail: _userEmail,
  userName = 'Admin',
  onSignOut
}) => {
  const [activeNav, setActiveNav] = useState('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('Any');

  // Action dropdown state
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Register New SIM Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newIccid, setNewIccid] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newDept, setNewDept] = useState('IT Ops');
  const [newStatus, setNewStatus] = useState<'Active' | 'Suspended' | 'Deactivated'>('Active');
  const [formError, setFormError] = useState('');

  // Initial SIM inventory matching the user's screenshot
  const [sims, setSims] = useState<SimItem[]>([
    {
      id: 'sim-1',
      iccid: '8925402000001928374',
      phone: '+254 712 345 678',
      user: 'Dr. Jane Doe',
      dept: 'IT Ops',
      status: 'Active',
      lastActive: '2 mins ago',
      riskLevel: 1
    },
    {
      id: 'sim-2',
      iccid: '8925402000001928375',
      phone: '+254 722 987 654',
      user: 'Backup Router B',
      dept: 'Facilities',
      status: 'Suspended',
      lastActive: '2 days ago',
      riskLevel: 2
    },
    {
      id: 'sim-3',
      iccid: '8925402000001928376',
      phone: '+254 733 111 222',
      user: 'Unassigned',
      dept: 'Security',
      status: 'Deactivated',
      lastActive: '14 Nov 2023',
      riskLevel: 3
    },
    {
      id: 'sim-4',
      iccid: '8925402000001928377',
      phone: '+254 700 555 444',
      user: 'IoT Sensor Hub 1',
      dept: 'IT Ops',
      status: 'Active',
      lastActive: 'Just now',
      riskLevel: 1
    }
  ]);

  // Filtered SIMs
  const filteredSims = sims.filter((sim) => {
    const matchesSearch =
      sim.iccid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sim.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sim.user.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || sim.status === statusFilter;
    const matchesDept = deptFilter === 'All' || sim.dept === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  const handleRegisterSim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIccid.trim() || !newPhone.trim() || !newUser.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const createdSim: SimItem = {
      id: `sim-${Date.now()}`,
      iccid: newIccid.trim(),
      phone: newPhone.trim(),
      user: newUser.trim(),
      dept: newDept,
      status: newStatus,
      lastActive: 'Just now',
      riskLevel: 1
    };

    setSims([createdSim, ...sims]);
    setIsModalOpen(false);
    setNewIccid('');
    setNewPhone('');
    setNewUser('');
    setFormError('');
  };

  const handleCopyIccid = (iccid: string, id: string) => {
    navigator.clipboard.writeText(iccid);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = (id: string, newStatus: 'Active' | 'Suspended' | 'Deactivated') => {
    setSims(sims.map((s) => s.id === id ? { ...s, status: newStatus } : s));
    setOpenActionId(null);
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      {/* LEFT SIDEBAR */}
      <aside style={{
        width: '260px',
        backgroundColor: '#070b13',
        borderRight: '1px solid #141c2c',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        flexShrink: 0
      }}>
        {/* Brand Logo Header */}
        <div style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: '1.5px',
          color: '#ffffff',
          marginBottom: '26px',
          paddingLeft: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ color: '#60a5fa' }}>SIM</span>
          <span>PORTAL</span>
        </div>

        {/* Admin Profile Box */}
        <div style={{
          backgroundColor: '#0e1524',
          border: '1px solid #1a253a',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#1d2a44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #293d63',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {/* Avatar icon / photo placeholder */}
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
              alt="Admin"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // Fallback to stylized SVG avatar if network image is blocked
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              {userName || 'Admin'}
            </span>
            <span style={{ fontSize: '12px', color: '#8c9cb0', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Network Operations
            </span>
            <span style={{ fontSize: '11px', color: '#4b5b72', marginTop: '2px', fontWeight: 500 }}>
              v2.4.0
            </span>
          </div>
        </div>

        {/* Navigation Menu (Top section) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setActiveNav('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'dashboard' ? '#182337' : 'transparent',
              color: activeNav === 'dashboard' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: activeNav === 'dashboard' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <LayoutGrid size={18} color={activeNav === 'dashboard' ? '#60a5fa' : '#64748b'} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveNav('inventory')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeNav === 'inventory' ? '1px solid #233552' : 'none',
              backgroundColor: activeNav === 'inventory' ? '#182337' : 'transparent',
              color: activeNav === 'inventory' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: activeNav === 'inventory' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: activeNav === 'inventory' ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <CreditCard size={18} color={activeNav === 'inventory' ? '#60a5fa' : '#64748b'} />
            <span>Inventory</span>
          </button>

          <button
            onClick={() => setActiveNav('alerts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'alerts' ? '#182337' : 'transparent',
              color: activeNav === 'alerts' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: activeNav === 'alerts' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Bell size={18} color={activeNav === 'alerts' ? '#60a5fa' : '#64748b'} />
            <span>Alerts</span>
          </button>

          <button
            onClick={() => setActiveNav('analytics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'analytics' ? '#182337' : 'transparent',
              color: activeNav === 'analytics' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: activeNav === 'analytics' ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <TrendingUp size={18} color={activeNav === 'analytics' ? '#60a5fa' : '#64748b'} />
            <span>Analytics</span>
          </button>
        </nav>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#141c2c', margin: '24px 8px' }} />

        {/* Navigation Menu (Bottom section) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setActiveNav('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'settings' ? '#182337' : 'transparent',
              color: activeNav === 'settings' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Settings size={18} color="#64748b" />
            <span>Account Settings</span>
          </button>

          <button
            onClick={() => setActiveNav('network')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'network' ? '#182337' : 'transparent',
              color: activeNav === 'network' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Radio size={18} color="#64748b" />
            <span>Network Config</span>
          </button>

          <button
            onClick={() => setActiveNav('security')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeNav === 'security' ? '#182337' : 'transparent',
              color: activeNav === 'security' ? '#ffffff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldCheck size={18} color="#64748b" />
            <span>Security Audit</span>
          </button>
        </nav>

        {/* Sign Out at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button
            onClick={onSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #231b26',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT */}
      <main style={{
        flex: 1,
        padding: '36px 40px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              margin: 0
            }}>
              SIM Inventory
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#8c9cb0',
              marginTop: '4px',
              margin: '4px 0 0 0'
            }}>
              Manage and monitor all institutional SIM cards.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              transition: 'background-color 0.2s ease'
            }}
          >
            <Plus size={16} />
            <span>Register new SIM</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Search Input */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px',
            maxWidth: '360px'
          }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by ICCID, Phone, or User..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0c121e',
                border: '1px solid #1a2538',
                borderRadius: '8px',
                padding: '9px 14px 9px 36px',
                color: '#ffffff',
                fontSize: '13.5px',
                outline: 'none'
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: '#0c121e',
                border: '1px solid #1a2538',
                borderRadius: '8px',
                padding: '9px 32px 9px 14px',
                color: '#cbd5e1',
                fontSize: '13.5px',
                cursor: 'pointer',
                appearance: 'none',
                outline: 'none'
              }}
            >
              <option value="All">Status: All</option>
              <option value="Active">Status: Active</option>
              <option value="Suspended">Status: Suspended</option>
              <option value="Deactivated">Status: Deactivated</option>
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Department Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                backgroundColor: '#0c121e',
                border: '1px solid #1a2538',
                borderRadius: '8px',
                padding: '9px 32px 9px 14px',
                color: '#cbd5e1',
                fontSize: '13.5px',
                cursor: 'pointer',
                appearance: 'none',
                outline: 'none'
              }}
            >
              <option value="All">Dept: All</option>
              <option value="IT Ops">Dept: IT Ops</option>
              <option value="Facilities">Dept: Facilities</option>
              <option value="Security">Dept: Security</option>
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Date Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                backgroundColor: '#0c121e',
                border: '1px solid #1a2538',
                borderRadius: '8px',
                padding: '9px 32px 9px 14px',
                color: '#cbd5e1',
                fontSize: '13.5px',
                cursor: 'pointer',
                appearance: 'none',
                outline: 'none'
              }}
            >
              <option value="Any">Date: Any</option>
              <option value="Today">Date: Today</option>
              <option value="This Week">Date: This Week</option>
              <option value="This Month">Date: This Month</option>
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* More Button */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0c121e',
              border: '1px solid #1a2538',
              borderRadius: '8px',
              padding: '9px 16px',
              color: '#cbd5e1',
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={14} color="#94a3b8" />
            <span>More</span>
          </button>
        </div>

        {/* DATA TABLE CARD */}
        <div style={{
          backgroundColor: '#0c121e',
          border: '1px solid #1a253a',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}>
          {/* Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13.5px'
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid #172235',
                  backgroundColor: '#080d17',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase'
                }}>
                  <th style={{ padding: '16px 20px' }}>ICCID</th>
                  <th style={{ padding: '16px 20px' }}>PHONE / MSISDN</th>
                  <th style={{ padding: '16px 20px' }}>USER / ASSIGNMENT</th>
                  <th style={{ padding: '16px 20px' }}>DEPT</th>
                  <th style={{ padding: '16px 20px' }}>STATUS</th>
                  <th style={{ padding: '16px 20px' }}>LAST ACTIVE / RISK</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSims.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                      No SIM records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredSims.map((sim, index) => {
                    const isGreen = sim.status === 'Active';
                    const isOrange = sim.status === 'Suspended';

                    const dotColor = isGreen ? '#10b981' : isOrange ? '#f59e0b' : '#ef4444';
                    const statusBg = isGreen ? 'rgba(16, 185, 129, 0.12)' : isOrange ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                    const statusText = isGreen ? '#34d399' : isOrange ? '#fbbf24' : '#f87171';
                    const statusBorder = isGreen ? 'rgba(16, 185, 129, 0.25)' : isOrange ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)';

                    return (
                      <tr
                        key={sim.id}
                        style={{
                          borderBottom: index < filteredSims.length - 1 ? '1px solid #141c2c' : 'none',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(24, 35, 55, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* ICCID */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: dotColor,
                              boxShadow: `0 0 6px ${dotColor}88`,
                              flexShrink: 0
                            }} />
                            <span style={{
                              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                              fontSize: '13px',
                              color: '#cbd5e1',
                              fontWeight: 500
                            }}>
                              {sim.iccid}
                            </span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {sim.phone}
                        </td>

                        {/* User / Assignment */}
                        <td style={{ padding: '16px 20px', color: '#ffffff', fontWeight: 500 }}>
                          {sim.user}
                        </td>

                        {/* Department */}
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          {sim.dept}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: statusBg,
                            color: statusText,
                            border: `1px solid ${statusBorder}`,
                            borderRadius: '16px',
                            padding: '3px 10px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {sim.status}
                          </span>
                        </td>

                        {/* Last Active / Risk */}
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: '#8c9cb0', fontSize: '13px' }}>
                              {sim.lastActive}
                            </span>
                            {/* Risk Dots Indicator */}
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: dotColor
                              }} />
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: sim.riskLevel >= 2 ? dotColor : '#1e293b'
                              }} />
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: sim.riskLevel >= 3 ? dotColor : '#1e293b'
                              }} />
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '16px 20px', textAlign: 'right', position: 'relative' }}>
                          <button
                            onClick={() => setOpenActionId(openActionId === sim.id ? null : sim.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {/* Action Dropdown Menu */}
                          {openActionId === sim.id && (
                            <div style={{
                              position: 'absolute',
                              right: '20px',
                              top: '46px',
                              backgroundColor: '#121a2a',
                              border: '1px solid #22324d',
                              borderRadius: '8px',
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              zIndex: 50,
                              minWidth: '160px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                              textAlign: 'left'
                            }}>
                              <button
                                onClick={() => handleCopyIccid(sim.iccid, sim.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#cbd5e1',
                                  padding: '7px 10px',
                                  fontSize: '12.5px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1c283e'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                {copiedId === sim.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                <span>{copiedId === sim.id ? 'Copied!' : 'Copy ICCID'}</span>
                              </button>

                              <button
                                onClick={() => handleUpdateStatus(sim.id, 'Active')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#34d399',
                                  padding: '7px 10px',
                                  fontSize: '12.5px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1c283e'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                Set to Active
                              </button>

                              <button
                                onClick={() => handleUpdateStatus(sim.id, 'Suspended')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#fbbf24',
                                  padding: '7px 10px',
                                  fontSize: '12.5px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1c283e'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                Suspend SIM
                              </button>

                              <button
                                onClick={() => handleUpdateStatus(sim.id, 'Deactivated')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f87171',
                                  padding: '7px 10px',
                                  fontSize: '12.5px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1c283e'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                Deactivate SIM
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div style={{
            borderTop: '1px solid #141c2c',
            backgroundColor: '#080d17',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing 1 to {filteredSims.length} of 2,451 SIMs
            </span>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #1a2538',
                  backgroundColor: '#0c121e',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                disabled
              >
                <ChevronLeft size={16} />
              </button>

              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                1
              </button>

              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #1a2538',
                backgroundColor: '#0c121e',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                2
              </button>

              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #1a2538',
                backgroundColor: '#0c121e',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                3
              </button>

              <span style={{ color: '#475569', padding: '0 4px', fontSize: '12px' }}>...</span>

              <button style={{
                width: '36px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #1a2538',
                backgroundColor: '#0c121e',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                246
              </button>

              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #1a2538',
                backgroundColor: '#0c121e',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Register New SIM */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0d1424',
            border: '1px solid #1f2e47',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Register New Institutional SIM
                </h3>
                <p style={{ fontSize: '13px', color: '#8c9cb0', marginTop: '2px', margin: '2px 0 0 0' }}>
                  Add a new SIM profile to the central inventory.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSim} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  ICCID (19-20 Digits)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8925402000001928378"
                  value={newIccid}
                  onChange={(e) => setNewIccid(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#121a2c',
                    border: '1px solid #22324d',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Phone / MSISDN
                </label>
                <input
                  type="text"
                  placeholder="e.g. +254 712 999 888"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#121a2c',
                    border: '1px solid #22324d',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  User / Assignment
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus Security Dispatch"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#121a2c',
                    border: '1px solid #22324d',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Department
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#121a2c',
                      border: '1px solid #22324d',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  >
                    <option value="IT Ops">IT Ops</option>
                    <option value="Facilities">Facilities</option>
                    <option value="Security">Security</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    style={{
                      width: '100%',
                      backgroundColor: '#121a2c',
                      border: '1px solid #22324d',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Deactivated">Deactivated</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #22324d',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 18px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save SIM Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
