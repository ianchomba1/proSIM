import React, { useEffect, useState } from 'react';
import {
  Menu,
  Bell,
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
  XCircle
} from 'lucide-react';
import { submitApplicationApi, verifyNationalIdApi } from '../services/api';
import type { IdVerificationResult } from '../services/api';

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
  const [nationalIdNumber, setNationalIdNumber] = useState('');

  // Verification Step State (OCR of Kenyan National ID)
  const [idImage, setIdImage] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ key: string; result: IdVerificationResult } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // A verification only counts for the exact details it was run against;
  // editing name, ID number or DOB afterwards invalidates it.
  const identityKey = `${fullName}|${nationalIdNumber}|${dob}`;
  const idResult = verification?.key === identityKey ? verification.result : null;
  const verificationToken = idResult?.verified ? idResult.verificationToken ?? null : null;
  const setIdResult = (result: IdVerificationResult | null) =>
    setVerification(result ? { key: identityKey, result } : null);

  // Free the preview URL when the image changes / component unmounts.
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
      setStep1Error('Full name, National ID number and date of birth are required for ID verification.');
      return;
    }
    if (!/^\d{7,9}$/.test(nationalIdNumber.replace(/\s/g, ''))) {
      setStep1Error('National ID number should be 7–9 digits, exactly as printed on your ID.');
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

  // Step 2 button: verify the ID via OCR, or continue once verified.
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
      setIdResult(res);  // verificationToken is derived from this result
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
        setSubmissionError(res.message || 'Submission failed. Please check database connection.');
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

                      {/* Kenyan National ID Number (verified by OCR in step 2) */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          National ID Number
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={nationalIdNumber}
                          onChange={(e) => setNationalIdNumber(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="e.g. 12345678"
                          maxLength={9}
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

                      {/* Institutional / Staff ID */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13.5px', color: '#f1f5f9', marginBottom: '8px', fontWeight: 500 }}>
                          Institutional / Staff ID
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
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
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
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Enter your department (e.g. Network Operations)"
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
                          width: 'calc(50% - 10px)',
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
                    {step1Error && (
                      <p style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '10px' }}>{step1Error}</p>
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
                      paddingBottom: '16px',
                      borderBottom: '1px solid #1d283a',
                      marginBottom: '28px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={18} color="#a5c4ff" />
                        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                          National ID Verification
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
                        Upload a photo of the front of your Kenyan National ID
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        We read the card and confirm it matches the name, ID number and date of birth you entered.
                        Place the card flat in good light with all four edges visible. The photo is not stored.
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label
                        htmlFor="national-id-upload"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: '10px', minHeight: idPreview ? 'auto' : '150px', padding: '16px',
                          border: '1.5px dashed #33445f', borderRadius: '8px', cursor: 'pointer',
                          backgroundColor: '#0f1623', color: '#94a3b8', fontSize: '13px', textAlign: 'center'
                        }}
                      >
                        {idPreview ? (
                          <>
                            <img src={idPreview} alt="Uploaded National ID" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '6px' }} />
                            <span style={{ color: '#a5c4ff' }}>Choose a different photo</span>
                          </>
                        ) : (
                          <>
                            <Upload size={26} color="#a5c4ff" />
                            <span><strong style={{ color: '#e2e8f0' }}>Click to upload</strong> a JPG, PNG or WEBP (max 8 MB)</span>
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
                      <div style={{ background: '#161f30', border: '1px solid #222e44', borderRadius: '8px', padding: '14px 18px', marginBottom: '16px' }}>
                        {([
                          ['Full Name', idResult.checks.fullName],
                          ['National ID Number', idResult.checks.idNumber],
                          ['Date of Birth', idResult.checks.dateOfBirth],
                        ] as const).map(([label, check]) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0' }}>
                            {check.match
                              ? <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
                              : <XCircle size={17} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }} />}
                            <div>
                              <div style={{ fontSize: '13.5px', color: '#ffffff', fontWeight: 600 }}>
                                {label}: <span style={{ fontWeight: 400, color: check.match ? '#a7f3d0' : '#fca5a5' }}>
                                  {check.match ? 'Matches ID' : 'Does not match'}
                                </span>
                              </div>
                              {!check.match && (
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                  You entered <strong>{check.expected || '—'}</strong>
                                  {check.found ? <>; ID shows <strong>{check.found}</strong></> : '; could not read this on the ID'}
                                  {check.note ? ` (${check.note})` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {idResult.warnings?.map((w) => (
                          <p key={w} style={{ color: '#fbbf24', fontSize: '12px', margin: '6px 0 0' }}>{w}</p>
                        ))}
                      </div>
                    )}

                    {verificationToken && (
                      <p style={{ color: '#10b981', fontSize: '13px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={15} /> National ID verified. Continue to review.
                      </p>
                    )}
                    {verificationError && (
                      <p style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px' }}>{verificationError}</p>
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
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>National ID Number</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {nationalIdNumber}
                          {verificationToken && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>✓ OCR verified</span>}
                        </div>
                      </div>
                      <div style={{ background: '#161f30', padding: '14px 18px', borderRadius: '8px', border: '1px solid #222e44' }}>
                        <div style={{ fontSize: '12px', color: '#8c9cb0' }}>Date of Birth</div>
                        <div style={{ fontSize: '14.5px', color: '#ffffff', fontWeight: 600, marginTop: '2px' }}>{dob}</div>
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
                        <span>Reading your ID...</span>
                      ) : verificationToken ? (
                        <>
                          <span>Proceed to Review</span>
                          <ArrowRight size={16} />
                        </>
                      ) : (
                        <>
                          <span>{idResult ? 'Verify Again' : 'Verify National ID'}</span>
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
                        backgroundColor: 'transparent',
                        color: '#cbd5e1',
                        border: '1px solid #33445f',
                        borderRadius: '6px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: isVerifying ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        opacity: isVerifying ? 0.5 : 1
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
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
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
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        opacity: isVerifying ? 0.7 : 1
                      }}
                    >
                      {isVerifying ? (
                        <span>Saving Application to Database...</span>
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
