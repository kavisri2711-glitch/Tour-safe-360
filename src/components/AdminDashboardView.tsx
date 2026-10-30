import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Activity,
  AlertOctagon,
  CloudLightning,
  MapPinned,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DestinationGuideRecord,
  EmergencyEventRecord,
  KeralaDestinationCategory,
  KeralaDistrictName,
  SafetyAlertRecord,
  SafetyReportRecord,
  UserPublicProfile,
} from '../types';
import { KERALA_DESTINATION_CATEGORIES, KERALA_DISTRICTS } from '../data/keralaData';
import { clampString, formatCoord, generateSafeId } from '../utils/geo';
import { formatIstDateTime } from '../utils/i18n';

interface AdminDashboardViewProps {
  currentUserId: string;
  isAdmin: boolean;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUserId,
  isAdmin,
}) => {
  const [users, setUsers] = useState<UserPublicProfile[]>([]);
  const [events, setEvents] = useState<EmergencyEventRecord[]>([]);
  const [reports, setReports] = useState<SafetyReportRecord[]>([]);
  const [destinations, setDestinations] = useState<DestinationGuideRecord[]>([]);
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlertRecord[]>([]);

  // Tourist ID Search
  const [touristSearch, setTouristSearch] = useState('');

  // Destination Form
  const [destName, setDestName] = useState('');
  const [destDistrict, setDestDistrict] = useState<KeralaDistrictName>('Idukki');
  const [destRegion, setDestRegion] = useState('');
  const [destCategory, setDestCategory] = useState<KeralaDestinationCategory>('Hill stations');
  const [destLat, setDestLat] = useState('10.0889');
  const [destLng, setDestLng] = useState('77.0595');
  const [destEmergencyNum, setDestEmergencyNum] = useState('112');
  const [destNotes, setDestNotes] = useState('');
  const [submittingDest, setSubmittingDest] = useState(false);

  // Safety Advisory Form
  const [alertTitle, setAlertTitle] = useState('');
  const [alertDistrict, setAlertDistrict] = useState<string>('Idukki');
  const [alertSeverity, setAlertSeverity] = useState<'advisory' | 'watch' | 'warning'>('advisory');
  const [alertCategory, setAlertCategory] = useState('Monsoon / Ghat Road Advisory');
  const [alertAuthority, setAlertAuthority] = useState('District Tourism Control / KSDMA Bulletin');
  const [alertValidUntil, setAlertValidUntil] = useState('Next 48 Hours IST');
  const [alertDesc, setAlertDesc] = useState('');
  const [submittingAlert, setSubmittingAlert] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserPublicProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'emergencyEvents'), orderBy('createdAt', 'desc')),
      (snap) => {
        setEvents(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              ownerId: raw.ownerId,
              ownerName: raw.ownerName,
              touristId: raw.touristId,
              alertType: raw.alertType,
              latitude: raw.latitude,
              longitude: raw.longitude,
              accuracy: raw.accuracy,
              notes: raw.notes,
              deliveryStatus: raw.deliveryStatus,
              status: raw.status,
              authorizedEmails: raw.authorizedEmails ?? [],
              createdAtMs: raw.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'emergencyEvents')
    );

    const unsubReports = onSnapshot(
      query(collection(db, 'reports'), orderBy('createdAt', 'desc')),
      (snap) => {
        setReports(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              reporterId: raw.reporterId,
              reporterName: raw.reporterName,
              category: raw.category,
              description: raw.description,
              status: raw.status,
              createdAtMs: raw.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
    );

    const unsubDests = onSnapshot(
      collection(db, 'destinations'),
      (snap) => {
        setDestinations(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              name: raw.name,
              region: raw.region,
              district: raw.district,
              category: raw.category,
              latitude: raw.latitude,
              longitude: raw.longitude,
              safetyNotes: raw.safetyNotes,
              emergencyNumber: raw.emergencyNumber,
              createdBy: raw.createdBy,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'destinations')
    );

    const unsubAlerts = onSnapshot(
      collection(db, 'safetyAlerts'),
      (snap) => {
        setSafetyAlerts(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              title: raw.title,
              district: raw.district,
              severity: raw.severity,
              category: raw.category,
              sourceAuthority: raw.sourceAuthority,
              issuedAtIso: raw.issuedAtIso,
              validUntilIso: raw.validUntilIso,
              description: raw.description,
              createdBy: raw.createdBy,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'safetyAlerts')
    );

    return () => {
      unsubUsers();
      unsubEvents();
      unsubReports();
      unsubDests();
      unsubAlerts();
    };
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = touristSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.touristId || '').toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        (u.nationality || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, touristSearch]);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-base font-semibold text-slate-900">Administrator Access Restricted</p>
        <p className="text-xs text-slate-500 mt-1">
          Your account does not hold administrator privileges. Role-based access control is enforced by Firestore Security Rules.
        </p>
      </div>
    );
  }

  const handleToggleAccountStatus = async (u: UserPublicProfile) => {
    const nextStatus: 'active' | 'suspended' =
      u.accountStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        accountStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      if (u.verificationToken) {
        await updateDoc(doc(db, 'touristVerifications', u.verificationToken), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(destLat);
    const lng = Number(destLng);
    if (!destName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) return;

    setSubmittingDest(true);
    const destId = generateSafeId('dest');
    try {
      await setDoc(doc(db, 'destinations', destId), {
        name: clampString(destName, 100),
        region: clampString(destRegion || `${destDistrict}, Kerala`, 80),
        district: clampString(destDistrict, 40),
        category: clampString(destCategory, 40),
        latitude: Math.max(-90, Math.min(90, lat)),
        longitude: Math.max(-180, Math.min(180, lng)),
        safetyNotes: clampString(destNotes || 'Observe standard Kerala travel safety guidelines.', 600),
        emergencyNumber: clampString(destEmergencyNum || '112', 30),
        createdBy: currentUserId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDestName('');
      setDestRegion('');
      setDestNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `destinations/${destId}`);
    } finally {
      setSubmittingDest(false);
    }
  };

  const handleAddSafetyAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertDesc.trim()) return;

    setSubmittingAlert(true);
    const alertId = generateSafeId('alrt');
    try {
      await setDoc(doc(db, 'safetyAlerts', alertId), {
        title: clampString(alertTitle, 140),
        district: clampString(alertDistrict, 40),
        severity: alertSeverity,
        category: clampString(alertCategory, 40),
        sourceAuthority: clampString(alertAuthority, 100),
        issuedAtIso: clampString(formatIstDateTime(new Date()), 40),
        validUntilIso: clampString(alertValidUntil || 'Until Further Notice', 40),
        description: clampString(alertDesc, 800),
        createdBy: currentUserId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAlertTitle('');
      setAlertDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `safetyAlerts/${alertId}`);
    } finally {
      setSubmittingAlert(false);
    }
  };

  const handleDeleteSafetyAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'safetyAlerts', alertId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `safetyAlerts/${alertId}`);
    }
  };

  const handleUpdateEventStatus = async (
    eventId: string,
    nextStatus: 'acknowledged' | 'resolved'
  ) => {
    try {
      await updateDoc(doc(db, 'emergencyEvents', eventId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencyEvents/${eventId}`);
    }
  };

  const handleUpdateReportStatus = async (
    reportId: string,
    nextStatus: 'investigating' | 'closed'
  ) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const handleDeleteDestination = async (destId: string) => {
    try {
      await deleteDoc(doc(db, 'destinations', destId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `destinations/${destId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Kerala Smart Tourism Safety · Administrator Operations Console
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Strict RBAC enforced · Private tourist PII (phone/email/DOB) and private GPS location histories are isolated and inaccessible to administrators.
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Registered Tourists</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-2">{users.length}</p>
          <p className="text-xs text-slate-500 mt-1">Non-PII Tourist ID registry</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Emergency Events</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-2">
            {events.filter((e) => e.status !== 'resolved').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">{events.length} total recorded</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Open Safety Reports</span>
            <ShieldCheck className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-2">
            {reports.filter((r) => r.status !== 'closed').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">{reports.length} submitted</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Published Advisories</span>
            <Activity className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-bold font-mono-tabular text-emerald-800 mt-2">
            {safetyAlerts.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Firestore ABAC Active</p>
        </div>
      </div>

      {/* Tourist ID Search & Standing Management */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tourist ID Registry & Search (Privacy-Preserving View)
            </h3>
            <p className="text-xs text-slate-500">
              Search by Kerala Tourist ID (TS360-KL-2026-...), name, or nationality.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search TS360-KL-2026-000001..."
              value={touristSearch}
              onChange={(e) => setTouristSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="p-6 text-xs text-slate-500">No matching registered tourists found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Tourist ID</th>
                  <th className="px-4 py-3 font-medium">Full Name</th>
                  <th className="px-4 py-3 font-medium">Nationality</th>
                  <th className="px-4 py-3 font-medium">Tracking Consent</th>
                  <th className="px-4 py-3 font-medium">Standing</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-emerald-950">
                      {u.touristId || 'Pending Migration'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{u.displayName}</td>
                    <td className="px-4 py-3 text-slate-600">{u.nationality || 'Indian'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.trackingConsent ? 'Granted' : 'Off'}
                    </td>
                    <td className="px-4 py-3 capitalize font-medium">
                      <span
                        className={
                          u.accountStatus === 'suspended' ? 'text-red-700' : 'text-emerald-700'
                        }
                      >
                        {u.accountStatus || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleAccountStatus(u)}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        {u.accountStatus === 'suspended' ? 'Reactivate ID' : 'Suspend ID'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Authorized Emergency Events Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Authorized Emergency SOS Events</h3>
        </div>
        {events.length === 0 ? (
          <p className="p-6 text-xs text-slate-500">No emergency alerts recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Traveler & Tourist ID</th>
                  <th className="px-4 py-3 font-medium">Alert Type</th>
                  <th className="px-4 py-3 font-medium">Coordinates</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{ev.ownerName}</p>
                      {ev.touristId && (
                        <p className="text-[11px] font-mono-tabular text-slate-500">
                          {ev.touristId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{ev.alertType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600">
                      {formatCoord(ev.latitude)}, {formatCoord(ev.longitude)}
                    </td>
                    <td className="px-4 py-3 capitalize font-medium text-slate-800">{ev.status}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {ev.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateEventStatus(ev.id, 'acknowledged')}
                          className="px-2.5 py-1 text-xs font-medium text-orange-700 hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
                      {ev.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateEventStatus(ev.id, 'resolved')}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 hover:underline"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Publish Advisories & Destinations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publish Kerala Safety Advisory */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CloudLightning className="w-4 h-4 text-red-600" />
            Publish Verified Kerala Safety / Weather Advisory
          </h3>
          <form onSubmit={handleAddSafetyAlert} className="space-y-3">
            <input
              type="text"
              required
              maxLength={140}
              placeholder="Advisory Title (e.g., Idukki High-Range Ghat Fog Caution)"
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={alertDistrict}
                onChange={(e) => setAlertDistrict(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="All Kerala">All Kerala</option>
                {KERALA_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={alertSeverity}
                onChange={(e) =>
                  setAlertSeverity(e.target.value as 'advisory' | 'watch' | 'warning')
                }
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="advisory">Advisory (Informational)</option>
                <option value="watch">Watch (Be Prepared)</option>
                <option value="warning">Warning (Action Needed)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Official Source Authority"
                value={alertAuthority}
                onChange={(e) => setAlertAuthority(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                maxLength={40}
                placeholder="Valid Window (e.g., Next 24h IST)"
                value={alertValidUntil}
                onChange={(e) => setAlertValidUntil(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              required
              maxLength={40}
              placeholder="Category (e.g. Ghat Road / Coastal)"
              value={alertCategory}
              onChange={(e) => setAlertCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <textarea
              rows={2}
              required
              maxLength={800}
              placeholder="Detailed verified advisory message..."
              value={alertDesc}
              onChange={(e) => setAlertDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={submittingAlert}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-900 rounded-lg hover:bg-emerald-950 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Publish Safety Advisory
            </button>
          </form>

          {safetyAlerts.length > 0 && (
            <div className="divide-y divide-slate-100 pt-2 border-t border-slate-200">
              {safetyAlerts.map((al) => (
                <div key={al.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {al.title} ({al.district})
                    </p>
                    <p className="text-slate-500">
                      {al.severity.toUpperCase()} · {al.sourceAuthority}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSafetyAlert(al.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete Advisory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publish Kerala Destination Guide */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-orange-600" />
            Manage Kerala Destination Guides
          </h3>

          <form onSubmit={handleAddDestination} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Destination Name"
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <select
                value={destDistrict}
                onChange={(e) => setDestDistrict(e.target.value as KeralaDistrictName)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {KERALA_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={destCategory}
                onChange={(e) => setDestCategory(e.target.value as KeralaDestinationCategory)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {KERALA_DESTINATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Sub-region / Locality"
                value={destRegion}
                onChange={(e) => setDestRegion(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                step="any"
                required
                placeholder="Latitude"
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                step="any"
                required
                placeholder="Longitude"
                value={destLng}
                onChange={(e) => setDestLng(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Helpline (112)"
                value={destEmergencyNum}
                onChange={(e) => setDestEmergencyNum(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
            <textarea
              rows={2}
              required
              placeholder="Verified destination safety advisory & IST visiting hours..."
              value={destNotes}
              onChange={(e) => setDestNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={submittingDest}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Publish Kerala Destination
            </button>
          </form>

          {destinations.length > 0 && (
            <div className="divide-y divide-slate-100 pt-2 border-t border-slate-200">
              {destinations.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {d.name} {d.district ? `(${d.district})` : ''}
                    </p>
                    <p className="text-slate-500">
                      {d.category} · {formatCoord(d.latitude, 4)}, {formatCoord(d.longitude, 4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDestination(d.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete Destination"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submitted Tourist Safety Reports */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Submitted Tourist Safety Reports</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-500">No tourist safety reports submitted yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.map((r) => (
              <div key={r.id} className="py-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {r.category} · {r.reporterName}
                  </span>
                  <span className="capitalize text-slate-600">{r.status}</span>
                </div>
                <p className="text-slate-600">{r.description}</p>
                {r.status !== 'closed' && (
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateReportStatus(r.id, 'investigating')}
                      className="text-orange-700 font-medium hover:underline"
                    >
                      Mark Investigating
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateReportStatus(r.id, 'closed')}
                      className="text-emerald-700 font-medium hover:underline"
                    >
                      Close Report
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
