import React, { useEffect, useState } from 'react';
import {
  User,
  Info,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Smartphone,
  Copy,
  Check,
  AlertCircle,
  Upload,
  XCircle,
  Sun,
  Moon
} from 'lucide-react';
import { submitApplicationApi, verifyNationalIdApi } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { IdVerificationResult } from '../services/api';

interface SimRegistrationPortalProps {
  userName?: string;
  userEmail?: string;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const SimRegistrationPortal: React.FC<SimRegistrationPortalProps> = ({
  userName = 'Jane Doe',
  userEmail = 'j.doe@telecom.org',
  onSignOut,
  theme = 'light',
  onToggleTheme
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const isMobile = useIsMobile();

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
    return 'SU';
  };
  const initials = getInitials(userName, userEmail);

  // Form State for Subscriber Details
  const [fullName, setFullName] = useState(userName !== 'Administrative User' ? userName : 'Jane Doe');
  const [institutionalId, setInstitutionalId] = useState('EP-8924-X');
  const [dob, setDob] = useState('1995-08-15');
  const [department, setDepartment] = useState('Network Operations');
  const [contactPhone, setContactPhone] = useState('+254 712 345 678');
  const [nationalIdNumber, setNationalIdNumber] = useState('');

  // Verification Step State (OCR of Kenyan National ID)
  const [idImage, setIdImage] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ key: string; result: IdVerificationResult } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const identityKey = `${fullName}|${nationalIdNumber}|${dob}`;
  const idResult = verification?.key === identityKey ? verification.result : null;
  const verificationToken = idResult?.verified ? idResult.verificationToken ?? null : null;
  const setIdResult = (result: IdVerificationResult | null) =>
    setVerification(result ? { key: identityKey, result } : null);

  useEffect(() => {
    return () => { if (idPreview) URL.revokeObjectURL(idPreview); };
  }, [idPreview]);

  // Toast / Copy notification state
  const [copied, setCopied] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Handle Step Navigation
  const [step1Error, setStep1Error] = useState('');
  const handleProceedToVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !nationalIdNumber.trim() || !dob.trim()) {
      setStep1Error('Full legal name, National ID number and date of birth are required for ID verification.');
      return;
    }
    if (!/^\d{7,9}$/.test(nationalIdNumber.replace(/\s/g, ''))) {
      setStep1Error('National ID number should be 7–9 digits, exactly as printed on your ID card.');
      return;
    }
    setStep1Error('');
    setCurrentStep(2);
  };

  const handleIdImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setIdResult(null);
    setVerificationError('');
    if (!file) { setIdImage(null); setIdPreview(null); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setVerificationError('Please upload a JPG, PNG or WEBP photo of your National ID.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setVerificationError('Image is larger than 8 MB.');
      return;
    }
    setIdImage(file);
    setIdPreview(URL.createObjectURL(file));
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationToken) { setCurrentStep(3); return; }
    if (!idImage) {
      setVerificationError('Please upload a photo of your National ID.');
      return;
    }
    setVerificationError('');
    setIsVerifying(true);
    try {
      const res = await verifyNationalIdApi(idImage, fullName, nationalIdNumber, dob);
      setIdResult(res);
      if (!res.verified) {
        setVerificationError(res.message
          ?? 'Some details do not match your National ID. Correct them in step 1 or upload a clearer photo.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinalSubmit = async () => {
    setIsVerifying(true);
    setSubmissionError('');
    try {
      const res = await submitApplicationApi({
        fullName,
        institutionalId,
        dateOfBirth: dob,
        department,
        contactPhone,
        userEmail,
        iccid: '8925400192837465192F',
        nationalIdNumber,
        verificationToken: verificationToken ?? '',
      });
      if (res.success) {
        setIsCompleted(true);
      } else {
        setSubmissionError(res.message || 'Submission failed. Please check network connection.');
      }
    } catch (err) {
      console.error(err);
      setSubmissionError('Could not connect to the backend server.');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyIccid = () => {
    navigator.clipboard.writeText('8925400192837465192F');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--input-border)',
    borderRadius: '8px',
    padding: '0 14px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Inter', sans-serif",
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    color: 'var(--text-primary)',
    marginBottom: '8px',
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-dark)',
      backgroundImage: 'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
      backgroundSize: '54px 54px',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      {/* Top Header Navbar */}
      <header style={{
        height: '66px',
        backgroundColor: 'var(--nav-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--card-border)',
        padding: isMobile ? '0 14px' : '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'all 0.3s ease'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            ProSIM
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-green)',
              boxShadow: '0 0 10px var(--accent-glow)'
            }} />
          </div>
          {!isMobile && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent-green)',
              background: 'var(--accent-green-dim)',
              border: '1px solid var(--card-border)',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              Subscriber Portal
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--accent-green-dim)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '9999px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {!isMobile && <span>{theme === 'light' ? 'Dark' : 'Light'}</span>}
            </button>
          )}

          <div style={{
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            padding: '4px 14px 4px 5px',
            borderRadius: '9999px',
            background: 'var(--card-bg-elevated)',
            border: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-green-dim) 0%, rgba(37, 99, 235, 0.22) 100%)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10.5px',
              fontWeight: 800,
              color: 'var(--accent-green)'
            }}>
              {initials}
            </div>
            {!isMobile && <span>{userName}</span>}
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-green)' }} />
          </div>

          <button
            onClick={onSignOut}
            title="Sign Out"
            style={{
              background: 'var(--danger-dim)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--danger)',
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <LogOut size={14} />
            {!isMobile && <span>Sign Out</span>}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        maxWidth: '1080px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '22px 16px 48px' : '36px 24px 60px',
        boxSizing: 'border-box'
      }}>
        {/* Page Title & Subtitle */}
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
            letterSpacing: '-0.025em',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            SIM Registration
          </h1>
          <p style={{
            fontSize: '14.5px',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.5
          }}>
            Complete verified telecom registration to provision an enterprise network identifier.
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
              margin: isMobile ? '0 auto 28px' : '0 auto 44px',
              // Step labels are wider than their circles; keep them inside the screen on phones
              padding: isMobile ? '0 26px' : 0
            }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: currentStep === 1 ? 'var(--btn-primary-bg)' : currentStep > 1 ? 'var(--accent-green-dim)' : 'var(--card-bg-elevated)',
                  border: currentStep > 1 ? '1px solid var(--accent-green)' : currentStep === 1 ? 'none' : '1px solid var(--card-border)',
                  color: currentStep === 1 ? 'var(--btn-primary-text)' : currentStep > 1 ? 'var(--accent-green)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 1 ? '0 0 16px var(--accent-glow)' : 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {currentStep > 1 ? <Check size={16} /> : '1'}
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 1 ? 700 : 500,
                  color: currentStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Subscriber
                </span>
              </div>

              {/* Connecting Line 1 */}
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: currentStep >= 2 ? 'var(--accent-green)' : 'var(--card-border)',
                margin: '0 12px 24px',
                transition: 'all 0.3s ease'
              }} />

              {/* Step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: currentStep === 2 ? 'var(--btn-primary-bg)' : currentStep > 2 ? 'var(--accent-green-dim)' : 'var(--card-bg-elevated)',
                  border: currentStep > 2 ? '1px solid var(--accent-green)' : currentStep === 2 ? 'none' : '1px solid var(--card-border)',
                  color: currentStep === 2 ? 'var(--btn-primary-text)' : currentStep > 2 ? 'var(--accent-green)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 2 ? '0 0 16px var(--accent-glow)' : 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {currentStep > 2 ? <Check size={16} /> : '2'}
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 2 ? 700 : 500,
                  color: currentStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Verification
                </span>
              </div>

              {/* Connecting Line 2 */}
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: currentStep >= 3 ? 'var(--accent-green)' : 'var(--card-border)',
                margin: '0 12px 24px',
                transition: 'all 0.3s ease'
              }} />

              {/* Step 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: currentStep === 3 ? 'var(--btn-primary-bg)' : 'var(--card-bg-elevated)',
                  border: currentStep === 3 ? 'none' : '1px solid var(--card-border)',
                  color: currentStep === 3 ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: currentStep === 3 ? '0 0 16px var(--accent-glow)' : 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  3
                </div>
                <span style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  fontWeight: currentStep === 3 ? 700 : 500,
                  color: currentStep === 3 ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Review
                </span>
              </div>
            </div>

            {/* 2-Column Grid Area */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 340px',
              gap: '24px',
              alignItems: 'start'
            }}>
              {/* Left Column - Main Step Card */}
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '16px',
                padding: isMobile ? '22px 16px' : '30px 34px',
                boxShadow: 'var(--card-shadow)',
                transition: 'all 0.3s ease'
              }}>
                {/* STEP 1: Subscriber Identity Details */}
                {currentStep === 1 && (
                  <form onSubmit={handleProceedToVerification}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--card-border)',
                      marginBottom: '28px'
                    }}>
                      <User size={18} color="var(--accent-green)" />
                      <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Identity Details
                      </h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      {/* Full Legal Name */}
                      <div>
                        <label style={labelStyle}>
                          Full Legal Name
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Doe"
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Kenyan National ID Number (verified by OCR in step 2) */}
                      <div>
                        <label style={labelStyle}>
                          National ID Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={nationalIdNumber}
                          onChange={(e) => setNationalIdNumber(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="e.g. 12345678"
                          maxLength={9}
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Enterprise / Staff ID */}
                      <div>
                        <label style={labelStyle}>
                          Enterprise Staff ID
                        </label>
                        <input
                          type="text"
                          value={institutionalId}
                          onChange={(e) => setInstitutionalId(e.target.value)}
                          placeholder="EP-8924-X"
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Date of Birth */}
                      <div>
                        <label style={labelStyle}>
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Department / Division */}
                      <div>
                        <label style={labelStyle}>
                          Department / Operational Unit
                        </label>
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Network Operations"
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label style={labelStyle}>
                          Contact MSISDN
                        </label>
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+254 712 345 678"
                          style={inputStyle}
                          required
                        />
                      </div>
                    </div>

                    {step1Error && (
                      <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '10px' }}>{step1Error}</p>
                    )}
                  </form>
                )}

                {/* STEP 2: Verification */}
                {currentStep === 2 && (
                  <form onSubmit={handleVerifyCode}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--card-border)',
                      marginBottom: '28px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={18} color="var(--accent-green)" />
                        <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          National ID Document Verification
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    </div>

                    <div style={{ background: 'var(--card-bg-elevated)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px' }}>
                      <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                        Upload a photo of the front of your Kenyan National ID
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Optical neural parsing matches the photo against the legal name, ID serial, and birth date entered. The image is processed in sovereign memory and never persisted.
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label
                        htmlFor="national-id-upload"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: '10px', minHeight: idPreview ? 'auto' : '150px', padding: '20px',
                          border: '1.5px dashed var(--input-border)', borderRadius: '12px', cursor: 'pointer',
                          backgroundColor: 'var(--input-bg)', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {idPreview ? (
                          <>
                            <img src={idPreview} alt="Uploaded National ID" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', border: '1px solid var(--card-border)' }} />
                            <span style={{ color: 'var(--accent-green)', fontWeight: 600, marginTop: '8px' }}>Choose a different photo</span>
                          </>
                        ) : (
                          <>
                            <Upload size={28} color="var(--accent-green)" />
                            <span><strong style={{ color: 'var(--text-primary)' }}>Click to upload</strong> a JPG, PNG or WEBP (max 8 MB)</span>
                          </>
                        )}
                      </label>
                      <input
                        id="national-id-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={handleIdImageChange}
                        style={{ display: 'none' }}
                      />
                    </div>

                    {idResult?.checks && (
                      <div style={{ background: 'var(--card-bg-elevated)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
                        {([
                          ['Full Legal Name', idResult.checks.fullName],
                          ['National ID Number', idResult.checks.idNumber],
                          ['Date of Birth', idResult.checks.dateOfBirth],
                        ] as const).map(([label, check]) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}>
                            {check.match
                              ? <CheckCircle2 size={17} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                              : <XCircle size={17} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                            <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                              <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                {label}: <span style={{ fontWeight: 500, color: check.match ? 'var(--accent-green)' : 'var(--danger)' }}>
                                  {check.match ? 'Verified Match' : 'Mismatch'}
                                </span>
                              </div>
                              {!check.match && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Entered: <strong>{check.expected || '—'}</strong>
                                  {check.found ? <>; OCR Detected: <strong>{check.found}</strong></> : '; unreadable on card'}
                                  {check.note ? ` (${check.note})` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {idResult.warnings?.map((w) => (
                          <p key={w} style={{ color: 'var(--warning)', fontSize: '12px', margin: '8px 0 0' }}>{w}</p>
                        ))}
                      </div>
                    )}

                    {verificationToken && (
                      <p style={{ color: 'var(--accent-green)', fontSize: '13.5px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <ShieldCheck size={16} /> National ID verified successfully. Continue to review.
                      </p>
                    )}
                    {verificationError && (
                      <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '6px' }}>{verificationError}</p>
                    )}
                  </form>
                )}

                {/* STEP 3: Review */}
                {currentStep === 3 && (
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--card-border)',
                      marginBottom: '24px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle2 size={18} color="var(--accent-green)" />
                        <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          Review & Submit Provisioning Request
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Full Legal Name</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>{fullName}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Enterprise Staff ID</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>{institutionalId}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>National ID Number</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {nationalIdNumber}
                          {verificationToken && <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600 }}>✓ OCR verified</span>}
                        </div>
                      </div>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>{dob}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Department</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>{department}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg-elevated)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Contact MSISDN</div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px' }}>{contactPhone}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Policy / Action Box */}
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '16px',
                padding: isMobile ? '20px 16px' : '26px',
                boxShadow: 'var(--card-shadow)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: isMobile ? 0 : '260px',
                transition: 'all 0.3s ease'
              }}>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '16px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    <Info size={15} color="var(--accent-green)" />
                    <span>REGISTRATION POLICY</span>
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    All subscriber SIM registrations must comply with Enterprise Telecom Policy v2.4. Encrypted payloads are verified via hardware root of trust.
                  </p>
                </div>

                <div>
                  <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '24px 0' }} />

                  {currentStep === 1 && (
                    <button
                      type="button"
                      onClick={handleProceedToVerification}
                      style={{
                        width: '100%',
                        height: '44px',
                        backgroundColor: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        border: 'none',
                        borderRadius: '9999px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 14px var(--accent-glow)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
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
                        backgroundColor: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        border: 'none',
                        borderRadius: '9999px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 14px var(--accent-glow)',
                        opacity: isVerifying ? 0.7 : 1,
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
                      }}
                    >
                      {isVerifying ? (
                        <span>Analyzing ID Document...</span>
                      ) : verificationToken ? (
                        <>
                          <span>Proceed to Review</span>
                          <ArrowRight size={16} />
                        </>
                      ) : (
                        <>
                          <span>{idResult ? 'Re-verify National ID' : 'Verify National ID'}</span>
                          <ShieldCheck size={16} />
                        </>
                      )}
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      type="button"
                      onClick={() => { setVerificationError(''); setCurrentStep(1); }}
                      disabled={isVerifying}
                      style={{
                        width: '100%',
                        height: '42px',
                        marginTop: '10px',
                        backgroundColor: 'var(--accent-green-dim)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '9999px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: isVerifying ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        opacity: isVerifying ? 0.5 : 1,
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
                      }}
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Edit Details</span>
                    </button>
                  )}

                  {submissionError && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--danger-dim)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--danger)',
                      fontSize: '13px',
                      marginBottom: '12px'
                    }}>
                      <AlertCircle size={15} />
                      <span>{submissionError}</span>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={isVerifying}
                      style={{
                        width: '100%',
                        height: '44px',
                        backgroundColor: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        border: 'none',
                        borderRadius: '9999px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 14px var(--accent-glow)',
                        opacity: isVerifying ? 0.7 : 1,
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
                      }}
                    >
                      {isVerifying ? (
                        <span>Committing Record to Registry...</span>
                      ) : (
                        <>
                          <span>Complete SIM Provisioning</span>
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
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '20px',
            padding: isMobile ? '28px 18px' : '40px 36px',
            maxWidth: '680px',
            margin: '0 auto',
            textAlign: 'center',
            boxShadow: 'var(--card-shadow)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-green-dim)',
              color: 'var(--accent-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              border: '1px solid var(--card-border)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SIM Provisioned Successfully!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 28px 0' }}>
              Your enterprise eSIM/Network Identifier has been activated and linked to <strong>{fullName}</strong>.
            </p>

            {/* SIM Card Details Badge */}
            <div style={{
              background: 'linear-gradient(135deg, var(--card-bg-elevated) 0%, var(--card-bg) 100%)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              padding: isMobile ? '18px 16px' : '24px',
              textAlign: 'left',
              marginBottom: '28px',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={24} color="var(--accent-green)" />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    PRO-SIM Network Card
                  </span>
                </div>
                <span style={{
                  backgroundColor: 'var(--accent-green-dim)',
                  color: 'var(--accent-green)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid var(--card-border)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  ● ACTIVE NETWORK
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11.5px', fontWeight: 600 }}>ICCID NUMBER</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px' }}>8925400192837465192F</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11.5px', fontWeight: 600 }}>ASSIGNED MSISDN</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{contactPhone}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11.5px', fontWeight: 600 }}>DEPARTMENT</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{department}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11.5px', fontWeight: 600 }}>ENTERPRISE ID</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{institutionalId}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={copyIccid}
                style={{
                  backgroundColor: 'var(--accent-green-dim)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '9999px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
                <span>{copied ? 'Copied ICCID' : 'Copy ICCID'}</span>
              </button>

              <button
                onClick={() => setIsCompleted(false)}
                style={{
                  backgroundColor: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--accent-glow)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
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
