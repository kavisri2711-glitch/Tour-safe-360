import React, { useState } from 'react';
import { signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  auth,
  ensureTouristProfileAndUniqueId,
  FIREBASE_PROJECT_ID,
  googleProvider,
  registerTouristWithEmail,
  RegistrationPayload,
  sendTouristPasswordReset,
  signInTouristWithEmail,
} from '../firebase';

interface AuthPortalModalProps {
  isOpen: boolean;
  initialTab?: 'signin' | 'register' | 'reset';
  onClose: () => void;
  onSuccess?: (user: FirebaseUser) => void;
}

export const AuthPortalModal: React.FC<AuthPortalModalProps> = ({
  isOpen,
  initialTab = 'register',
  onClose,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'signin' | 'register' | 'reset'>(initialTab);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerDisabledNotice, setProviderDisabledNotice] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration fields (Module 2)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [stateRegion, setStateRegion] = useState('Kerala');
  const [country, setCountry] = useState('India');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [personalInfoConsent, setPersonalInfoConsent] = useState(true);
  const [trackingConsent, setTrackingConsent] = useState(true);

  if (!isOpen) return null;

  const buildPayload = (): RegistrationPayload => ({
    fullName: fullName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    dob: dob.trim(),
    nationality: nationality.trim() || 'Indian',
    stateRegion: stateRegion.trim() || 'Kerala',
    country: country.trim() || 'India',
    emergencyContactName: emergencyContactName.trim(),
    emergencyContactPhone: emergencyContactPhone.trim(),
    emergencyContactEmail: emergencyContactEmail.trim(),
    photoUrl: photoUrl.trim(),
    personalInfoConsent,
    trackingConsent,
  });

  const validateRegistration = (): string | null => {
    if (fullName.trim().length < 2) return 'Please enter your full name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (phone.trim().length < 7) return 'Please enter a valid mobile phone number.';
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    if (!dob) return 'Please provide your date of birth.';
    if (!nationality.trim()) return 'Please specify your nationality.';
    if (!country.trim()) return 'Please specify your country.';
    if (emergencyContactName.trim().length < 2) return 'Please provide an emergency contact name.';
    if (emergencyContactPhone.trim().length < 7) return 'Please provide a valid emergency contact phone number.';
    if (!personalInfoConsent) {
      return 'Explicit consent for storing registration and safety profile details is required.';
    }
    return null;
  };

  const handleGoogleAuth = async (attachRegistrationForm = false) => {
    setBusy(true);
    setErrorMsg(null);
    setProviderDisabledNotice(false);
    setSuccessMsg(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const regPayload = attachRegistrationForm && fullName.trim() ? buildPayload() : undefined;
      await ensureTouristProfileAndUniqueId(cred.user, regPayload);
      if (onSuccess) onSuccess(cred.user);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication was cancelled or failed.';
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateRegistration();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setProviderDisabledNotice(false);
    setSuccessMsg(null);

    try {
      const user = await registerTouristWithEmail(password, buildPayload());
      if (onSuccess) onSuccess(user);
      onClose();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setProviderDisabledNotice(true);
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in your Firebase project console. Enable it in Firebase Authentication > Sign-in method, or click "Continue with Google & Save Form Details" below.'
        );
      } else if (raw.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Switch to Sign In to access your Tourist ID.');
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Enter both email address and password.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setProviderDisabledNotice(false);
    setSuccessMsg(null);

    try {
      const user = await signInTouristWithEmail(loginEmail, loginPassword);
      if (onSuccess) onSuccess(user);
      onClose();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setProviderDisabledNotice(true);
        setErrorMsg(
          'Email/Password sign-in is currently disabled in your Firebase Console. Enable Email/Password in Firebase Authentication or sign in with Google.'
        );
      } else if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        setErrorMsg('Invalid email or password. Please verify your credentials or reset your password.');
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMsg('Enter your registered email address to receive a password reset link.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendTouristPasswordReset(loginEmail);
      setSuccessMsg(`Password reset instructions sent to ${loginEmail.trim()}. Check your inbox.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send password reset email.');
    } finally {
      setBusy(false);
    }
  };

  const consoleAuthUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full my-8 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-950 text-white px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-300 font-medium">
              TourSafe 360 · Kerala Smart Tourism Safety Portal
            </p>
            <h2 className="text-lg font-bold mt-0.5">
              {tab === 'register'
                ? 'Tourist Registration & Unique Kerala ID Issuance'
                : tab === 'signin'
                ? 'Sign In to Retrieve Your Kerala Tourist ID'
                : 'Reset Account Password'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Segmented Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'register' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New Tourist Registration
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'signin' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Existing Tourist Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('reset');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tab === 'reset' ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Password Reset
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => handleGoogleAuth(false)}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Instant Sign In with Google
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2 text-xs text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {providerDisabledNotice && (
                <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-red-200/80">
                  <a
                    href={consoleAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-red-900 underline"
                  >
                    Open Firebase Auth Providers Console
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleGoogleAuth(true)}
                    className="px-3 py-1.5 bg-emerald-800 text-white font-semibold rounded-lg hover:bg-emerald-900 whitespace-nowrap"
                  >
                    Continue with Google & Save Form Details
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: FULL KERALA TOURIST REGISTRATION */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Supports domestic Indian travelers and international visitors. Upon registration, TourSafe 360 atomically issues your permanent Tourist ID (<span className="font-mono-tabular font-medium text-slate-800">TS360-KL-2026-XXXXXX</span>).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="e.g., Arjun Menon / Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    placeholder="traveler@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="+91 98470 12345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 6 chars) *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nationality *</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Indian / British / German / etc."
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Home State / Province *</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="e.g., Kerala / Tamil Nadu / Bavaria"
                    value={stateRegion}
                    onChange={(e) => setStateRegion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="India"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Trusted family member or friend"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="+91 94470 00000"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact Google Email (Optional for Live Map)
                  </label>
                  <input
                    type="email"
                    maxLength={160}
                    placeholder="contact@gmail.com"
                    value={emergencyContactEmail}
                    onChange={(e) => setEmergencyContactEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Profile Photograph URL (Optional)
                  </label>
                  <input
                    type="url"
                    maxLength={2048}
                    placeholder="https://example.com/photo.jpg"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={personalInfoConsent}
                    onChange={(e) => setPersonalInfoConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Explicit Personal Data Consent *:</strong> I consent to storing my tourist profile in an isolated owner-only Firestore record and generating a non-government Digital Tourist ID.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackingConsent}
                    onChange={(e) => setTrackingConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Explicit GPS Tracking Consent:</strong> Allow GPS coordinate logging and geofence safety checks when I enable tracking (revocable anytime in Profile).
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Register & Generate Tourist ID
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: EMAIL & PASSWORD SIGN IN */}
          {tab === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <p className="text-xs text-slate-600">
                Sign in with your registered email and password, or use Google Sign-In above. Your permanent Kerala Tourist ID is automatically retrieved—never regenerated.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="traveler@example.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setTab('reset')}
                  className="text-xs font-medium text-emerald-800 hover:underline"
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PASSWORD RESET */}
          {tab === 'reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-xs text-slate-600">
                Enter your registered email address to receive a Firebase password reset link.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registered Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="traveler@example.com"
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Send Password Reset Email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
