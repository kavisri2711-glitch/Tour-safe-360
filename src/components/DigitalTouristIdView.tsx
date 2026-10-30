import React, { useEffect, useState } from 'react';
import { sendEmailVerification, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  IdCard,
  Loader2,
  MailCheck,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { db } from '../firebase';
import { AppLanguage, TouristVerificationRecord, UserPublicProfile } from '../types';
import { formatIstDate, formatIstDateTime, UI_STRINGS } from '../utils/i18n';

interface DigitalTouristIdViewProps {
  fbUser: FirebaseUser | null;
  publicProfile: UserPublicProfile;
  language: AppLanguage;
  onOpenAuthModal: () => void;
  initialVerifyToken?: string | null;
}

export const DigitalTouristIdView: React.FC<DigitalTouristIdViewProps> = ({
  fbUser,
  publicProfile,
  language,
  onOpenAuthModal,
  initialVerifyToken,
}) => {
  const t = UI_STRINGS[language];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [verifyingEmailBusy, setVerifyingEmailBusy] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  // Public QR Verification Inspector
  const [lookupInput, setLookupInput] = useState(initialVerifyToken || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<TouristVerificationRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const hasIssuedId = Boolean(fbUser && publicProfile.touristId && publicProfile.verificationToken);

  const verificationUrl =
    typeof window !== 'undefined' && publicProfile.verificationToken
      ? `${window.location.origin}/?verify=${encodeURIComponent(publicProfile.verificationToken)}`
      : '';

  useEffect(() => {
    let active = true;
    async function generateQr() {
      const targetPayload =
        verificationUrl ||
        'https://toursafe360.kerala.example/?verify=DEMO_PREVIEW_REGISTER_FOR_UNIQUE_ID';
      try {
        const url = await QRCode.toDataURL(targetPayload, {
          width: 240,
          margin: 1,
          color: {
            dark: '#064e3b',
            light: '#ffffff',
          },
        });
        if (active) setQrDataUrl(url);
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    }
    generateQr();
    return () => {
      active = false;
    };
  }, [verificationUrl]);

  useEffect(() => {
    if (initialVerifyToken) {
      setLookupInput(initialVerifyToken);
      runTokenVerification(initialVerifyToken);
    }
  }, [initialVerifyToken]);

  const extractToken = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    try {
      if (trimmed.includes('verify=')) {
        const u = new URL(trimmed.startsWith('http') ? trimmed : `https://x.local/${trimmed}`);
        return u.searchParams.get('verify') || trimmed;
      }
    } catch {
      // Fallback to raw token
    }
    return trimmed;
  };

  const runTokenVerification = async (rawToken: string) => {
    const cleanToken = extractToken(rawToken);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanToken)) {
      setLookupResult(null);
      setLookupError('Enter a valid verification token or QR verification URL.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    try {
      const snap = await getDoc(doc(db, 'touristVerifications', cleanToken));
      if (!snap.exists()) {
        setLookupResult(null);
        setLookupError('No matching TourSafe 360 Tourist ID record found for this verification token.');
        return;
      }
      const d = snap.data();
      setLookupResult({
        token: d.token,
        touristId: d.touristId,
        uid: d.uid,
        displayName: d.displayName,
        nationality: d.nationality,
        photoUrl: d.photoUrl || '',
        registeredDateIso: d.registeredDateIso,
        emailVerified: Boolean(d.emailVerified),
        status: d.status === 'suspended' ? 'suspended' : 'active',
      });
    } catch (err: unknown) {
      setLookupResult(null);
      setLookupError(
        err instanceof Error ? err.message : 'Unable to query verification status right now.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleNativeShare = async () => {
    if (!verificationUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `TourSafe 360 Kerala Tourist ID – ${publicProfile.touristId}`,
          text: `Verify ${publicProfile.displayName}'s TourSafe 360 Kerala Tourist ID (${publicProfile.touristId})`,
          url: verificationUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    handleCopyShareLink();
  };

  const handleDownloadPdf = async () => {
    if (!hasIssuedId || !publicProfile.touristId) return;
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header Banner (Kerala Deep Green)
      pdf.setFillColor(6, 78, 59);
      pdf.rect(15, 15, 180, 32, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('TourSafe 360 – Kerala Smart Tourism Safety System', 22, 28);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(167, 243, 208);
      pdf.text('Application-Issued Digital Tourist Identification Card', 22, 37);

      // Card Body Frame
      pdf.setDrawColor(203, 213, 225);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(15, 52, 180, 96, 3, 3, 'FD');

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('UNIQUE KERALA TOURIST ID', 22, 64);

      pdf.setFont('courier', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(6, 78, 59);
      pdf.text(publicProfile.touristId, 22, 73);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105);
      pdf.text('Full Name:', 22, 86);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(publicProfile.displayName || 'Traveler', 62, 86);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Nationality:', 22, 96);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(publicProfile.nationality || 'Indian', 62, 96);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Registration Date:', 22, 106);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        publicProfile.registeredDateIso ? formatIstDate(publicProfile.registeredDateIso) : 'Active',
        62,
        106
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Card Status:', 22, 116);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(22, 163, 74);
      pdf.text(
        `${(publicProfile.accountStatus || 'active').toUpperCase()} · ${
          fbUser?.emailVerified ? 'EMAIL VERIFIED' : 'ACCOUNT REGISTERED'
        }`,
        62,
        116
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text('Kerala Emergency Helplines: 112 (Emergency) | 100 (Police) | 101 (Fire) | 108 (Ambulance)', 22, 134);

      if (qrDataUrl) {
        pdf.addImage(qrDataUrl, 'PNG', 142, 60, 44, 44);
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text('Scan to Verify Card Status', 145, 110);
      }

      // Mandatory Non-Government ID Disclaimer Box
      pdf.setFillColor(254, 243, 199);
      pdf.setDrawColor(245, 158, 11);
      pdf.roundedRect(15, 156, 180, 24, 2, 2, 'FD');
      pdf.setTextColor(120, 53, 15);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text('IMPORTANT IDENTIFICATION DISCLAIMER:', 20, 165);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(
        'This is a TourSafe 360 application-issued identification card and NOT a government-issued',
        20,
        171
      );
      pdf.text(
        'identity document. Carry your official passport or government ID as required by law.',
        20,
        176
      );

      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(8);
      pdf.text(`Generated on ${formatIstDateTime(new Date())} · Verification Link: ${verificationUrl}`, 15, 190);

      pdf.save(`${publicProfile.touristId}_Kerala_Tourist_ID.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleRefreshOrSendVerification = async (sendEmail: boolean) => {
    if (!fbUser) return;
    setVerifyingEmailBusy(true);
    setEmailStatusMsg(null);
    try {
      if (sendEmail && !fbUser.emailVerified) {
        await sendEmailVerification(fbUser);
        setEmailStatusMsg('Verification email sent. Click the link in your inbox, then click Refresh Status.');
      } else {
        await fbUser.reload();
        if (fbUser.emailVerified && publicProfile.verificationToken) {
          await updateDoc(doc(db, 'touristVerifications', publicProfile.verificationToken), {
            emailVerified: true,
            updatedAt: serverTimestamp(),
          });
          setEmailStatusMsg('Email verification confirmed and synced to your Digital Tourist ID.');
        } else {
          setEmailStatusMsg(
            fbUser.emailVerified
              ? 'Your email address is verified.'
              : 'Email not yet verified. Check your inbox and spam folder.'
          );
        }
      }
    } catch (err: unknown) {
      setEmailStatusMsg(err instanceof Error ? err.message : 'Could not update verification status.');
    } finally {
      setVerifyingEmailBusy(false);
    }
  };

  const initials = (publicProfile.displayName || 'KT')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Digital Kerala Tourist ID Card & QR Verification
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Permanent unique Tourist ID issued once at registration · Never used as an authentication token or password.
          </p>
        </div>

        {!fbUser && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Register to Issue Official Tourist ID
          </button>
        )}
      </div>

      {/* Mandatory Non-Government ID Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-950 leading-relaxed font-medium">{t.nonGovIdDisclaimer}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Digital Tourist ID Card */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl overflow-hidden border border-emerald-900/20 bg-white shadow-sm">
            {/* Kerala Emerald Card Top Header */}
            <div className="bg-emerald-950 text-white px-6 py-5 flex items-center justify-between gap-4 border-b border-emerald-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <IdCard className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-base font-bold tracking-tight">TourSafe 360 · Kerala</span>
                </div>
                <p className="text-xs text-emerald-300">
                  Smart Tourism Safety & Traveler Identification Card
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="text-emerald-300 block">Status</span>
                <span className="font-semibold text-amber-300 uppercase">
                  {hasIssuedId ? publicProfile.accountStatus || 'Active' : 'Demo Preview'}
                </span>
              </div>
            </div>

            {/* Card Interior */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center bg-gradient-to-br from-white via-slate-50 to-emerald-50/40">
              <div className="sm:col-span-8 space-y-4">
                <div className="flex items-center gap-4">
                  {publicProfile.photoUrl ? (
                    <img
                      src={publicProfile.photoUrl}
                      alt={publicProfile.displayName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-emerald-800/20 shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-900 text-white flex items-center justify-center text-lg font-bold shrink-0">
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{t.touristIdLabel}</p>
                    <p className="text-lg sm:text-xl font-bold font-mono-tabular text-emerald-950 tracking-tight truncate">
                      {hasIssuedId ? publicProfile.touristId : 'TS360-KL-2026-DEMO00'}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {publicProfile.displayName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nationality</span>
                    <span className="font-semibold text-slate-900">
                      {publicProfile.nationality || 'Indian'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registered (IST)</span>
                    <span className="font-semibold font-mono-tabular text-slate-900">
                      {publicProfile.registeredDateIso
                        ? formatIstDate(publicProfile.registeredDateIso)
                        : 'Demo Session'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Verification Standing</span>
                    <span className="font-medium text-emerald-800">
                      {!fbUser
                        ? 'Unregistered Preview · Sign in or Register for Permanent ID'
                        : fbUser.emailVerified
                        ? 'Authenticated Account · Verified Email'
                        : 'Authenticated Account · Email Verification Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Block */}
              <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Unique Tourist ID Verification QR Code"
                    className="w-32 h-32 object-contain"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center text-slate-400">
                    <QrCode className="w-8 h-8" />
                  </div>
                )}
                <span className="text-[11px] text-slate-500 mt-1.5 text-center">
                  Scan for Non-PII Card Verification
                </span>
              </div>
            </div>

            {/* Card Footer Disclaimer */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>Application-Issued Safety ID · Not a Government ID</span>
              <span className="font-mono-tabular">Helplines: 112 · 100 · 108</span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!hasIssuedId || downloadingPdf}
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-900 rounded-lg hover:bg-emerald-950 disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download ID Card (PDF)
            </button>

            <button
              type="button"
              disabled={!hasIssuedId}
              onClick={handleCopyShareLink}
              className="px-4 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  Verification Link Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Verification Link
                </>
              )}
            </button>

            <button
              type="button"
              disabled={!hasIssuedId}
              onClick={handleNativeShare}
              className="px-4 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Share2 className="w-4 h-4 text-orange-600" />
              Share Card Status
            </button>

            {fbUser && !fbUser.emailVerified && (
              <>
                <button
                  type="button"
                  disabled={verifyingEmailBusy}
                  onClick={() => handleRefreshOrSendVerification(true)}
                  className="px-3.5 py-2.5 text-xs font-medium text-amber-900 bg-amber-100 rounded-lg hover:bg-amber-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <MailCheck className="w-4 h-4" />
                  Send Verification Email
                </button>
                <button
                  type="button"
                  disabled={verifyingEmailBusy}
                  onClick={() => handleRefreshOrSendVerification(false)}
                  className="px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Status
                </button>
              </>
            )}
          </div>

          {emailStatusMsg && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
              {emailStatusMsg}
            </p>
          )}
        </div>

        {/* Right: QR Verification Inspector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Verify a TourSafe 360 QR Token
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hotel desks, tour operators, or trusted contacts can verify a shared Tourist ID token here. Private PII (phone, email, DOB, and live GPS coordinates) is strictly excluded from QR verification records.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runTokenVerification(lookupInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Paste verification URL or token (vrf_...)"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {lookupLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Verify
            </button>
          </form>

          {hasIssuedId && publicProfile.verificationToken && (
            <button
              type="button"
              onClick={() => {
                setLookupInput(publicProfile.verificationToken || '');
                runTokenVerification(publicProfile.verificationToken || '');
              }}
              className="text-xs text-emerald-800 font-medium hover:underline"
            >
              Test verification with my own card token
            </button>
          )}

          {lookupError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs">
              {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Verified TourSafe 360 Record
                </span>
                <span
                  className={`font-semibold uppercase ${
                    lookupResult.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {lookupResult.status}
                </span>
              </div>

              <div className="space-y-1 text-slate-700 pt-1 border-t border-emerald-200/70">
                <p>
                  <span className="text-slate-500">Tourist ID:</span>{' '}
                  <strong className="font-mono-tabular text-slate-900">{lookupResult.touristId}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Holder Name:</span>{' '}
                  <strong className="text-slate-900">{lookupResult.displayName}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Nationality:</span> {lookupResult.nationality}
                </p>
                <p>
                  <span className="text-slate-500">Issued Date:</span>{' '}
                  <span className="font-mono-tabular">{formatIstDate(lookupResult.registeredDateIso)}</span>
                </p>
                <p>
                  <span className="text-slate-500">Email Verified:</span>{' '}
                  {lookupResult.emailVerified ? 'Yes' : 'Pending'}
                </p>
              </div>

              <p className="text-[11px] text-amber-900 pt-1.5 border-t border-emerald-200/70">
                Note: Application-issued TourSafe 360 card only — NOT a government identity document.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
