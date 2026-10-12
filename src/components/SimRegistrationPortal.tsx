import React, { useState } from 'react';
import { 
  Menu, 
  Bell, 
  User, 
  Info, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  ChevronDown, 
  LogOut,
  Smartphone,
  Copy,
  Check,
  Building,
  CreditCard,
  Phone,
  Calendar
} from 'lucide-react';

interface SimRegistrationPortalProps {
  userName?: string;
  userEmail?: string;
  onSignOut: () => void;
}

export const SimRegistrationPortal: React.FC<SimRegistrationPortalProps> = ({
  userName = 'Jane Doe',
  userEmail = 'j.doe@university.edu',
  onSignOut
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isCompleted, setIsCompleted] = useState(false);

  // Form State for Subscriber Details
  const [fullName, setFullName] = useState(userName !== 'Administrative User' ? userName : 'Jane Doe');
  const [institutionalId, setInstitutionalId] = useState('SU-8924-X');
  const [dob, setDob] = useState('1995-08-15');
  const [department, setDepartment] = useState('Network Operations');
  const [contactPhone, setContactPhone] = useState('+254 712 345 678');

  // Verification Step State
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Toast / Copy notification state
  const [copied, setCopied] = useState(false);

  // Handle Step Navigation
  const handleProceedToVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(2);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.length < 4) {
      setVerificationError('Please enter a valid 6-digit verification code.');
      return;
    }
    setVerificationError('');
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setCurrentStep(3);
    }, 800);
  };

  const handleFinalSubmit = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsCompleted(true);
    }, 1000);
  };

  const copyIccid = () => {
    navigator.clipboard.writeText('8925400192837465192F');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header Navbar */}
      <header style={{
        height: '64px',
        backgroundColor: '#0c111c',
        borderBottom: '1px solid #1a2333',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '6px' }}
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Center Portal Brand Title */}
        <div style={{
          fontSize: '17px',
          fontWeight: 700,
          letterSpacing: '2px',
          color: '#ffffff',
          textTransform: 'uppercase',
          fontFamily: "'Inter', sans-serif"
        }}>
          SIM PORTAL
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button 
            style={{ position: 'relative', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', display: 'flex' }}
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '8px',
              height: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%'
            }} />
          </button>

          <button 
            onClick={onSignOut}
            title="Sign Out"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        maxWidth: '1060px',
        width: '100%',
        margin: '0 auto',
        padding: '36px 24px 60px',
        boxSizing: 'border-box'
      }}>
        {/* Page Title & Subtitle */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px'
          }}>
            SIM Registration
          </h1>
          <p style={{
            fontSize: '14.5px',
            color: '#94a3b8',
            margin: 0,
            lineHeight: 1.5
          }}>
            Complete the institutional verification process to provision a new network identifier.
          </p>
        </div>

        {!isCompleted ? (
          <>
            {/* 3-Step Progress Indicator Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '560px',
              margin: '0 auto 44px'
            }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: currentStep >= 1 ? '#a5c4ff' : '#172233',
                  color: currentStep >= 1 ? '#0a101d' : '#64748b',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 1 ? '0 0 16px rgba(165, 196, 255, 0.4)' : 'none'
                }}>
                  1
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 1 ? 600 : 400,
                  color: currentStep === 1 ? '#ffffff' : '#64748b'
                }}>
                  Subscriber
                </span>
              </div>

              {/* Connecting Line 1 */}
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: currentStep >= 2 ? '#3b82f6' : '#1e293b',
                margin: '0 12px 24px',
                transition: 'all 0.3s ease'
              }} />

              {/* Step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: currentStep >= 2 ? '#a5c4ff' : '#172233',
                  border: currentStep >= 2 ? 'none' : '1px solid #27364d',
                  color: currentStep >= 2 ? '#0a101d' : '#64748b',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 2 ? '0 0 16px rgba(165, 196, 255, 0.4)' : 'none'
                }}>
                  2
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 2 ? 600 : 400,
                  color: currentStep === 2 ? '#ffffff' : '#64748b'
                }}>
                  Verification
                </span>
              </div>

              {/* Connecting Line 2 */}
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: currentStep >= 3 ? '#3b82f6' : '#1e293b',
                margin: '0 12px 24px',
                transition: 'all 0.3s ease'
              }} />

              {/* Step 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: currentStep === 3 ? '#a5c4ff' : '#172233',
                  border: currentStep === 3 ? 'none' : '1px solid #27364d',
                  color: currentStep === 3 ? '#0a101d' : '#64748b',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 3 ? '0 0 16px rgba(165, 196, 255, 0.4)' : 'none'
                }}>
                  3
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 3 ? 600 : 400,
                  color: currentStep === 3 ? '#ffffff' : '#64748b'
                }}>
                  Review
                </span>
              </div>
            </div>

            {/* 2-Column Grid Area */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 340px',
              gap: '24px',
              alignItems: 'start'
            }}>
              {/* Left Column - Main Step Card */}
              <div style={{
                backgroundColor: '#111723',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '28px 32px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
              }}>
                {/* STEP 1: Subscriber Identity Details */}
                {currentStep === 1 && (
                  <form onSubmit={handleProceedToVerification}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #1d283a',
                      marginBottom: '28px'
                    }}>
                      <User size={18} color="#a5c4ff" />
                      <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                        Identity Details
                      </h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      {/* Full Legal Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          Full Legal Name
                        </label>
                        <input 
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Doe"
                          style={{
                            width: '100%',
                            height: '42px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0 14px',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </div>

                      {/* Institutional ID / National ID */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          Institutional ID / National ID
                        </label>
                        <input 
                          type="text"
                          value={institutionalId}
                          onChange={(e) => setInstitutionalId(e.target.value)}
                          placeholder="SU-8924-X"
                          style={{
                            width: '100%',
                            height: '42px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0 14px',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          Date of Birth
                        </label>
                        <input 
                          type="text"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          placeholder="08/15/1995"
                          style={{
                            width: '100%',
                            height: '42px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0 14px',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </div>

                      {/* Department / Faculty */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          Department / Faculty
                        </label>
                        <div style={{ position: 'relative' }}>
                          <select 
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            style={{
                              width: '100%',
                              height: '42px',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '0 36px 0 14px',
                              fontSize: '14px',
                              outline: 'none',
                              appearance: 'none',
                              cursor: 'pointer',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="Network Operations">Network Operations</option>
                            <option value="Computer Science">Computer Science & IT</option>
                            <option value="Engineering & Telecoms">Engineering & Telecoms</option>
                            <option value="Administration">Administration & Staff</option>
                            <option value="Research & Postgraduate">Research & Postgraduate</option>
                          </select>
                          <ChevronDown size={16} color="#64748b" style={{ position: 'absolute', right: '12px', top: '13px', pointerEvents: 'none' }} />
                        </div>
                      </div>
                    </div>

                    {/* Contact Phone */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                        Contact Phone
                      </label>
                      <input 
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+254 712 345 678"
                        style={{
                          width: '50%',
                          minWidth: '240px',
                          height: '42px',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '0 14px',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        required
                      />
                    </div>
                  </form>
                )}

                {/* STEP 2: Verification */}
                {currentStep === 2 && (
                  <form onSubmit={handleVerifyCode}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #1d283a',
                      marginBottom: '28px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={18} color="#a5c4ff" />
                        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                          Institutional Verification
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    </div>

                    <div style={{ background: '#161f30', border: '1px solid #222e44', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
                      <div style={{ fontSize: '13.5px', color: '#e2e8f0', marginBottom: '4px' }}>
                        Security OTP sent to <strong>{contactPhone}</strong>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        Enter the 6-digit authentication pin issued to your institutional phone number.
                      </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                        Verification Code (OTP)
                      </label>
                      <input 
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="892401"
                        maxLength={6}
                        style={{
                          width: '100%',
                          maxWidth: '240px',
                          height: '46px',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          padding: '0 16px',
                          fontSize: '18px',
                          letterSpacing: '4px',
                          fontWeight: 600,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      {verificationError && (
                        <p style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px' }}>{verificationError}</p>
                      )}
                      <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>
                        Didn't receive code? <button type="button" onClick={() => setVerificationCode('892401')} style={{ color: '#a5c4ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Use demo code 892401</button>
                      </p>
                    </div>
                  </form>
                )}

                {/* STEP 3: Review */}
                {currentStep === 3 && (
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '16px',
                      borderBottom: '1px solid #1d283a',
                      marginBottom: '24px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle2 size={18} color="#10b981" />
                        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                          Review & Submit Provisioning Request
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ background: '#161f30', padding: '14px 18px', borderRadius: '8px', border: '1px solid #222e44' }}>
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>Full Name</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{fullName}</div>
                      </div>
                      <div style={{ background: '#161f30', padding: '14px 18px', borderRadius: '8px', border: '1px solid #222e44' }}>
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>Institutional ID</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{institutionalId}</div>
                      </div>
                      <div style={{ background: '#161f30', padding: '14px 18px', borderRadius: '8px', border: '1px solid #222e44' }}>
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>Department</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{department}</div>
                      </div>
                      <div style={{ background: '#161f30', padding: '14px 18px', borderRadius: '8px', border: '1px solid #222e44' }}>
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>Contact Phone</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{contactPhone}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Policy / Action Box */}
              <div style={{
                backgroundColor: '#111723',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px'
              }}>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#8c9cb0',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '16px'
                  }}>
                    <Info size={15} color="#8c9cb0" />
                    <span>REGISTRATION POLICY</span>
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#8c9cb0',
                    lineHeight: 1.55,
                    margin: 0
                  }}>
                    All SIM registrations must comply with Institutional Network Policy v2.4. Data is encrypted and stored in the central secure vault.
                  </p>
                </div>

                <div>
                  <div style={{ height: '1px', backgroundColor: '#1d283a', margin: '24px 0' }} />

                  {currentStep === 1 && (
                    <button
                      type="button"
                      onClick={handleProceedToVerification}
                      style={{
                        width: '100%',
                        height: '44px',
                        backgroundColor: '#a5c4ff',
                        color: '#0c101d',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(165, 196, 255, 0.25)'
                      }}
                    >
                      <span>Proceed to Verification</span>
                      <ArrowRight size={16} />
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={isVerifying}
                      style={{
                        width: '100%',
                        height: '44px',
                        backgroundColor: '#a5c4ff',
                        color: '#0c101d',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        opacity: isVerifying ? 0.7 : 1
                      }}
                    >
                      {isVerifying ? (
                        <span>Validating OTP...</span>
                      ) : (
                        <>
                          <span>Proceed to Review</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  )}

                  {currentStep === 3 && (
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={isVerifying}
                      style={{
                        width: '100%',
                        height: '44px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {isVerifying ? (
                        <span>Provisioning Network SIM...</span>
                      ) : (
                        <>
                          <span>Complete Registration</span>
                          <CheckCircle2 size={16} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Success Screen: Active SIM Card Profile */
          <div style={{
            backgroundColor: '#111723',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '36px',
            maxWidth: '680px',
            margin: '0 auto',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
              SIM Provisioned Successfully!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 28px 0' }}>
              Your institutional eSIM/Network Identifier has been activated and linked to <strong>{fullName}</strong>.
            </p>

            {/* SIM Card Details Badge */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '28px',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={24} color="#a5c4ff" />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>PRO-SIM Network Card</span>
                </div>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}>
                  ● ACTIVE NETWORK
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>ICCID Number</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontFamily: 'monospace' }}>8925400192837465192F</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Assigned MSISDN</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{contactPhone}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Subscriber Faculty</span>
                  <span style={{ color: '#e2e8f0' }}>{department}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Institutional ID</span>
                  <span style={{ color: '#e2e8f0' }}>{institutionalId}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={copyIccid}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copied ? 'Copied ICCID' : 'Copy ICCID'}</span>
              </button>

              <button
                onClick={() => setIsCompleted(false)}
                style={{
                  backgroundColor: '#a5c4ff',
                  color: '#0c101d',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Register Another SIM
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
