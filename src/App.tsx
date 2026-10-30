import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Check,
  CloudSun,
  Compass,
  Copy,
  Globe,
  History,
  IdCard,
  LayoutDashboard,
  Loader2,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Play,
  Plus,
  QrCode,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  ensureTouristProfileAndUniqueId,
  handleFirestoreError,
  OperationType,
  validateFirestoreConnection,
} from './firebase';
import {
  AppLanguage,
  Coordinates,
  DestinationGuideRecord,
  EmergencyAlertType,
  EmergencyContact,
  EmergencyEventRecord,
  GeofenceZone,
  KeralaDistrictName,
  LocationLogEntry,
  NavSection,
  NotificationCategory,
  NotificationRecord,
  TrackingSessionRecord,
  UserPrivateInfo,
  UserPublicProfile,
} from './types';
import {
  DEMO_KERALA_CONTACTS,
  KERALA_DESTINATIONS,
  KERALA_GEOFENCE_PRESETS,
  KERALA_HERO_IMAGE,
} from './data/keralaData';
import {
  calculateHaversineMeters,
  clampString,
  formatCoord,
  formatDistance,
  generateSafeId,
} from './utils/geo';
import {
  formatInr,
  formatIstDateTime,
  formatIstTime,
  UI_STRINGS,
} from './utils/i18n';
import { MapCircleItem, MapMarkerItem, TourSafeMap } from './components/TourSafeMap';
import { AIRecommendationsView } from './components/AIRecommendationsView';
import { NearbyEmergencyView } from './components/NearbyEmergencyView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AuthPortalModal } from './components/AuthPortalModal';
import { DigitalTouristIdView } from './components/DigitalTouristIdView';
import { KeralaDestinationsView } from './components/KeralaDestinationsView';
import { WeatherSafetyAlertsView } from './components/WeatherSafetyAlertsView';

const RAW_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
const HAS_MAPS_KEY = Boolean(RAW_MAPS_KEY && RAW_MAPS_KEY !== 'MY_GOOGLE_MAPS_API_KEY');

export default function App() {
  // Language & Deep-Link QR Verification State
  const [language, setLanguage] = useState<AppLanguage>('en');
  const t = UI_STRINGS[language];

  const [initialVerifyToken, setInitialVerifyToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('verify');
    return tok && /^[a-zA-Z0-9_-]{1,128}$/.test(tok) ? tok : null;
  });

  // Auth & Profile State
  const [authReady, setAuthReady] = useState(false);
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register' | 'reset'>('register');

  const [publicProfile, setPublicProfile] = useState<UserPublicProfile>({
    uid: 'demo_user',
    displayName: 'Guest Tourist (Kerala Demo)',
    nationality: 'Indian',
    trackingConsent: true,
    sharingConsent: true,
    trackingIntervalSec: 10,
  });
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo>({
    uid: 'demo_user',
    email: '',
    phone: '',
    dob: '',
    stateRegion: 'Kerala',
    country: 'India',
    personalInfoConsent: true,
    travelStyle: 'family',
    budgetTier: 'moderate',
  });

  // Connectivity, Navigation & GPS State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [activeNav, setActiveNav] = useState<NavSection>(() =>
    initialVerifyToken ? 'tourist-id' : 'dashboard'
  );
  const [weatherFocusDistrict, setWeatherFocusDistrict] = useState<KeralaDistrictName | null>(
    'Ernakulam'
  );

  // Neutral map camera center for Kerala when GPS tracking has not started yet (never treated as user GPS)
  const keralaMapOverviewCenter = { lat: 10.1632, lng: 76.6413 };

  // Real Browser Geolocation State — strictly null until user grants permission and starts tracking
  const [gpsPosition, setGpsPosition] = useState<Coordinates | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<
    'prompt' | 'granted' | 'denied' | 'unsupported'
  >(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported'
  );
  const [awaitingFirstFix, setAwaitingFirstFix] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [gpsStatusNote, setGpsStatusNote] = useState<string | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string>(() => generateSafeId('trip'));

  // Active Geofence Transition Alert Banner (Entry / Exit)
  const [geofenceAlert, setGeofenceAlert] = useState<{
    id: string;
    transition: 'ENTERED' | 'EXITED';
    zoneName: string;
    distanceMeters: number;
    radiusMeters: number;
    timestamp: number;
  } | null>(null);

  // Domain Collections State (no fake geofences or fake GPS logs)
  const [contacts, setContacts] = useState<EmergencyContact[]>(DEMO_KERALA_CONTACTS);
  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [locationLogs, setLocationLogs] = useState<LocationLogEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [destinations, setDestinations] = useState<DestinationGuideRecord[]>(KERALA_DESTINATIONS);
  const [mySessions, setMySessions] = useState<TrackingSessionRecord[]>([]);
  const [sharedWithMeSessions, setSharedWithMeSessions] = useState<TrackingSessionRecord[]>([]);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEventRecord[]>([]);

  // Interactive UI / Modal States
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosAlertType, setSosAlertType] = useState<EmergencyAlertType>('sos_emergency');
  const [sosNotes, setSosNotes] = useState('');
  const [sosSubmitting, setSosSubmitting] = useState(false);

  const [confirmClearHistoryOpen, setConfirmClearHistoryOpen] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [watchedSessionInput, setWatchedSessionInput] = useState('');
  const [watchedSessionData, setWatchedSessionData] = useState<TrackingSessionRecord | null>(null);
  const [watchedSessionError, setWatchedSessionError] = useState<string | null>(null);

  // Geofence Form State
  const [geoName, setGeoName] = useState('My Safe Zone');
  const [geoLat, setGeoLat] = useState('');
  const [geoLng, setGeoLng] = useState('');
  const [geoRadius, setGeoRadius] = useState('250');
  const [geoNotifyContacts, setGeoNotifyContacts] = useState(true);
  const [editingGeoId, setEditingGeoId] = useState<string | null>(null);
  const [geoFormError, setGeoFormError] = useState<string | null>(null);

  // Wireless Session Form State
  const [sessionTripName, setSessionTripName] = useState('Kochi – Munnar Kerala Journey');
  const [sessionDurationMin, setSessionDurationMin] = useState(120);
  const [selectedContactEmails, setSelectedContactEmails] = useState<string[]>([]);

  // Emergency Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRelation, setContactRelation] = useState('Family');
  const [contactNotifySos, setContactNotifySos] = useState(true);
  const [contactNotifyGeo, setContactNotifyGeo] = useState(true);

  // Safety Report Form State (Tourist -> Admin)
  const [reportCategory, setReportCategory] = useState('Ghat Road / Signage Concern');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmittedMsg, setReportSubmittedMsg] = useState<string | null>(null);

  // Geolocation watcher & geofence transition refs
  const watchIdRef = useRef<number | null>(null);
  const highAccuracyFallbackRef = useRef<boolean>(false);
  const geofenceInsideMapRef = useRef<Record<string, boolean>>({});
  const lastSavedLogTimeRef = useRef<number>(0);

  const openAuthPortal = (tab: 'signin' | 'register' | 'reset' = 'register') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  // Validate Firestore Connection on boot
  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  // Helper: Push In-App (and Browser Notification API where granted) Notification
  const pushNotification = useCallback(
    async (type: NotificationCategory, title: string, message: string) => {
      const safeTitle = clampString(title, 120);
      const safeMsg = clampString(message, 500);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(safeTitle, { body: safeMsg });
        } catch {
          // Ignore browser notification restrictions inside iframes
        }
      }

      if (fbUser) {
        const notifId = generateSafeId('ntf');
        try {
          await setDoc(doc(db, 'users', fbUser.uid, 'notifications', notifId), {
            ownerId: fbUser.uid,
            type,
            title: safeTitle,
            message: safeMsg,
            read: false,
            createdAt: serverTimestamp(),
          });
          return;
        } catch (err) {
          console.error('Failed to persist notification:', err);
        }
      }

      setNotifications((prev) => [
        {
          id: generateSafeId('local_ntf'),
          ownerId: fbUser?.uid ?? 'demo_user',
          type,
          title: safeTitle,
          message: safeMsg,
          read: false,
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
    },
    [fbUser]
  );

  // Online / Offline Connectivity Monitor
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      pushNotification(
        'connection_lost',
        'Internet Connection Interrupted',
        'Internet-based live coordinate transmission is paused until Wi-Fi or mobile data connectivity resumes.'
      );
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushNotification]);

  // Auth Listener & Atomic Unique Kerala Tourist ID Bootstrap / Migration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user) {
        try {
          // Atomically retrieves existing TS360-KL-YYYY-XXXXXX ID or performs one-time generation/migration
          await ensureTouristProfileAndUniqueId(user);

          // Check Admin status
          const emailMatch =
            user.emailVerified &&
            user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
          if (emailMatch) {
            setIsAdmin(true);
          } else {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            setIsAdmin(adminDoc.exists());
          }
        } catch (err) {
          console.error('Tourist ID bootstrap/migration check error:', err);
        }
      } else {
        setIsAdmin(false);
        setPublicProfile({
          uid: 'demo_user',
          displayName: 'Guest Tourist (Kerala Demo)',
          nationality: 'Indian',
          trackingConsent: true,
          sharingConsent: true,
          trackingIntervalSec: 10,
        });
        setPrivateInfo({
          uid: 'demo_user',
          email: '',
          phone: '',
          dob: '',
          stateRegion: 'Kerala',
          country: 'India',
          personalInfoConsent: true,
          travelStyle: 'family',
          budgetTier: 'moderate',
        });
        setContacts(DEMO_KERALA_CONTACTS);
        setGeofences([]);
        setLocationLogs([]);
        setMySessions([]);
        setSharedWithMeSessions([]);
        setEmergencyEvents([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore Listeners when Authenticated
  useEffect(() => {
    if (!authReady || !fbUser) return;
    const uid = fbUser.uid;

    const unsubPub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setPublicProfile(snap.data() as UserPublicProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const unsubPriv = onSnapshot(
      doc(db, 'users', uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setPrivateInfo(snap.data() as UserPrivateInfo);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/info`)
    );

    const unsubContacts = onSnapshot(
      query(collection(db, 'users', uid, 'contacts'), where('ownerId', '==', uid)),
      (snap) => {
        setContacts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EmergencyContact, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/contacts`)
    );

    const unsubGeo = onSnapshot(
      query(collection(db, 'users', uid, 'geofences'), where('ownerId', '==', uid)),
      (snap) => {
        setGeofences(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GeofenceZone, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/geofences`)
    );

    const unsubLogs = onSnapshot(
      query(
        collection(db, 'users', uid, 'locationLogs'),
        where('ownerId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(80)
      ),
      (snap) => {
        setLocationLogs(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              ownerId: raw.ownerId,
              tripId: raw.tripId,
              latitude: raw.latitude,
              longitude: raw.longitude,
              accuracy: raw.accuracy,
              source: raw.source,
              createdAtMs: raw.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/locationLogs`)
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'users', uid, 'notifications'),
        where('ownerId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snap) => {
        setNotifications(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              ownerId: raw.ownerId,
              type: raw.type,
              title: raw.title,
              message: raw.message,
              read: Boolean(raw.read),
              createdAtMs: raw.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/notifications`)
    );

    const unsubMySessions = onSnapshot(
      query(collection(db, 'trackingSessions'), where('ownerId', '==', uid)),
      (snap) => {
        setMySessions(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              ownerId: raw.ownerId,
              ownerName: raw.ownerName,
              tripName: raw.tripName,
              latitude: raw.latitude,
              longitude: raw.longitude,
              accuracy: raw.accuracy,
              isActive: Boolean(raw.isActive) && raw.expiresAtMs > Date.now(),
              source: raw.source,
              authorizedEmails: raw.authorizedEmails ?? [],
              expiresAtMs: raw.expiresAtMs,
              updatedAtMs: raw.updatedAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'trackingSessions')
    );

    // Cross-account shared sessions require email_verified == true in Firestore rules to prevent email spoofing
    const unsubSharedWithMe =
      fbUser.email && fbUser.emailVerified
        ? onSnapshot(
            query(
              collection(db, 'trackingSessions'),
              where('authorizedEmails', 'array-contains', fbUser.email)
            ),
            (snap) => {
              setSharedWithMeSessions(
                snap.docs
                  .filter((d) => d.data().ownerId !== uid)
                  .map((d) => {
                    const raw = d.data();
                    return {
                      id: d.id,
                      ownerId: raw.ownerId,
                      ownerName: raw.ownerName,
                      tripName: raw.tripName,
                      latitude: raw.latitude,
                      longitude: raw.longitude,
                      accuracy: raw.accuracy,
                      isActive: Boolean(raw.isActive) && raw.expiresAtMs > Date.now(),
                      source: raw.source,
                      authorizedEmails: raw.authorizedEmails ?? [],
                      expiresAtMs: raw.expiresAtMs,
                      updatedAtMs: raw.updatedAt?.toMillis?.() ?? Date.now(),
                    };
                  })
              );
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'trackingSessions')
          )
        : () => {};

    const unsubEvents = onSnapshot(
      query(collection(db, 'emergencyEvents'), where('ownerId', '==', uid)),
      (snap) => {
        setEmergencyEvents(
          snap.docs
            .map((d) => {
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
            .sort((a, b) => b.createdAtMs - a.createdAtMs)
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'emergencyEvents')
    );

    const unsubDests = onSnapshot(
      collection(db, 'destinations'),
      (snap) => {
        const cloudDests: DestinationGuideRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DestinationGuideRecord, 'id'>),
        }));
        setDestinations(
          cloudDests.length > 0 ? [...cloudDests, ...KERALA_DESTINATIONS] : KERALA_DESTINATIONS
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'destinations')
    );

    return () => {
      unsubPub();
      unsubPriv();
      unsubContacts();
      unsubGeo();
      unsubLogs();
      unsubNotifs();
      unsubMySessions();
      unsubSharedWithMe();
      unsubEvents();
      unsubDests();
    };
  }, [authReady, fbUser]);

  // Passive permission state observer (does NOT prompt or access coordinates)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsPermissionState('unsupported');
      return;
    }
    if (!navigator.permissions?.query) return;

    let permStatus: PermissionStatus | null = null;
    const syncState = () => {
      if (!permStatus) return;
      if (permStatus.state === 'granted' || permStatus.state === 'denied' || permStatus.state === 'prompt') {
        setGpsPermissionState(permStatus.state);
      }
    };

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        permStatus = status;
        syncState();
        status.onchange = syncState;
      })
      .catch(() => {
        // Ignore browsers that do not expose geolocation in Permissions API
      });

    return () => {
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  // Keep latest mutable context in a ref so watchPosition callbacks never trigger watch re-creation loops
  const trackingContextRef = useRef({
    fbUser,
    isOnline,
    currentTripId,
    publicProfile,
    mySessions,
    geofences,
    contacts,
    pushNotification,
  });

  useEffect(() => {
    trackingContextRef.current = {
      fbUser,
      isOnline,
      currentTripId,
      publicProfile,
      mySessions,
      geofences,
      contacts,
      pushNotification,
    };
  }, [
    fbUser,
    isOnline,
    currentTripId,
    publicProfile,
    mySessions,
    geofences,
    contacts,
    pushNotification,
  ]);

  // Synchronize baseline inside/outside map when geofences are added, toggled, or deleted
  useEffect(() => {
    const activeIds = new Set(geofences.filter((g) => g.isActive).map((g) => g.id));
    Object.keys(geofenceInsideMapRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        delete geofenceInsideMapRef.current[id];
      }
    });

    if (!gpsPosition) return;

    geofences.forEach((zone) => {
      if (!zone.isActive) return;
      if (geofenceInsideMapRef.current[zone.id] === undefined) {
        const dist = calculateHaversineMeters(
          gpsPosition.latitude,
          gpsPosition.longitude,
          zone.latitude,
          zone.longitude
        );
        geofenceInsideMapRef.current[zone.id] = dist <= zone.radiusMeters;
      }
    });
  }, [geofences, gpsPosition]);

  // Pre-fill geofence form inputs once with real GPS coordinates if form coordinates are still blank
  useEffect(() => {
    if (gpsPosition && !geoLat && !geoLng && !editingGeoId) {
      setGeoLat(String(Number(gpsPosition.latitude.toFixed(6))));
      setGeoLng(String(Number(gpsPosition.longitude.toFixed(6))));
    }
  }, [gpsPosition, geoLat, geoLng, editingGeoId]);

  // Format human-readable GeolocationPositionError messages
  const formatGeolocationError = useCallback((err: GeolocationPositionError): string => {
    if (err.code === 1) {
      return 'Location permission denied. Please allow Location access for this site in your browser settings (lock icon near the address bar), then click Start Tracking again.';
    }
    if (err.code === 2) {
      return 'Location unavailable. Your device could not determine a GPS or network location fix. Check that OS Location Services / GPS are enabled and move near a window or open sky.';
    }
    if (err.code === 3) {
      return 'Location request timed out while waiting for a GPS fix. Please check your device GPS/Wi-Fi signal and click Start Tracking to retry.';
    }
    return `GPS error: ${err.message || 'Unable to retrieve your current coordinates.'}`;
  }, []);

  // Geofence Entry & Exit Evaluation using Haversine Distance on Real GPS Coordinates
  const evaluateGeofencesForCoords = useCallback((lat: number, lng: number, accuracy: number) => {
    const {
      geofences: activeList,
      contacts: currentContacts,
      fbUser: currentUser,
      publicProfile: profile,
      pushNotification: notify,
    } = trackingContextRef.current;

    activeList.forEach((zone) => {
      if (!zone.isActive) return;
      const dist = calculateHaversineMeters(lat, lng, zone.latitude, zone.longitude);
      const isInside = dist <= zone.radiusMeters;
      const prevInside = geofenceInsideMapRef.current[zone.id];

      if (prevInside === undefined) {
        geofenceInsideMapRef.current[zone.id] = isInside;
        return;
      }

      if (prevInside && !isInside) {
        geofenceInsideMapRef.current[zone.id] = false;
        const roundedDist = Math.round(dist);
        setGeofenceAlert({
          id: generateSafeId('geo_alert'),
          transition: 'EXITED',
          zoneName: zone.name,
          distanceMeters: roundedDist,
          radiusMeters: zone.radiusMeters,
          timestamp: Date.now(),
        });
        notify(
          'geofence_exit',
          `Exited Geofence: ${zone.name}`,
          `You are now OUTSIDE "${zone.name}" — ${roundedDist} m from centre (radius ${zone.radiusMeters} m).`
        );

        if (zone.notifyContacts && currentUser) {
          const authorizedEmails = currentContacts
            .filter((c) => c.notifyOnGeofence && c.email)
            .map((c) => c.email)
            .slice(0, 10);
          const evId = generateSafeId('ev');
          setDoc(doc(db, 'emergencyEvents', evId), {
            ownerId: currentUser.uid,
            ownerName: clampString(profile.displayName, 80),
            ...(profile.touristId ? { touristId: clampString(profile.touristId, 32) } : {}),
            alertType: 'geofence_exit',
            latitude: lat,
            longitude: lng,
            accuracy,
            notes: clampString(
              `Automated Geofence Exit: ${zone.name} (${roundedDist}m from centre, radius ${zone.radiusMeters}m)`,
              400
            ),
            deliveryStatus:
              authorizedEmails.length > 0 ? 'shared_session_updated' : 'recorded_in_cloud',
            status: 'active',
            authorizedEmails,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch((e) => console.error('Geofence event write error:', e));
        }
      } else if (!prevInside && isInside) {
        geofenceInsideMapRef.current[zone.id] = true;
        const roundedDist = Math.round(dist);
        setGeofenceAlert({
          id: generateSafeId('geo_alert'),
          transition: 'ENTERED',
          zoneName: zone.name,
          distanceMeters: roundedDist,
          radiusMeters: zone.radiusMeters,
          timestamp: Date.now(),
        });
        notify(
          'geofence_entry',
          `Entered Geofence: ${zone.name}`,
          `You entered "${zone.name}" — INSIDE safe boundary (${roundedDist} m from centre, radius ${zone.radiusMeters} m).`
        );
      }
    });
  }, []);

  // Persist authorized real GPS position to Firestore / local session log
  const persistRealGpsCoordinate = useCallback(async (next: Coordinates) => {
    const {
      fbUser: currentUser,
      isOnline: online,
      currentTripId: tripId,
      publicProfile: profile,
      mySessions: sessions,
    } = trackingContextRef.current;

    if (!profile.trackingConsent) return;

    const intervalMs = Math.max(5, profile.trackingIntervalSec || 10) * 1000;
    const now = Date.now();
    if (now - lastSavedLogTimeRef.current < intervalMs - 800) {
      return;
    }
    lastSavedLogTimeRef.current = now;

    if (currentUser && online) {
      const logId = generateSafeId('log');
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'locationLogs', logId), {
          ownerId: currentUser.uid,
          tripId,
          latitude: next.latitude,
          longitude: next.longitude,
          accuracy: next.accuracy,
          source: 'gps',
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('Location log write failed:', e);
      }

      if (profile.sharingConsent) {
        sessions
          .filter((s) => s.isActive && s.expiresAtMs > Date.now())
          .forEach((sess) => {
            updateDoc(doc(db, 'trackingSessions', sess.id), {
              latitude: next.latitude,
              longitude: next.longitude,
              accuracy: next.accuracy,
              source: 'gps',
              updatedAt: serverTimestamp(),
            }).catch((err) => console.error('Live session update failed:', err));
          });
      }
    } else {
      setLocationLogs((prev) => [
        {
          id: generateSafeId('gps_log'),
          ownerId: currentUser?.uid ?? 'local_session',
          tripId,
          latitude: next.latitude,
          longitude: next.longitude,
          accuracy: next.accuracy,
          source: 'gps',
          createdAtMs: now,
        },
        ...prev,
      ]);
    }
  }, []);

  // Stop GPS Tracking cleanly and clear active watchPosition subscription
  const stopGpsTracking = useCallback(
    (silent = false) => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      highAccuracyFallbackRef.current = false;
      setTrackingActive(false);
      setAwaitingFirstFix(false);
      setGpsStatusNote(null);

      if (!silent) {
        trackingContextRef.current.pushNotification(
          'tracking_stopped',
          'GPS Tracking Stopped',
          'Browser GPS watchPosition updates have been stopped.'
        );
      }
    },
    []
  );

  // Clean up any active watchPosition if component unmounts or user revokes tracking consent
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!publicProfile.trackingConsent && trackingActive) {
      stopGpsTracking(true);
      setGpsErrorMsg('Explicit location tracking consent was turned off in Profile Settings.');
    }
  }, [publicProfile.trackingConsent, trackingActive, stopGpsTracking]);

  // Start Continuous GPS Tracking via navigator.geolocation.watchPosition (invoked directly on user click)
  const startGpsTracking = useCallback(
    (navigateToGpsScreen = false) => {
      if (navigateToGpsScreen) {
        setActiveNav('gps-tracking');
      }

      if (!publicProfile.trackingConsent) {
        setGpsErrorMsg(
          'Explicit GPS Location Tracking Consent is disabled. Enable it in Profile Settings before starting GPS tracking.'
        );
        return;
      }

      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setGpsPermissionState('unsupported');
        setAwaitingFirstFix(false);
        setTrackingActive(false);
        setGpsErrorMsg(
          'Geolocation is not supported by this browser. Please open TourSafe 360 in a modern GPS-capable browser over HTTPS.'
        );
        return;
      }

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      const nextTrip = generateSafeId('trip');
      setCurrentTripId(nextTrip);
      trackingContextRef.current.currentTripId = nextTrip;
      lastSavedLogTimeRef.current = 0;
      highAccuracyFallbackRef.current = false;

      setGpsErrorMsg(null);
      setGpsStatusNote(null);
      setAwaitingFirstFix(true);
      setTrackingActive(true);

      const handlePositionSuccess = (pos: GeolocationPosition) => {
        setGpsPermissionState('granted');
        setAwaitingFirstFix(false);
        setGpsErrorMsg(null);
        const roundedAcc = Math.max(1, Math.round(pos.coords.accuracy));
        setGpsStatusNote(
          roundedAcc > 250
            ? `Coarse location accuracy (±${roundedAcc} m via Wi-Fi/cell network). Move outdoors for tighter satellite GPS precision.`
            : null
        );

        const next: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: roundedAcc,
          timestamp: pos.timestamp || Date.now(),
          source: 'gps',
        };
        setGpsPosition(next);
        evaluateGeofencesForCoords(next.latitude, next.longitude, next.accuracy);
        persistRealGpsCoordinate(next);
      };

      const attachWatcher = (highAccuracy: boolean) => {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          (err) => {
            if (err.code === 1) {
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              setGpsPermissionState('denied');
              setAwaitingFirstFix(false);
              setTrackingActive(false);
              setGpsStatusNote(null);
              setGpsErrorMsg(formatGeolocationError(err));
              return;
            }

            // Automatic fallback from high-accuracy GNSS to standard Wi-Fi/network geolocation on timeout/unavailable
            if (highAccuracy && !highAccuracyFallbackRef.current && (err.code === 2 || err.code === 3)) {
              highAccuracyFallbackRef.current = true;
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              setGpsStatusNote(
                'High-accuracy GPS satellite lock timed out; switching to standard browser/network location...'
              );
              attachWatcher(false);
              return;
            }

            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            setAwaitingFirstFix(false);
            setTrackingActive(false);
            setGpsStatusNote(null);
            setGpsErrorMsg(formatGeolocationError(err));
          },
          highAccuracy
            ? { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
            : { enableHighAccuracy: false, maximumAge: 5000, timeout: 20000 }
        );
      };

      attachWatcher(true);

      trackingContextRef.current.pushNotification(
        'tracking_started',
        'GPS Tracking Requested',
        `Requesting live browser GPS coordinates for session ${nextTrip}.`
      );
    },
    [
      publicProfile.trackingConsent,
      evaluateGeofencesForCoords,
      persistRealGpsCoordinate,
      formatGeolocationError,
    ]
  );

  // Request Single Live GPS Fix on user button click
  const requestSingleGpsLocation = useCallback(() => {
    if (!publicProfile.trackingConsent) {
      setGpsErrorMsg(
        'Explicit GPS Location Tracking Consent is disabled. Enable it in Profile Settings first.'
      );
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsPermissionState('unsupported');
      setGpsErrorMsg(
        'Geolocation is not supported by this browser. Please use a modern GPS-capable browser over HTTPS.'
      );
      return;
    }

    setGpsErrorMsg(null);
    setAwaitingFirstFix(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPermissionState('granted');
        setAwaitingFirstFix(false);
        const roundedAcc = Math.max(1, Math.round(pos.coords.accuracy));
        const next: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: roundedAcc,
          timestamp: pos.timestamp || Date.now(),
          source: 'gps',
        };
        setGpsPosition(next);
        evaluateGeofencesForCoords(next.latitude, next.longitude, next.accuracy);
      },
      (err) => {
        setAwaitingFirstFix(false);
        if (err.code === 1) {
          setGpsPermissionState('denied');
        }
        setGpsErrorMsg(formatGeolocationError(err));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [publicProfile.trackingConsent, evaluateGeofencesForCoords, formatGeolocationError]);

  // Watch external session by Session ID in Live Location Sharing module
  useEffect(() => {
    if (!watchedSessionInput.trim() || !fbUser) {
      setWatchedSessionData(null);
      return;
    }
    const cleanId = watchedSessionInput.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanId)) {
      setWatchedSessionError('Invalid session ID format.');
      return;
    }

    setWatchedSessionError(null);
    const unsub = onSnapshot(
      doc(db, 'trackingSessions', cleanId),
      (snap) => {
        if (!snap.exists()) {
          setWatchedSessionData(null);
          setWatchedSessionError('Session not found or expired.');
          return;
        }
        const raw = snap.data();
        setWatchedSessionData({
          id: snap.id,
          ownerId: raw.ownerId,
          ownerName: raw.ownerName,
          tripName: raw.tripName,
          latitude: raw.latitude,
          longitude: raw.longitude,
          accuracy: raw.accuracy,
          isActive: Boolean(raw.isActive) && raw.expiresAtMs > Date.now(),
          source: raw.source,
          authorizedEmails: raw.authorizedEmails ?? [],
          expiresAtMs: raw.expiresAtMs,
          updatedAtMs: raw.updatedAt?.toMillis?.() ?? Date.now(),
        });
      },
      () => {
        setWatchedSessionData(null);
        setWatchedSessionError(
          'Access denied or session unavailable. Only verified accounts listed in authorized emergency contact emails can view shared coordinates.'
        );
      }
    );

    return () => unsub();
  }, [watchedSessionInput, fbUser]);

  const handleSignOut = async () => {
    stopGpsTracking(true);
    setGpsPosition(null);
    setGeofenceAlert(null);
    await signOut(auth);
    setActiveNav('dashboard');
  };

  // Toggle helper for compact header/hero buttons
  const handleToggleTracking = () => {
    if (trackingActive) {
      stopGpsTracking(false);
    } else {
      startGpsTracking(false);
    }
  };

  // Handlers: Geofence CRUD & Quick Add from Kerala Destinations
  const createOrUpdateGeofence = async (
    name: string,
    lat: number,
    lng: number,
    radiusMeters: number,
    notifyContacts: boolean,
    existingId?: string | null
  ) => {
    const radius = Math.max(50, Math.min(50000, Math.round(radiusMeters) || 250));
    if (
      !name.trim() ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setGeoFormError(
        'Please select a valid location on the map (or click "Use Current GPS") and enter a radius between 50 m and 50,000 m.'
      );
      return false;
    }
    setGeoFormError(null);

    if (fbUser) {
      const targetId = existingId || generateSafeId('geo');
      try {
        if (existingId) {
          delete geofenceInsideMapRef.current[existingId];
          await updateDoc(doc(db, 'users', fbUser.uid, 'geofences', existingId), {
            name: clampString(name, 80),
            latitude: lat,
            longitude: lng,
            radiusMeters: radius,
            isActive: true,
            notifyContacts,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'users', fbUser.uid, 'geofences', targetId), {
            ownerId: fbUser.uid,
            name: clampString(name, 80),
            latitude: lat,
            longitude: lng,
            radiusMeters: radius,
            isActive: true,
            notifyContacts,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}/geofences/${targetId}`);
      }
    } else {
      if (existingId) {
        delete geofenceInsideMapRef.current[existingId];
        setGeofences((prev) =>
          prev.map((g) =>
            g.id === existingId
              ? {
                  ...g,
                  name: clampString(name, 80),
                  latitude: lat,
                  longitude: lng,
                  radiusMeters: radius,
                  notifyContacts,
                }
              : g
          )
        );
      } else {
        setGeofences((prev) => [
          {
            id: generateSafeId('local_geo'),
            ownerId: 'local_user',
            name: clampString(name, 80),
            latitude: lat,
            longitude: lng,
            radiusMeters: radius,
            isActive: true,
            notifyContacts,
          },
          ...prev,
        ]);
      }
    }
    return true;
  };

  const handleSaveGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoLat.trim() || !geoLng.trim()) {
      setGeoFormError(
        'Select a geofence centre by clicking on the map, clicking "Use Current GPS", or choosing a Kerala preset.'
      );
      return;
    }
    const lat = Number(geoLat);
    const lng = Number(geoLng);
    const radius = Number(geoRadius) || 250;
    const ok = await createOrUpdateGeofence(
      geoName,
      lat,
      lng,
      radius,
      geoNotifyContacts,
      editingGeoId
    );
    if (ok) {
      setEditingGeoId(null);
      setGeoName('Custom Safety Geofence');
    }
  };

  const handleAddDestinationGeofence = async (dest: DestinationGuideRecord) => {
    const radius = dest.defaultGeofenceRadiusM || 1500;
    await createOrUpdateGeofence(
      `${dest.name} Safe Zone`,
      dest.latitude,
      dest.longitude,
      radius,
      true,
      null
    );
    await pushNotification(
      'system',
      `Geofence Added: ${dest.name}`,
      `Created a ${radius}m circular boundary around ${dest.name} (${dest.district || 'Kerala'}).`
    );
    setGeoName(`${dest.name} Safe Zone`);
    setGeoLat(String(dest.latitude));
    setGeoLng(String(dest.longitude));
    setGeoRadius(String(radius));
    setActiveNav('geofencing');
  };

  const handleToggleGeofenceActive = async (zone: GeofenceZone) => {
    delete geofenceInsideMapRef.current[zone.id];
    if (fbUser) {
      try {
        await updateDoc(doc(db, 'users', fbUser.uid, 'geofences', zone.id), {
          isActive: !zone.isActive,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}/geofences/${zone.id}`);
      }
    } else {
      setGeofences((prev) =>
        prev.map((g) => (g.id === zone.id ? { ...g, isActive: !g.isActive } : g))
      );
    }
  };

  const handleDeleteGeofence = async (zoneId: string) => {
    delete geofenceInsideMapRef.current[zoneId];
    if (fbUser) {
      try {
        await deleteDoc(doc(db, 'users', fbUser.uid, 'geofences', zoneId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${fbUser.uid}/geofences/${zoneId}`);
      }
    } else {
      setGeofences((prev) => prev.filter((g) => g.id !== zoneId));
    }
  };

  // Handlers: Wireless Live Location Sharing Session (requires real GPS position)
  const handleCreateSharingSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) {
      openAuthPortal('signin');
      setAuthError('Register or sign in to start a cloud-synchronized live location sharing session.');
      return;
    }
    if (!publicProfile.sharingConsent) {
      setAuthError('Enable Live Location Sharing Consent in Profile Settings first.');
      return;
    }
    if (!gpsPosition) {
      setAuthError(
        'Start GPS Tracking and acquire your live GPS coordinates before broadcasting a live location sharing session.'
      );
      return;
    }

    const sessionId = generateSafeId('share');
    const expiresAtMs = Date.now() + Math.max(15, sessionDurationMin) * 60 * 1000;
    const emails = selectedContactEmails.filter(Boolean).slice(0, 10);

    try {
      await setDoc(doc(db, 'trackingSessions', sessionId), {
        ownerId: fbUser.uid,
        ownerName: clampString(publicProfile.displayName, 80),
        tripName: clampString(sessionTripName || 'Live Kerala Journey Session', 100),
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        accuracy: gpsPosition.accuracy,
        isActive: true,
        source: 'gps',
        authorizedEmails: emails,
        expiresAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pushNotification(
        'location_sharing',
        'Live Location Sharing Active',
        `Session ${sessionId} started for "${sessionTripName}" (${emails.length} authorized contact(s)).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `trackingSessions/${sessionId}`);
    }
  };

  const handleStopSharingSession = async (sessionId: string) => {
    if (!fbUser) return;
    try {
      await updateDoc(doc(db, 'trackingSessions', sessionId), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
      pushNotification(
        'location_sharing',
        'Location Sharing Revoked',
        `Session ${sessionId} has been securely stopped.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trackingSessions/${sessionId}`);
    }
  };

  // Handlers: Emergency SOS Alert (Module 11 — Uses real GPS only; never fakes SMS/cellular dispatch or fake coords)
  const handleConfirmSosAlert = async () => {
    setSosSubmitting(true);

    let liveAlertCoords: Coordinates | null = gpsPosition;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const freshPos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 3000,
          });
        });
        liveAlertCoords = {
          latitude: freshPos.coords.latitude,
          longitude: freshPos.coords.longitude,
          accuracy: Math.max(1, Math.round(freshPos.coords.accuracy)),
          timestamp: freshPos.timestamp || Date.now(),
          source: 'gps',
        };
        setGpsPermissionState('granted');
        setGpsPosition(liveAlertCoords);
      } catch {
        // Retain most recent real GPS fix if available
      }
    }

    if (!liveAlertCoords) {
      setSosSubmitting(false);
      setSosModalOpen(false);
      setActiveNav('emergency-sos');
      setAuthError(
        'Unable to attach live GPS coordinates because browser location access is off or denied. Use Direct Call 112 / 100 / 108 immediately, or enable browser location permission and retry.'
      );
      return;
    }

    const authorizedEmails = contacts
      .filter((c) => c.notifyOnSos && c.email)
      .map((c) => c.email)
      .slice(0, 10);

    if (fbUser && isOnline) {
      const eventId = generateSafeId('sos');
      try {
        const hasActiveShare = mySessions.some((s) => s.isActive);
        const deliveryState: EmergencyEventRecord['deliveryStatus'] = hasActiveShare
          ? 'shared_session_updated'
          : 'recorded_in_cloud';

        await setDoc(doc(db, 'emergencyEvents', eventId), {
          ownerId: fbUser.uid,
          ownerName: clampString(publicProfile.displayName, 80),
          ...(publicProfile.touristId
            ? { touristId: clampString(publicProfile.touristId, 32) }
            : {}),
          alertType: sosAlertType,
          latitude: liveAlertCoords.latitude,
          longitude: liveAlertCoords.longitude,
          accuracy: liveAlertCoords.accuracy,
          notes: clampString(
            sosNotes || 'Emergency assistance requested via TourSafe 360 Kerala SOS.',
            400
          ),
          deliveryStatus: deliveryState,
          status: 'active',
          authorizedEmails,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await pushNotification(
          'emergency_sos',
          `Emergency Alert Recorded (${sosAlertType.replace(/_/g, ' ').toUpperCase()})`,
          `Confirmed written to Firestore (${deliveryState.replace(/_/g, ' ')}). Use direct dial 112 / 100 / 108 below for immediate voice emergency dispatch.`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'emergencyEvents');
      }
    } else {
      const localEv: EmergencyEventRecord = {
        id: generateSafeId('local_sos'),
        ownerId: 'local_user',
        ownerName: publicProfile.displayName,
        touristId: publicProfile.touristId,
        alertType: sosAlertType,
        latitude: liveAlertCoords.latitude,
        longitude: liveAlertCoords.longitude,
        accuracy: liveAlertCoords.accuracy,
        notes: sosNotes || 'Local SOS Alert (Sign in for cloud persistence).',
        deliveryStatus: 'recorded_in_cloud',
        status: 'active',
        authorizedEmails,
        createdAtMs: Date.now(),
      };
      setEmergencyEvents((prev) => [localEv, ...prev]);
      await pushNotification(
        'emergency_sos',
        'SOS Event Logged Locally',
        'You are signed out or offline. No external emergency dispatch was transmitted—use Direct Call 112 / 100 / 108 for real emergencies.'
      );
    }

    setSosSubmitting(false);
    setSosModalOpen(false);
    setSosNotes('');
    setActiveNav('emergency-sos');
  };

  // Handlers: Emergency Contacts
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;

    if (fbUser) {
      const cId = generateSafeId('cnt');
      try {
        await setDoc(doc(db, 'users', fbUser.uid, 'contacts', cId), {
          ownerId: fbUser.uid,
          name: clampString(contactName, 80),
          phone: clampString(contactPhone, 30),
          email: clampString(contactEmail, 160),
          relationship: clampString(contactRelation || 'Trusted Contact', 40),
          notifyOnSos: contactNotifySos,
          notifyOnGeofence: contactNotifyGeo,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}/contacts/${cId}`);
      }
    } else {
      setContacts((prev) => [
        ...prev,
        {
          id: generateSafeId('demo_cnt'),
          ownerId: 'demo_user',
          name: clampString(contactName, 80),
          phone: clampString(contactPhone, 30),
          email: clampString(contactEmail, 160),
          relationship: clampString(contactRelation || 'Trusted Contact', 40),
          notifyOnSos: contactNotifySos,
          notifyOnGeofence: contactNotifyGeo,
        },
      ]);
    }

    setContactName('');
    setContactPhone('');
    setContactEmail('');
  };

  const handleDeleteContact = async (contactId: string) => {
    if (fbUser) {
      try {
        await deleteDoc(doc(db, 'users', fbUser.uid, 'contacts', contactId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${fbUser.uid}/contacts/${contactId}`);
      }
    } else {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    }
  };

  // Handlers: Profile & Privacy Consent Updates (Preserving immutable Tourist ID)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;

    const cleanName = clampString(publicProfile.displayName || 'Tourist', 80);
    const cleanNationality = clampString(publicProfile.nationality || 'Indian', 60);
    const cleanPhoto = clampString(publicProfile.photoUrl || '', 2048);

    try {
      await updateDoc(doc(db, 'users', fbUser.uid), {
        displayName: cleanName,
        nationality: cleanNationality,
        photoUrl: cleanPhoto,
        trackingConsent: publicProfile.trackingConsent,
        sharingConsent: publicProfile.sharingConsent,
        trackingIntervalSec: Math.max(
          5,
          Math.min(300, Number(publicProfile.trackingIntervalSec) || 10)
        ),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', fbUser.uid, 'private', 'info'), {
        email: clampString(privateInfo.email || fbUser.email || '', 160),
        phone: clampString(privateInfo.phone || '', 30),
        dob: clampString(privateInfo.dob || '', 20),
        stateRegion: clampString(privateInfo.stateRegion || '', 60),
        country: clampString(privateInfo.country || '', 60),
        personalInfoConsent: Boolean(privateInfo.personalInfoConsent ?? true),
        travelStyle: clampString(privateInfo.travelStyle || 'family', 40),
        budgetTier: clampString(privateInfo.budgetTier || 'moderate', 30),
        updatedAt: serverTimestamp(),
      });

      if (publicProfile.verificationToken) {
        await updateDoc(doc(db, 'touristVerifications', publicProfile.verificationToken), {
          displayName: cleanName,
          nationality: cleanNationality,
          photoUrl: cleanPhoto,
          emailVerified: Boolean(fbUser.emailVerified),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      pushNotification(
        'system',
        'Profile & Consent Preferences Saved',
        'Your Kerala Tourist Profile and privacy consent settings have been updated.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
    }
  };

  // Handlers: Location History Deletion
  const handleClearLocationHistory = async () => {
    if (fbUser) {
      try {
        await Promise.all(
          locationLogs.map((entry) =>
            deleteDoc(doc(db, 'users', fbUser.uid, 'locationLogs', entry.id))
          )
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${fbUser.uid}/locationLogs`);
      }
    } else {
      setLocationLogs([]);
    }
    setConfirmClearHistoryOpen(false);
  };

  // Handlers: Submit Safety Report
  const handleSubmitSafetyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) return;
    if (!fbUser) {
      setReportSubmittedMsg(
        'Register or sign in to submit an official safety feedback report to administrators.'
      );
      return;
    }

    const repId = generateSafeId('rep');
    try {
      await setDoc(doc(db, 'reports', repId), {
        reporterId: fbUser.uid,
        reporterName: clampString(publicProfile.displayName, 80),
        category: clampString(reportCategory, 40),
        description: clampString(reportDesc, 600),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReportDesc('');
      setReportSubmittedMsg('Safety report submitted for administrator review.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${repId}`);
    }
  };

  // Real-time Haversine Geofence Evaluation for UI Display
  const geofenceEvaluations = useMemo(() => {
    return geofences.map((g) => {
      const distanceMeters = gpsPosition
        ? calculateHaversineMeters(
            gpsPosition.latitude,
            gpsPosition.longitude,
            g.latitude,
            g.longitude
          )
        : null;
      const isInside = distanceMeters !== null ? distanceMeters <= g.radiusMeters : null;
      return {
        zone: g,
        distanceMeters,
        isInside,
      };
    });
  }, [geofences, gpsPosition]);

  // Derived Map Overlay Shapes
  const mapCircles: MapCircleItem[] = useMemo(
    () =>
      geofenceEvaluations.map(({ zone, isInside }) => ({
        id: zone.id,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radiusMeters: zone.radiusMeters,
        isActive: zone.isActive,
        label: zone.name,
        status: !zone.isActive || isInside === null ? undefined : isInside ? 'inside' : 'outside',
      })),
    [geofenceEvaluations]
  );

  // Include live draft geofence preview circle on the Geofencing screen
  const geofencingMapCircles: MapCircleItem[] = useMemo(() => {
    const parsedLat = Number(geoLat);
    const parsedLng = Number(geoLng);
    const parsedRad = Math.max(50, Math.min(50000, Math.round(Number(geoRadius)) || 250));
    const hasValidDraft =
      geoLat.trim() !== '' &&
      geoLng.trim() !== '' &&
      !Number.isNaN(parsedLat) &&
      !Number.isNaN(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180;

    if (!hasValidDraft) return mapCircles;

    return [
      ...mapCircles,
      {
        id: 'draft_preview_circle',
        latitude: parsedLat,
        longitude: parsedLng,
        radiusMeters: parsedRad,
        isActive: true,
        label: `${geoName || 'New Geofence'} (${parsedRad}m)`,
        status: 'draft',
      },
    ];
  }, [mapCircles, geoLat, geoLng, geoRadius, geoName]);

  const dashboardMarkers: MapMarkerItem[] = useMemo(() => {
    const list: MapMarkerItem[] = [
      ...(gpsPosition
        ? [
            {
              id: 'self_pos',
              latitude: gpsPosition.latitude,
              longitude: gpsPosition.longitude,
              title: `${publicProfile.displayName} (Live Browser GPS)`,
              subtitle: `Accuracy ±${gpsPosition.accuracy} m`,
              kind: 'tourist' as const,
            },
          ]
        : []),
      ...destinations.slice(0, 20).map((d) => ({
        id: `dest_${d.id}`,
        latitude: d.latitude,
        longitude: d.longitude,
        title: d.name,
        subtitle: `${d.district || d.region} · Helpline ${d.emergencyNumber}`,
        kind: 'destination' as const,
      })),
      ...sharedWithMeSessions
        .filter((s) => s.isActive)
        .map((s) => ({
          id: `shared_${s.id}`,
          latitude: s.latitude,
          longitude: s.longitude,
          title: `${s.ownerName} (${s.tripName})`,
          subtitle: 'Live Shared Contact',
          kind: 'contact' as const,
        })),
    ];
    return list;
  }, [gpsPosition, publicProfile.displayName, destinations, sharedWithMeSessions]);

  const historyPolyline = useMemo(
    () =>
      [...locationLogs]
        .reverse()
        .map((l) => ({ lat: l.latitude, lng: l.longitude })),
    [locationLogs]
  );

  const activeGeofenceEvals = useMemo(
    () => geofenceEvaluations.filter((item) => item.zone.isActive),
    [geofenceEvaluations]
  );
  const activeGeofencesCount = activeGeofenceEvals.length;
  const insideAnyGeofence =
    gpsPosition !== null && activeGeofenceEvals.some((item) => item.isInside === true);

  const nearestActiveGeofenceEval = useMemo(() => {
    const withDist = activeGeofenceEvals.filter((item) => item.distanceMeters !== null);
    if (withDist.length === 0) return null;
    return withDist.reduce((best, cur) =>
      (cur.distanceMeters as number) < (best.distanceMeters as number) ? cur : best
    );
  }, [activeGeofenceEvals]);

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const activeShareCount = mySessions.filter((s) => s.isActive).length;

  const navItems: { id: NavSection; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: t.nav['dashboard'], icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'tourist-id', label: t.nav['tourist-id'], icon: <IdCard className="w-4 h-4 shrink-0" /> },
    { id: 'gps-tracking', label: t.nav['gps-tracking'], icon: <Navigation className="w-4 h-4 shrink-0" /> },
    { id: 'live-sharing', label: t.nav['live-sharing'], icon: <Radio className="w-4 h-4 shrink-0" /> },
    { id: 'geofencing', label: t.nav['geofencing'], icon: <Shield className="w-4 h-4 shrink-0" /> },
    { id: 'ai-recommendations', label: t.nav['ai-recommendations'], icon: <Sparkles className="w-4 h-4 shrink-0" /> },
    { id: 'kerala-destinations', label: t.nav['kerala-destinations'], icon: <Compass className="w-4 h-4 shrink-0" /> },
    { id: 'nearby-emergency', label: t.nav['nearby-emergency'], icon: <Phone className="w-4 h-4 shrink-0" /> },
    { id: 'emergency-sos', label: t.nav['emergency-sos'], icon: <AlertOctagon className="w-4 h-4 shrink-0" /> },
    { id: 'weather-alerts', label: t.nav['weather-alerts'], icon: <CloudSun className="w-4 h-4 shrink-0" /> },
    { id: 'location-history', label: t.nav['location-history'], icon: <History className="w-4 h-4 shrink-0" /> },
    {
      id: 'notifications',
      label:
        unreadNotifCount > 0
          ? `${t.nav['notifications']} (${unreadNotifCount})`
          : t.nav['notifications'],
      icon: <Bell className="w-4 h-4 shrink-0" />,
    },
    { id: 'profile', label: t.nav['profile'], icon: <UserCheck className="w-4 h-4 shrink-0" /> },
    ...(isAdmin
      ? [
          {
            id: 'admin-panel' as NavSection,
            label: t.nav['admin-panel'],
            icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
            adminOnly: true,
          },
        ]
      : []),
  ];

  const lastUpdatedFormatted = gpsPosition ? formatIstTime(gpsPosition.timestamp) : 'Not tracked yet';

  const contentTree = (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Desktop Sidebar Navigation — Deep Kerala Forest Emerald */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-emerald-950 text-emerald-50 border-r border-emerald-900 z-30">
        <div className="px-5 py-4 border-b border-emerald-900 space-y-3">
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className="text-left block"
          >
            <span className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap">
              TourSafe <span className="text-amber-400">360</span>
            </span>
            <span className="block text-[11px] text-emerald-300 mt-0.5">
              Kerala Smart Tourism Safety
            </span>
          </button>

          {/* Multilingual Language Selector (Module 15) */}
          <div className="flex items-center gap-1 p-1 bg-emerald-900/70 rounded-lg">
            {(
              [
                { code: 'en', label: 'English' },
                { code: 'ml', label: 'മലയാളം' },
                { code: 'hi', label: 'हिन्दी' },
              ] as { code: AppLanguage; label: string }[]
            ).map((langOpt) => (
              <button
                key={langOpt.code}
                type="button"
                onClick={() => setLanguage(langOpt.code)}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  language === langOpt.code
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                {langOpt.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : item.id === 'emergency-sos'
                    ? 'text-red-300 hover:bg-red-950/60 hover:text-red-200'
                    : 'text-emerald-100/90 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900 space-y-3">
          <div className="text-xs text-emerald-200 space-y-1">
            <p className="font-semibold text-white truncate">{publicProfile.displayName}</p>
            {publicProfile.touristId && (
              <button
                type="button"
                onClick={() => setActiveNav('tourist-id')}
                className="font-mono-tabular text-[11px] text-amber-300 hover:underline block truncate"
              >
                {publicProfile.touristId}
              </button>
            )}
            <p className="flex items-center gap-1.5 text-[11px]">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Internet Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-300">Offline</span>
                </>
              )}
            </p>
          </div>

          {fbUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-xs font-medium text-emerald-100 bg-emerald-900 rounded-lg hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.signOut}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthPortal('register')}
              className="w-full px-3 py-2 text-xs font-semibold text-emerald-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t.signInRegister}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-0">
        {/* Strict 3-Zone Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className="text-base font-bold tracking-tight text-emerald-950 font-display whitespace-nowrap shrink-0"
          >
            TourSafe 360
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              className={`hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 ${
                activeNav === 'dashboard' ? 'text-emerald-900 underline underline-offset-4' : ''
              }`}
            >
              {t.nav['dashboard']}
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('tourist-id')}
              className={`hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 ${
                activeNav === 'tourist-id' ? 'text-emerald-900 underline underline-offset-4' : ''
              }`}
            >
              {t.nav['tourist-id']}
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('kerala-destinations')}
              className={`hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 ${
                activeNav === 'kerala-destinations'
                  ? 'text-emerald-900 underline underline-offset-4'
                  : ''
              }`}
            >
              Kerala Map
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('ai-recommendations')}
              className={`hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 ${
                activeNav === 'ai-recommendations'
                  ? 'text-emerald-900 underline underline-offset-4'
                  : ''
              }`}
            >
              AI Planner
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('weather-alerts')}
              className={`hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 ${
                activeNav === 'weather-alerts'
                  ? 'text-emerald-900 underline underline-offset-4'
                  : ''
              }`}
            >
              Weather
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setSosModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              {t.emergencySos}
            </button>
          </div>
        </header>

        {/* Mobile Quick Module & Language Switcher Strip */}
        <div className="lg:hidden bg-emerald-950 text-emerald-100 px-4 py-2 border-b border-emerald-900 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            {(['en', 'ml', 'hi'] as AppLanguage[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`px-2 py-0.5 text-[11px] rounded font-medium whitespace-nowrap ${
                  language === code ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200'
                }`}
              >
                {code === 'en' ? 'EN' : code === 'ml' ? 'മലയാളം' : 'हिन्दी'}
              </button>
            ))}
          </div>
          <select
            aria-label="Select navigation module"
            value={activeNav}
            onChange={(e) => setActiveNav(e.target.value as NavSection)}
            className="px-2.5 py-1 text-xs rounded-md bg-emerald-900 text-white border border-emerald-700"
          >
            {navItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.label}
              </option>
            ))}
          </select>
        </div>

        {/* Shared QR Verification Deep-Link Notice */}
        {initialVerifyToken && (
          <div className="bg-emerald-900 text-emerald-50 px-4 sm:px-8 py-2 text-xs flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <QrCode className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                Inspecting shared Kerala Digital Tourist ID verification token:{' '}
                <strong className="font-mono-tabular text-white">{initialVerifyToken}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setInitialVerifyToken(null);
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, '', window.location.pathname);
                }
              }}
              className="text-amber-300 hover:underline whitespace-nowrap shrink-0"
            >
              Clear Link
            </button>
          </div>
        )}

        {/* Privacy & Account Context Strip */}
        {(!fbUser || !trackingActive || !isOnline) && (
          <div className="bg-slate-900 text-slate-200 px-4 sm:px-8 py-2 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!isOnline && <span className="text-red-400 font-semibold">Offline Mode ·</span>}
              {!fbUser && (
                <span>
                  Register or sign in to issue your permanent{' '}
                  <span className="font-mono-tabular text-amber-300">TS360-KL-2026-XXXXXX</span>{' '}
                  Digital Tourist ID and sync private safety records.
                </span>
              )}
              {fbUser && !trackingActive && !gpsPosition && (
                <span>
                  GPS Privacy Protection: Location tracking is currently{' '}
                  <strong className="text-amber-300">off</strong> until you click Start Tracking.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!trackingActive && (
                <button
                  type="button"
                  onClick={() => startGpsTracking(true)}
                  className="text-amber-300 hover:text-amber-200 font-medium underline whitespace-nowrap"
                >
                  Start GPS Tracking
                </button>
              )}
              {!fbUser && (
                <button
                  type="button"
                  onClick={() => openAuthPortal('register')}
                  className="text-white hover:text-amber-300 font-medium underline whitespace-nowrap"
                >
                  {t.signInRegister}
                </button>
              )}
            </div>
          </div>
        )}

        {authError && (
          <div className="mx-4 sm:mx-8 mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between gap-3">
            <span>{authError}</span>
            <button type="button" onClick={() => setAuthError(null)} aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Prominent Real-Time Geofence Entry / Exit Transition Alert */}
        {geofenceAlert && (
          <div
            role="alert"
            className={`mx-4 sm:mx-8 mt-4 rounded-xl border px-4 py-3.5 flex items-start justify-between gap-3 shadow-xs ${
              geofenceAlert.transition === 'ENTERED'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              {geofenceAlert.transition === 'ENTERED' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  Geofence {geofenceAlert.transition === 'ENTERED' ? 'Entry' : 'Exit'} Alert:{' '}
                  {geofenceAlert.zoneName}
                </p>
                <p>
                  Status:{' '}
                  <strong>
                    {geofenceAlert.transition === 'ENTERED' ? 'INSIDE' : 'OUTSIDE'} Geofence
                  </strong>{' '}
                  · Distance from centre:{' '}
                  <strong className="font-mono-tabular">{geofenceAlert.distanceMeters} m</strong>{' '}
                  (Radius: {geofenceAlert.radiusMeters} m) ·{' '}
                  {formatIstTime(geofenceAlert.timestamp)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGeofenceAlert(null)}
              className="text-slate-500 hover:text-slate-900 shrink-0"
              aria-label="Dismiss geofence alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Workspace Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto space-y-8">
          {/* ==================== MODULE 1, 3, 4 & 5: KERALA MAIN DASHBOARD ==================== */}
          {activeNav === 'dashboard' && (
            <div className="space-y-8">
              {/* Hero Welcome + Kerala Backwaters Visual */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-7 bg-emerald-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div className="space-y-3">
                    <p className="text-xs text-amber-300 font-medium">{t.appSubtitle}</p>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                      {t.welcomePrefix} {publicProfile.displayName}
                    </h1>
                    <p className="text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                      Explore all 14 districts of Kerala with automatic Tourist ID verification,
                      real-time GPS tracking, circular safe-zone geofences, IMD/KSDMA weather
                      preparedness, and Gemini AI journey planning in INR.
                    </p>

                    {/* Permanent Unique Tourist ID Summary Strip */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-800/80 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-emerald-300">{t.touristIdLabel}</span>
                        <p className="font-mono-tabular text-sm font-bold text-amber-300">
                          {fbUser && publicProfile.touristId
                            ? publicProfile.touristId
                            : 'Not Yet Issued (Register to Generate Permanent ID)'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          fbUser ? setActiveNav('tourist-id') : openAuthPortal('register')
                        }
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-800 text-white hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <IdCard className="w-3.5 h-3.5 text-amber-300" />
                        {fbUser ? t.viewDigitalId : t.signInRegister}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {!trackingActive ? (
                      <button
                        type="button"
                        onClick={() => startGpsTracking(false)}
                        className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-amber-400 text-emerald-950 hover:bg-amber-300 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {t.startTracking}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => stopGpsTracking(false)}
                        className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Square className="w-3.5 h-3.5" />
                        {t.stopTracking}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveNav('gps-tracking')}
                      className="px-4 py-2.5 rounded-lg text-xs font-medium bg-emerald-900 text-emerald-50 hover:bg-emerald-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <LocateFixed className="w-3.5 h-3.5 text-amber-300" />
                      Open GPS Console
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveNav('geofencing')}
                      className="px-4 py-2.5 rounded-lg text-xs font-medium bg-emerald-900/70 border border-emerald-700 text-emerald-100 hover:bg-emerald-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-300" />
                      Geofencing
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 relative rounded-2xl overflow-hidden min-h-[240px] bg-emerald-950">
                  <img
                    src={KERALA_HERO_IMAGE}
                    alt="Serene Kerala backwaters in Alappuzha with palm-fringed canals at golden hour"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/45 to-transparent p-6 flex flex-col justify-end">
                    <p className="text-xs text-emerald-200">Live Browser GPS Telemetry</p>
                    {awaitingFirstFix ? (
                      <p className="text-sm font-semibold text-amber-300 inline-flex items-center gap-2 mt-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for first GPS position...
                      </p>
                    ) : gpsPosition ? (
                      <>
                        <p className="text-base font-semibold text-white font-mono-tabular mt-0.5">
                          {formatCoord(gpsPosition.latitude, 6)},{' '}
                          {formatCoord(gpsPosition.longitude, 6)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100 mt-1">
                          <span>Live GPS</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">±{gpsPosition.accuracy} m</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{lastUpdatedFormatted}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-emerald-100 mt-1">
                        GPS Tracking Inactive — Click Start GPS Tracking to capture live coordinates
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {gpsErrorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{gpsErrorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGpsErrorMsg(null)}
                    className="text-red-700 hover:text-red-950"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 4-Column Status Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{t.currentCoords}</p>
                  <p className="text-base font-bold font-mono-tabular text-slate-900 mt-1.5">
                    {gpsPosition
                      ? `${formatCoord(gpsPosition.latitude, 5)}, ${formatCoord(gpsPosition.longitude, 5)}`
                      : awaitingFirstFix
                      ? 'Acquiring GPS...'
                      : 'Not Tracking'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {gpsPosition
                      ? `Accuracy ±${gpsPosition.accuracy} m · ${lastUpdatedFormatted}`
                      : 'Click Start GPS Tracking'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{t.trackingStatus}</p>
                  <p
                    className={`text-base font-bold mt-1.5 ${
                      trackingActive ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {trackingActive
                      ? awaitingFirstFix
                        ? 'Waiting for GPS Fix...'
                        : t.activeLabel
                      : t.inactiveLabel}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                    Permission: {gpsPermissionState} · Every {publicProfile.trackingIntervalSec}s
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{t.geofenceStatus}</p>
                  <p
                    className={`text-base font-bold mt-1.5 ${
                      activeGeofencesCount === 0 || !gpsPosition
                        ? 'text-slate-700'
                        : insideAnyGeofence
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {activeGeofencesCount === 0
                      ? t.noActiveZones
                      : !gpsPosition
                      ? 'Waiting for GPS'
                      : insideAnyGeofence
                      ? 'INSIDE Geofence'
                      : 'OUTSIDE Geofence'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                    {nearestActiveGeofenceEval && nearestActiveGeofenceEval.distanceMeters !== null
                      ? `${Math.round(nearestActiveGeofenceEval.distanceMeters)} m from ${nearestActiveGeofenceEval.zone.name}`
                      : `${activeGeofencesCount} active zone(s) configured`}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{t.wirelessSharing}</p>
                  <p
                    className={`text-base font-bold mt-1.5 ${
                      activeShareCount > 0 ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {activeShareCount > 0 ? `${activeShareCount} Live Session(s)` : t.inactiveLabel}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {contacts.length} trusted contact(s) configured
                  </p>
                </div>
              </div>

              {/* Interactive Kerala Tracking & Geofence Map */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Kerala Live Location, Geofences & Attractions Map
                    </h2>
                    <p className="text-xs text-slate-500">
                      Jump to any Kerala attraction, inspect circular safety zones, or view your
                      live movement trail.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveNav('weather-alerts')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      District Weather
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNav('ai-recommendations')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
                    >
                      Plan Kerala Trip (INR)
                    </button>
                  </div>
                </div>

                <TourSafeMap
                  center={
                    gpsPosition
                      ? { lat: gpsPosition.latitude, lng: gpsPosition.longitude }
                      : keralaMapOverviewCenter
                  }
                  zoom={gpsPosition ? 13 : 8}
                  markers={dashboardMarkers}
                  circles={mapCircles}
                  polylinePath={historyPolyline}
                  showKeralaJumpSelector={true}
                  hasMapsApiKey={HAS_MAPS_KEY}
                  hasLiveGps={Boolean(gpsPosition)}
                  lastUpdatedLabel={gpsPosition ? lastUpdatedFormatted : undefined}
                  sharingActive={activeShareCount > 0}
                  heightClass="h-[440px]"
                />
              </div>

              {/* Featured Kerala Destinations + Recent Safety Notifications */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Featured Kerala Destinations & Safety Guidance
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveNav('kerala-destinations')}
                      className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
                    >
                      Explore All {destinations.length} Places
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {destinations.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        className="border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between"
                      >
                        {d.imageUrl && (
                          <div className="h-32 bg-slate-200 overflow-hidden">
                            <img
                              src={d.imageUrl}
                              alt={d.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                            <p className="text-xs text-slate-500">
                              {d.district || d.region} · {d.category}
                              {d.typicalBudgetInr ? ` · ${formatInr(d.typicalBudgetInr)}/day` : ''}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed pt-1">
                              {d.safetyNotes}
                            </p>
                          </div>
                          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono-tabular">
                              {formatCoord(d.latitude, 4)}, {formatCoord(d.longitude, 4)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddDestinationGeofence(d)}
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              + Safe Zone
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Safety Notifications & IST History */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{t.nav['notifications']}</h3>
                    <button
                      type="button"
                      onClick={() => setActiveNav('notifications')}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      View All
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      No recent alerts. Start GPS tracking or test Kerala geofence boundaries to
                      receive live safety notifications.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifications.slice(0, 4).map((n) => (
                        <div key={n.id} className="py-2.5 space-y-0.5">
                          <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                          <p className="text-xs text-slate-600">{n.message}</p>
                          <p className="text-[11px] text-slate-400 font-mono-tabular">
                            {formatIstTime(n.createdAtMs)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Recent Coordinates (IST)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveNav('location-history')}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        History ({locationLogs.length})
                      </button>
                    </div>
                    {locationLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between text-xs font-mono-tabular text-slate-600"
                      >
                        <span>
                          {formatCoord(log.latitude, 4)}, {formatCoord(log.longitude, 4)}
                        </span>
                        <span className="text-slate-400">{formatIstTime(log.createdAtMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MODULE 3 & 4: DIGITAL TOURIST ID CARD & QR VERIFICATION ==================== */}
          {activeNav === 'tourist-id' && (
            <DigitalTouristIdView
              fbUser={fbUser}
              publicProfile={publicProfile}
              language={language}
              onOpenAuthModal={() => openAuthPortal('register')}
              initialVerifyToken={initialVerifyToken}
            />
          )}

          {/* ==================== MODULE 1 & 9: KERALA 14 DISTRICTS & DESTINATIONS ==================== */}
          {activeNav === 'kerala-destinations' && (
            <KeralaDestinationsView
              currentCoords={gpsPosition}
              destinations={destinations}
              geofences={mapCircles}
              hasMapsApiKey={HAS_MAPS_KEY}
              onAddDestinationGeofence={handleAddDestinationGeofence}
              onOpenDistrictWeather={(districtName) => {
                setWeatherFocusDistrict(districtName);
                setActiveNav('weather-alerts');
              }}
              onRequestStartTracking={() => startGpsTracking(true)}
            />
          )}

          {/* ==================== MODULE 12: KERALA WEATHER & SAFETY ALERTS ==================== */}
          {activeNav === 'weather-alerts' && (
            <WeatherSafetyAlertsView
              currentCoords={gpsPosition}
              initialDistrict={weatherFocusDistrict}
              onRequestStartTracking={() => startGpsTracking(true)}
            />
          )}

          {/* ==================== MODULE 6: GPS LOCATION TRACKING ==================== */}
          {activeNav === 'gps-tracking' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">GPS Location Tracking</h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Real-time browser Geolocation API (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">navigator.geolocation.watchPosition</code>) coordinate capture in Indian Standard Time (IST).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={trackingActive}
                    onClick={() => startGpsTracking(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Tracking
                  </button>

                  <button
                    type="button"
                    disabled={!trackingActive}
                    onClick={() => stopGpsTracking(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop Tracking
                  </button>

                  <button
                    type="button"
                    onClick={requestSingleGpsLocation}
                    className="px-3.5 py-2.5 text-xs font-medium bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
                    Refresh Single Fix
                  </button>
                </div>
              </div>

              {/* Loading Indicator while waiting for first GPS position */}
              {awaitingFirstFix && (
                <div
                  role="status"
                  className="bg-sky-50 border border-sky-200 text-sky-950 rounded-xl p-4 flex items-center gap-3 text-xs"
                >
                  <Loader2 className="w-5 h-5 text-sky-700 animate-spin shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">
                      Waiting for first live GPS position...
                    </p>
                    <p className="text-sky-800">
                      {gpsStatusNote ||
                        'Please click "Allow" if your browser prompts for location permission. Acquiring coordinates from your device GPS / network sensors.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Clear GPS & Permission Error Messages */}
              {gpsErrorMsg && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-950 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-red-900">
                        GPS Location Error ({gpsPermissionState === 'denied' ? 'Permission Denied' : gpsPermissionState === 'unsupported' ? 'Unsupported Browser' : 'Signal / Timeout'})
                      </p>
                      <p className="text-red-800 leading-relaxed">{gpsErrorMsg}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startGpsTracking(false)}
                    className="px-3.5 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap shrink-0"
                  >
                    Retry Start Tracking
                  </button>
                </div>
              )}

              {gpsStatusNote && !awaitingFirstFix && !gpsErrorMsg && (
                <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-3.5 text-xs">
                  {gpsStatusNote}
                </div>
              )}

              {/* Responsive 5-Card Live GPS & Geofence Readout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Latitude</p>
                  <p className="text-xl sm:text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {gpsPosition
                      ? formatCoord(gpsPosition.latitude, 6)
                      : awaitingFirstFix
                      ? 'Loading...'
                      : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gpsPosition ? 'Decimal degrees (WGS84)' : 'Start tracking to capture'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Longitude</p>
                  <p className="text-xl sm:text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {gpsPosition
                      ? formatCoord(gpsPosition.longitude, 6)
                      : awaitingFirstFix
                      ? 'Loading...'
                      : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gpsPosition ? 'Decimal degrees (WGS84)' : 'Start tracking to capture'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">GPS Accuracy & Time</p>
                  <p className="text-xl sm:text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {gpsPosition ? `±${gpsPosition.accuracy} metres` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
                    Last Updated: {lastUpdatedFormatted}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Tracking Status</p>
                  <p
                    className={`text-xl sm:text-2xl font-bold mt-1 ${
                      trackingActive ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {trackingActive
                      ? awaitingFirstFix
                        ? 'Acquiring...'
                        : 'Active'
                      : 'Stopped'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Permission: <strong className="capitalize">{gpsPermissionState}</strong>
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500">Geofence Status</p>
                    <button
                      type="button"
                      onClick={() => setActiveNav('geofencing')}
                      className="text-[11px] font-medium text-emerald-700 hover:underline"
                    >
                      Configure
                    </button>
                  </div>
                  <p
                    className={`text-xl sm:text-2xl font-bold mt-1 ${
                      activeGeofencesCount === 0 || !gpsPosition
                        ? 'text-slate-700'
                        : insideAnyGeofence
                        ? 'text-emerald-700'
                        : 'text-orange-600'
                    }`}
                  >
                    {activeGeofencesCount === 0
                      ? 'No Geofence'
                      : !gpsPosition
                      ? 'Waiting GPS'
                      : insideAnyGeofence
                      ? 'INSIDE'
                      : 'OUTSIDE'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono-tabular truncate">
                    {nearestActiveGeofenceEval && nearestActiveGeofenceEval.distanceMeters !== null
                      ? `${Math.round(nearestActiveGeofenceEval.distanceMeters)} m from ${nearestActiveGeofenceEval.zone.name}`
                      : activeGeofencesCount > 0
                      ? `${activeGeofencesCount} active zone(s)`
                      : 'Create a zone in Geofencing'}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="text-xs font-medium text-slate-700">
                    History Logging Interval:
                    <select
                      value={publicProfile.trackingIntervalSec}
                      onChange={(e) => {
                        const sec = Number(e.target.value);
                        setPublicProfile((p) => ({ ...p, trackingIntervalSec: sec }));
                        if (fbUser) {
                          updateDoc(doc(db, 'users', fbUser.uid), {
                            trackingIntervalSec: sec,
                            updatedAt: serverTimestamp(),
                          }).catch(() => {});
                        }
                      }}
                      className="ml-2 px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg bg-white"
                    >
                      <option value={5}>Every 5 seconds</option>
                      <option value={10}>Every 10 seconds</option>
                      <option value={30}>Every 30 seconds</option>
                      <option value={60}>Every 60 seconds</option>
                    </select>
                  </label>

                  <span className="text-xs text-slate-500">
                    Privacy: Live coordinates are tracked strictly while active and are never publicly exposed.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveNav('geofencing')}
                  className="px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap self-start md:self-auto"
                >
                  Open Geofencing ({geofences.length})
                </button>
              </div>

              <TourSafeMap
                center={
                  gpsPosition
                    ? { lat: gpsPosition.latitude, lng: gpsPosition.longitude }
                    : keralaMapOverviewCenter
                }
                zoom={gpsPosition ? 16 : 8}
                markers={dashboardMarkers}
                circles={mapCircles}
                polylinePath={historyPolyline}
                showKeralaJumpSelector={true}
                hasMapsApiKey={HAS_MAPS_KEY}
                hasLiveGps={Boolean(gpsPosition)}
                lastUpdatedLabel={gpsPosition ? lastUpdatedFormatted : undefined}
                sharingActive={activeShareCount > 0}
                heightClass="h-[440px]"
              />
            </div>
          )}

          {/* ==================== MODULE 7: WIRELESS / INTERNET LIVE LOCATION SHARING ==================== */}
          {activeNav === 'live-sharing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Live Location Sharing (Internet Real-Time Cloud Sync)
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  HTML5 Geolocation captures coordinates on your device while Firebase Firestore
                  transmits real-time updates over Wi-Fi or mobile internet to authorized contacts
                  (this web application does not use offline Bluetooth or Wi-Fi Direct peer-to-peer
                  radio).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleCreateSharingSession}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Broadcast New Live Tracking Session
                    </h3>
                    <span className="text-xs text-slate-500">
                      {isOnline ? 'Connection: Online' : 'Connection: Offline'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kerala Journey / Trip Label
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={sessionTripName}
                      onChange={(e) => setSessionTripName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Automatic Expiration Window
                    </label>
                    <select
                      value={sessionDurationMin}
                      onChange={(e) => setSessionDurationMin(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour</option>
                      <option value={120}>2 Hours</option>
                      <option value={360}>6 Hours</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Authorize Trusted Contacts (Verified Email Access Control)
                    </label>
                    {contacts.filter((c) => c.email).length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Add emergency contacts with email addresses in Profile to grant live viewer
                        access.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-3">
                        {contacts
                          .filter((c) => c.email)
                          .map((c) => {
                            const checked = selectedContactEmails.includes(c.email);
                            return (
                              <label
                                key={c.id}
                                className="flex items-center justify-between text-xs text-slate-700 cursor-pointer"
                              >
                                <span>
                                  {c.name} ({c.email})
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedContactEmails((prev) => [...prev, c.email]);
                                    } else {
                                      setSelectedContactEmails((prev) =>
                                        prev.filter((em) => em !== c.email)
                                      );
                                    }
                                  }}
                                  className="rounded border-slate-300"
                                />
                              </label>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors"
                  >
                    Start Authorized Live Sharing Session
                  </button>
                </form>

                {/* Watch / Receive Shared Session */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Monitor Shared Tourist Session ID
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter a Session ID shared with your verified email address to view live GPS
                    updates in real time.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste Session ID (e.g., share_abc123...)"
                      value={watchedSessionInput}
                      onChange={(e) => setWatchedSessionInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                    />
                    {watchedSessionInput && (
                      <button
                        type="button"
                        onClick={() => setWatchedSessionInput('')}
                        className="px-3 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {watchedSessionError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                      {watchedSessionError}
                    </p>
                  )}

                  {watchedSessionData && (
                    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {watchedSessionData.ownerName} · {watchedSessionData.tripName}
                        </span>
                        <span className="font-semibold text-emerald-700">
                          {watchedSessionData.isActive ? 'Live Active' : 'Stopped / Expired'}
                        </span>
                      </div>
                      <p className="font-mono-tabular text-slate-800">
                        Lat: {formatCoord(watchedSessionData.latitude, 6)} · Lng:{' '}
                        {formatCoord(watchedSessionData.longitude, 6)} (±
                        {watchedSessionData.accuracy}m)
                      </p>
                      <p className="text-slate-500 font-mono-tabular">
                        Last Received: {formatIstTime(watchedSessionData.updatedAtMs)}
                      </p>
                    </div>
                  )}

                  {sharedWithMeSessions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <p className="text-xs font-semibold text-slate-900">
                        Sessions Automatically Shared With Your Email ({sharedWithMeSessions.length})
                      </p>
                      {sharedWithMeSessions.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {s.ownerName} — {s.tripName}
                            </p>
                            <p className="font-mono-tabular text-slate-600">
                              {formatCoord(s.latitude, 5)}, {formatCoord(s.longitude, 5)} ·{' '}
                              {formatIstTime(s.updatedAtMs)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setWatchedSessionInput(s.id)}
                            className="text-emerald-700 font-medium hover:underline"
                          >
                            Inspect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Owned Sessions */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Your Broadcast Sessions ({mySessions.length})
                </h3>
                {mySessions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No active or recent broadcast sessions created yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {mySessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">
                              {sess.tripName}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                sess.isActive
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-slate-400'
                              }
                            >
                              {sess.isActive ? 'Sharing Live' : 'Stopped'}
                            </span>
                          </div>
                          <p className="font-mono-tabular text-slate-600">
                            Session ID: {sess.id} · Last Sent: {formatCoord(sess.latitude, 5)},{' '}
                            {formatCoord(sess.longitude, 5)}
                          </p>
                          <p className="text-slate-500">
                            Authorized Viewers:{' '}
                            {sess.authorizedEmails.length > 0
                              ? sess.authorizedEmails.join(', ')
                              : 'Owner Only'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(sess.id);
                              setCopiedSessionId(sess.id);
                              setTimeout(() => setCopiedSessionId(null), 2000);
                            }}
                            className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 inline-flex items-center gap-1.5 font-medium whitespace-nowrap"
                          >
                            {copiedSessionId === sess.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                Copied ID
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Session ID
                              </>
                            )}
                          </button>

                          {sess.isActive && (
                            <button
                              type="button"
                              onClick={() => handleStopSharingSession(sess.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold whitespace-nowrap"
                            >
                              Stop Sharing
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== MODULE 8: KERALA CIRCULAR GEOFENCING SYSTEM ==================== */}
          {activeNav === 'geofencing' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Circular Geofencing & Real-Time Boundary Monitor
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Click anywhere on the map (or use your live GPS coordinates) and set a radius in
                    metres. Distance and INSIDE / OUTSIDE status update automatically using the
                    Haversine formula whenever your GPS position changes.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!trackingActive ? (
                    <button
                      type="button"
                      onClick={() => startGpsTracking(false)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start GPS Tracking
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => stopGpsTracking(false)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop GPS Tracking
                    </button>
                  )}
                </div>
              </div>

              {/* Live GPS Telemetry Bar inside Geofencing */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Current GPS Position</span>
                  <p className="font-mono-tabular font-bold text-sm text-slate-900 mt-0.5">
                    {gpsPosition
                      ? `${formatCoord(gpsPosition.latitude, 6)}, ${formatCoord(gpsPosition.longitude, 6)}`
                      : awaitingFirstFix
                      ? 'Waiting for first GPS fix...'
                      : 'GPS Not Started'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">GPS Accuracy & Updated</span>
                  <p className="font-mono-tabular font-bold text-sm text-slate-900 mt-0.5">
                    {gpsPosition ? `±${gpsPosition.accuracy} m · ${lastUpdatedFormatted}` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Tracking Status</span>
                  <p
                    className={`font-bold text-sm mt-0.5 ${
                      trackingActive ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {trackingActive
                      ? awaitingFirstFix
                        ? 'Acquiring GPS...'
                        : 'Active (Watching GPS)'
                      : 'Stopped'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Overall Geofence Status</span>
                  <p
                    className={`font-bold text-sm mt-0.5 ${
                      activeGeofencesCount === 0 || !gpsPosition
                        ? 'text-slate-700'
                        : insideAnyGeofence
                        ? 'text-emerald-700'
                        : 'text-orange-600'
                    }`}
                  >
                    {activeGeofencesCount === 0
                      ? 'No Active Geofence'
                      : !gpsPosition
                      ? 'Start GPS to Evaluate'
                      : insideAnyGeofence
                      ? 'INSIDE Geofence'
                      : 'OUTSIDE Geofence'}
                  </p>
                </div>
              </div>

              {awaitingFirstFix && (
                <div className="bg-sky-50 border border-sky-200 text-sky-950 rounded-xl p-3.5 flex items-center gap-2.5 text-xs">
                  <Loader2 className="w-4 h-4 text-sky-700 animate-spin shrink-0" />
                  <span>Waiting for browser permission and first live GPS coordinates...</span>
                </div>
              )}

              {gpsErrorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{gpsErrorMsg}</span>
                </div>
              )}

              {/* Quick Kerala Destination Geofence Presets */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-800">
                  Quick Kerala Destination Presets (or click anywhere on the map below):
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {KERALA_GEOFENCE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setEditingGeoId(null);
                        setGeoFormError(null);
                        setGeoName(preset.name);
                        setGeoLat(String(preset.latitude));
                        setGeoLng(String(preset.longitude));
                        setGeoRadius(String(preset.radiusMeters));
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                    >
                      {preset.name} ({preset.radiusMeters}m)
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleSaveGeofence}
                  className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingGeoId ? 'Edit Geofence Zone' : 'Create Geofence Boundary'}
                    </h3>
                    {editingGeoId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGeoId(null);
                          setGeoFormError(null);
                          setGeoName('My Safe Zone');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {geoFormError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                      {geoFormError}
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Zone Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      placeholder="e.g. Hotel Safe Zone"
                      value={geoName}
                      onChange={(e) => setGeoName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Centre Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Click map or GPS"
                        value={geoLat}
                        onChange={(e) => setGeoLat(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Centre Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Click map or GPS"
                        value={geoLng}
                        onChange={(e) => setGeoLng(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Radius in Metres (50 m – 50,000 m)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={50000}
                      required
                      value={geoRadius}
                      onChange={(e) => setGeoRadius(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {[50, 100, 250, 500, 1000, 2500].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setGeoRadius(String(r))}
                          className={`px-2 py-1 text-[11px] font-mono-tabular rounded border ${
                            Number(geoRadius) === r
                              ? 'bg-emerald-900 text-white border-emerald-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {r}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={geoNotifyContacts}
                      onChange={(e) => setGeoNotifyContacts(e.target.checked)}
                    />
                    <span>Notify authorized emergency contacts on geofence exit</span>
                  </label>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (gpsPosition) {
                          setGeoFormError(null);
                          setGeoLat(String(Number(gpsPosition.latitude.toFixed(6))));
                          setGeoLng(String(Number(gpsPosition.longitude.toFixed(6))));
                        } else {
                          startGpsTracking(false);
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
                      {gpsPosition ? 'Use Current GPS' : 'Start GPS & Use Pos'}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap"
                    >
                      {editingGeoId ? 'Update Geofence' : 'Create Geofence'}
                    </button>
                  </div>
                </form>

                <div className="lg:col-span-8 space-y-4">
                  <TourSafeMap
                    center={
                      geoLat.trim() !== '' &&
                      geoLng.trim() !== '' &&
                      !Number.isNaN(Number(geoLat)) &&
                      !Number.isNaN(Number(geoLng))
                        ? { lat: Number(geoLat), lng: Number(geoLng) }
                        : gpsPosition
                        ? { lat: gpsPosition.latitude, lng: gpsPosition.longitude }
                        : keralaMapOverviewCenter
                    }
                    zoom={
                      geoLat.trim() !== '' || gpsPosition ? 15 : 8
                    }
                    markers={[
                      ...(gpsPosition
                        ? [
                            {
                              id: 'tourist_now',
                              latitude: gpsPosition.latitude,
                              longitude: gpsPosition.longitude,
                              title: 'Your Live GPS Position',
                              subtitle: `Accuracy ±${gpsPosition.accuracy} m`,
                              kind: 'tourist' as const,
                            },
                          ]
                        : []),
                      ...(geoLat.trim() !== '' &&
                      geoLng.trim() !== '' &&
                      !Number.isNaN(Number(geoLat)) &&
                      !Number.isNaN(Number(geoLng))
                        ? [
                            {
                              id: 'draft_geo',
                              latitude: Number(geoLat),
                              longitude: Number(geoLng),
                              title: `Selected Geofence Centre (${geoRadius} m)`,
                              kind: 'geofence-center' as const,
                            },
                          ]
                        : []),
                    ]}
                    circles={geofencingMapCircles}
                    onMapClick={(clickedLat, clickedLng) => {
                      setGeoFormError(null);
                      setGeoLat(String(clickedLat));
                      setGeoLng(String(clickedLng));
                    }}
                    hasMapsApiKey={HAS_MAPS_KEY}
                    hasLiveGps={Boolean(gpsPosition)}
                    lastUpdatedLabel={gpsPosition ? lastUpdatedFormatted : undefined}
                    heightClass="h-[380px]"
                  />

                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Configured Geofences ({geofences.length})
                      </h3>
                      <span className="text-xs text-slate-500">
                        Haversine distance calculated from live GPS coordinates
                      </span>
                    </div>

                    {geofences.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3">
                        No geofences created yet. Click anywhere on the map above (or click "Use
                        Current GPS"), choose a radius in metres, and click Create Geofence.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {geofenceEvaluations.map(({ zone: g, distanceMeters, isInside }) => {
                          const roundedMeters =
                            distanceMeters !== null ? Math.round(distanceMeters) : null;
                          return (
                            <div
                              key={g.id}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {g.name}
                                  </span>

                                  {!g.isActive ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-600">
                                      PAUSED
                                    </span>
                                  ) : isInside === null ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-700">
                                      WAITING FOR LIVE GPS
                                    </span>
                                  ) : isInside ? (
                                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      INSIDE
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-orange-100 text-orange-900 border border-orange-300">
                                      OUTSIDE
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-mono-tabular text-slate-600">
                                  Centre: {formatCoord(g.latitude, 5)},{' '}
                                  {formatCoord(g.longitude, 5)} · Radius:{' '}
                                  <strong>{g.radiusMeters} m</strong>
                                </p>

                                <p className="text-xs font-mono-tabular text-slate-800">
                                  Distance from geofence centre:{' '}
                                  {roundedMeters !== null ? (
                                    <strong>
                                      {roundedMeters.toLocaleString()} m
                                      {roundedMeters >= 1000
                                        ? ` (${formatDistance(roundedMeters)})`
                                        : ''}
                                    </strong>
                                  ) : (
                                    <span className="text-slate-500">
                                      Start GPS Tracking to calculate live distance
                                    </span>
                                  )}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleGeofenceActive(g)}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-md hover:bg-slate-200"
                                >
                                  {g.isActive ? 'Pause' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGeoId(g.id);
                                    setGeoFormError(null);
                                    setGeoName(g.name);
                                    setGeoLat(String(g.latitude));
                                    setGeoLng(String(g.longitude));
                                    setGeoRadius(String(g.radiusMeters));
                                    setGeoNotifyContacts(g.notifyContacts);
                                  }}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGeofence(g.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600"
                                  title="Delete Geofence"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MODULE 10: KERALA AI RECOMMENDATIONS (INR) ==================== */}
          {activeNav === 'ai-recommendations' && (
            <AIRecommendationsView
              currentCoords={gpsPosition}
              language={language}
              defaultTravelStyle={privateInfo.travelStyle}
              defaultBudget={privateInfo.budgetTier}
              onNewRecommendationGenerated={(summaryTitle) => {
                pushNotification(
                  'recommendation',
                  'New Kerala AI Travel Plan Ready',
                  `Generated "${summaryTitle}" tailored to your INR budget and preferences.`
                );
              }}
            />
          )}

          {/* ==================== MODULE 13: NEARBY EMERGENCY SERVICES ==================== */}
          {activeNav === 'nearby-emergency' && (
            <NearbyEmergencyView
              currentCoords={gpsPosition}
              hasMapsApiKey={HAS_MAPS_KEY}
              geofences={mapCircles}
              onRequestStartTracking={() => startGpsTracking(true)}
            />
          )}

          {/* ==================== MODULE 11: EMERGENCY SOS & HELPLINE CENTER ==================== */}
          {activeNav === 'emergency-sos' && (
            <div className="space-y-6">
              <div className="bg-red-950 text-white rounded-2xl p-6 sm:p-8 space-y-5">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs font-semibold text-red-300">
                      Kerala Emergency SOS & Direct Responder Helplines
                    </p>
                    <h2 className="text-2xl font-bold">Immediate Emergency Assistance</h2>
                    <p className="text-sm text-red-100 leading-relaxed">
                      Triggering SOS captures your current GPS coordinates and Tourist ID, writes an
                      auditable cloud alert for your authorized contacts, and provides instant
                      direct telephone dialing to official emergency services in Kerala.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSosModalOpen(true)}
                    className="px-6 py-3.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors shadow-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <AlertOctagon className="w-5 h-5" />
                    Activate SOS Cloud Alert
                  </button>
                </div>

                {/* Verified Official Indian & Kerala Emergency Dial Numbers */}
                <div className="pt-4 border-t border-red-900 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <a
                    href="tel:112"
                    className="px-4 py-3 bg-white text-red-950 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-red-50 transition-colors font-mono-tabular"
                  >
                    <span>Emergency</span>
                    <span className="text-sm">112</span>
                  </a>
                  <a
                    href="tel:100"
                    className="px-4 py-3 bg-red-900/80 text-white border border-red-800 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-red-900 transition-colors font-mono-tabular"
                  >
                    <span>Police</span>
                    <span className="text-sm">100</span>
                  </a>
                  <a
                    href="tel:101"
                    className="px-4 py-3 bg-red-900/80 text-white border border-red-800 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-red-900 transition-colors font-mono-tabular"
                  >
                    <span>Fire & Rescue</span>
                    <span className="text-sm">101</span>
                  </a>
                  <a
                    href="tel:108"
                    className="px-4 py-3 bg-red-900/80 text-white border border-red-800 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-red-900 transition-colors font-mono-tabular"
                  >
                    <span>Ambulance</span>
                    <span className="text-sm">108</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Registered Emergency Contacts ({contacts.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveNav('profile')}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Manage Contacts
                    </button>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No emergency contacts added yet. Add contacts in Profile.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {contacts.map((c) => (
                        <div
                          key={c.id}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {c.name}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                · {c.relationship}
                              </span>
                            </p>
                            <p className="text-xs text-slate-600 font-mono-tabular">
                              {c.phone} {c.email ? `· ${c.email}` : ''}
                            </p>
                          </div>
                          <a
                            href={`tel:${c.phone}`}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Recorded Emergency Events & Cloud Delivery Verification
                  </h3>
                  <p className="text-xs text-slate-500">
                    TourSafe 360 never fakes cellular SMS or police dispatch receipts. Status below
                    reflects verified Firestore cloud persistence and live shared-session updates
                    only.
                  </p>

                  {emergencyEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      No emergency alerts have been triggered on this account.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {emergencyEvents.map((ev) => (
                        <div key={ev.id} className="py-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-red-700 uppercase">
                              {ev.alertType.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono-tabular text-slate-500">
                              {formatIstDateTime(ev.createdAtMs)}
                            </span>
                          </div>
                          {ev.touristId && (
                            <p className="font-mono-tabular text-[11px] text-emerald-800">
                              Tourist ID: {ev.touristId}
                            </p>
                          )}
                          <p className="text-slate-700">{ev.notes}</p>
                          <p className="font-mono-tabular text-slate-600">
                            Coords: {formatCoord(ev.latitude, 5)}, {formatCoord(ev.longitude, 5)} (±
                            {ev.accuracy}m)
                          </p>
                          <p className="text-slate-600">
                            Confirmed Status:{' '}
                            <strong className="text-slate-900">
                              {ev.deliveryStatus === 'shared_session_updated'
                                ? 'Cloud Alert Recorded + Live Shared Session Updated'
                                : 'Recorded in Firestore Cloud Log (Use 112 Direct Call for Voice/SMS)'}
                            </strong>{' '}
                            · State: <span className="capitalize">{ev.status}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== MODULE 14: PRIVATE LOCATION HISTORY ==================== */}
          {activeNav === 'location-history' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Private Location History (IST)
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Review your recorded GPS journey trails and IST timestamps. Strictly private to
                    your tourist account (administrators cannot read your location logs).
                  </p>
                </div>

                {locationLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistoryOpen(true)}
                    className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All History
                  </button>
                )}
              </div>

              {confirmClearHistoryOpen && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-xs text-red-900 font-medium">
                    Permanently delete all {locationLogs.length} recorded location history entries
                    from your account?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClearHistoryOpen(false)}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleClearLocationHistory}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}

              <TourSafeMap
                center={{
                  lat:
                    locationLogs[0]?.latitude ??
                    gpsPosition?.latitude ??
                    keralaMapOverviewCenter.lat,
                  lng:
                    locationLogs[0]?.longitude ??
                    gpsPosition?.longitude ??
                    keralaMapOverviewCenter.lng,
                }}
                zoom={locationLogs.length > 0 || gpsPosition ? 14 : 8}
                markers={locationLogs.slice(0, 15).map((l, idx) => ({
                  id: l.id,
                  latitude: l.latitude,
                  longitude: l.longitude,
                  title: idx === 0 ? 'Latest Logged Point' : `Waypoint #${locationLogs.length - idx}`,
                  subtitle: `${formatIstDateTime(l.createdAtMs)} · ${l.source.toUpperCase()}`,
                  kind: idx === 0 ? 'tourist' : 'contact',
                }))}
                polylinePath={historyPolyline}
                hasMapsApiKey={HAS_MAPS_KEY}
                hasLiveGps={Boolean(gpsPosition)}
                heightClass="h-[360px]"
              />

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    Coordinate Log ({locationLogs.length} entries)
                  </span>
                  {locationLogs.length >= 2 && (
                    <span className="font-mono-tabular">
                      Span:{' '}
                      {Math.max(
                        1,
                        Math.round(
                          (locationLogs[0].createdAtMs -
                            locationLogs[locationLogs.length - 1].createdAtMs) /
                            60000
                        )
                      )}{' '}
                      min
                    </span>
                  )}
                </div>

                {locationLogs.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-900">No location history entries</p>
                    <p className="text-xs text-slate-500">
                      Enable continuous GPS tracking on the GPS Tracking page to log your route.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-medium">Timestamp (IST)</th>
                          <th className="px-4 py-3 font-medium">Trip Session</th>
                          <th className="px-4 py-3 font-medium text-right">Latitude</th>
                          <th className="px-4 py-3 font-medium text-right">Longitude</th>
                          <th className="px-4 py-3 font-medium text-right">Accuracy</th>
                          <th className="px-4 py-3 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {locationLogs.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 font-mono-tabular text-slate-700">
                              {formatIstDateTime(entry.createdAtMs)}
                            </td>
                            <td className="px-4 py-2.5 font-mono-tabular text-slate-500">
                              {entry.tripId}
                            </td>
                            <td className="px-4 py-2.5 font-mono-tabular text-right text-slate-900">
                              {formatCoord(entry.latitude, 6)}
                            </td>
                            <td className="px-4 py-2.5 font-mono-tabular text-right text-slate-900">
                              {formatCoord(entry.longitude, 6)}
                            </td>
                            <td className="px-4 py-2.5 font-mono-tabular text-right text-slate-600">
                              ±{entry.accuracy}m
                            </td>
                            <td className="px-4 py-2.5 uppercase text-slate-600">{entry.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== NOTIFICATIONS ==================== */}
          {activeNav === 'notifications' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Safety & System Notifications
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Real-time alerts for geofence entry/exit, emergency SOS, live sharing, and AI
                    trip plans in IST.
                  </p>
                </div>

                {typeof window !== 'undefined' && 'Notification' in window && (
                  <button
                    type="button"
                    onClick={() => Notification.requestPermission()}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    Enable Browser Push Alerts
                  </button>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-900">All caught up</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Safety notifications will appear here in real time.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 flex items-start justify-between gap-4 ${
                        n.read ? 'bg-white' : 'bg-emerald-50/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">{n.title}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatIstDateTime(n.createdAtMs)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{n.message}</p>
                      </div>

                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => {
                            if (fbUser && !n.id.startsWith('local_')) {
                              updateDoc(doc(db, 'users', fbUser.uid, 'notifications', n.id), {
                                read: true,
                              }).catch(() => {});
                            } else {
                              setNotifications((prev) =>
                                prev.map((item) =>
                                  item.id === n.id ? { ...item, read: true } : item
                                )
                              );
                            }
                          }}
                          className="text-xs font-medium text-emerald-700 hover:underline shrink-0"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================== MODULE 2 & 17: TOURIST PROFILE, CONTACTS & PRIVACY ==================== */}
          {activeNav === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Tourist Profile, Emergency Contacts & Privacy Consent
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Sensitive personal details (DOB, mobile number, email, state/country) are stored
                  in a strictly owner-only private subcollection. Your permanent Kerala Tourist ID
                  is never regenerated.
                </p>
              </div>

              {!fbUser && (
                <div className="bg-emerald-950 text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold">
                      Register or Sign In to Issue Your Permanent Kerala Tourist ID
                    </h3>
                    <p className="text-xs text-emerald-100 mt-1">
                      Supports Indian and international tourists via Email/Password registration or
                      one-click Google Sign-In.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAuthPortal('signin')}
                      className="px-4 py-2.5 text-xs font-medium bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 whitespace-nowrap"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthPortal('register')}
                      className="px-5 py-2.5 text-xs font-semibold text-emerald-950 bg-amber-400 rounded-lg hover:bg-amber-300 whitespace-nowrap"
                    >
                      Register Tourist Account
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleSaveProfile}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Tourist Identity & Privacy Permissions
                    </h3>
                    {publicProfile.touristId && (
                      <span className="font-mono-tabular text-xs font-semibold text-emerald-800">
                        {publicProfile.touristId}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={publicProfile.displayName}
                        onChange={(e) =>
                          setPublicProfile((p) => ({ ...p, displayName: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nationality
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={60}
                        placeholder="e.g. Indian, British, German"
                        value={publicProfile.nationality || ''}
                        onChange={(e) =>
                          setPublicProfile((p) => ({ ...p, nationality: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email Address (Private PII)
                      </label>
                      <input
                        type="email"
                        maxLength={160}
                        value={privateInfo.email}
                        onChange={(e) =>
                          setPrivateInfo((p) => ({ ...p, email: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Mobile Number (Private PII)
                      </label>
                      <input
                        type="tel"
                        maxLength={30}
                        placeholder="+91 98470 00000"
                        value={privateInfo.phone}
                        onChange={(e) =>
                          setPrivateInfo((p) => ({ ...p, phone: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={privateInfo.dob || ''}
                        onChange={(e) => setPrivateInfo((p) => ({ ...p, dob: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        State / Province
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="Kerala"
                        value={privateInfo.stateRegion || ''}
                        onChange={(e) =>
                          setPrivateInfo((p) => ({ ...p, stateRegion: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="India"
                        value={privateInfo.country || ''}
                        onChange={(e) =>
                          setPrivateInfo((p) => ({ ...p, country: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Optional Profile Photograph URL
                    </label>
                    <input
                      type="url"
                      maxLength={2048}
                      placeholder="https://..."
                      value={publicProfile.photoUrl || ''}
                      onChange={(e) =>
                        setPublicProfile((p) => ({ ...p, photoUrl: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(privateInfo.personalInfoConsent ?? true)}
                        onChange={(e) =>
                          setPrivateInfo((p) => ({ ...p, personalInfoConsent: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <strong>Explicit Personal Data Consent:</strong> Store my registration
                        details securely for tourist identification and emergency assistance.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publicProfile.trackingConsent}
                        onChange={(e) =>
                          setPublicProfile((p) => ({ ...p, trackingConsent: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <strong>Explicit GPS Location Tracking Consent:</strong> Allow TourSafe 360
                        to record coordinates while tracking is active.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publicProfile.sharingConsent}
                        onChange={(e) =>
                          setPublicProfile((p) => ({ ...p, sharingConsent: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <strong>Explicit Live Sharing Consent:</strong> Allow active sessions to
                        transmit coordinates to my authorized emergency contacts.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!fbUser}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-50"
                  >
                    Save Tourist Profile & Consent
                  </button>
                </form>

                {/* Emergency Contacts Registration */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Register Trusted Emergency Contacts
                  </h3>

                  <form onSubmit={handleAddContact} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Contact Full Name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Mobile Number (+91...)"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="email"
                        placeholder="Verified Email (for Live Map Access)"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Relationship (e.g. Spouse, Parent)"
                        value={contactRelation}
                        onChange={(e) => setContactRelation(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={contactNotifySos}
                          onChange={(e) => setContactNotifySos(e.target.checked)}
                        />
                        Alert on SOS
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={contactNotifyGeo}
                          onChange={(e) => setContactNotifyGeo(e.target.checked)}
                        />
                        Alert on Geofence Exit
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Trusted Contact
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 pt-2 border-t border-slate-200">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {c.name} · {c.relationship}
                          </p>
                          <p className="text-slate-500 font-mono-tabular">
                            {c.phone} {c.email ? `· ${c.email}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                          title="Remove Contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Kerala Destination Safety Feedback Report */}
              <form
                onSubmit={handleSubmitSafetyReport}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Submit Kerala Destination Safety Feedback Report
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Ghat Road / Signage Concern</option>
                    <option>Beach Lifeguard / Rip-Current Notice</option>
                    <option>Backwater Jetty / Boat Safety</option>
                    <option>Lighting / Tourist Aid Post Feedback</option>
                  </select>
                  <input
                    type="text"
                    required
                    maxLength={500}
                    placeholder="Describe the non-emergency Kerala tourism safety observation for administrators..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    className="md:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                  >
                    Submit Report
                  </button>
                </div>
                {reportSubmittedMsg && (
                  <p className="text-xs text-emerald-700 font-medium">{reportSubmittedMsg}</p>
                )}
              </form>
            </div>
          )}

          {/* ==================== MODULE 16: ADMIN MANAGEMENT PANEL ==================== */}
          {activeNav === 'admin-panel' && (
            <AdminDashboardView currentUserId={fbUser?.uid || ''} isAdmin={isAdmin} />
          )}
        </main>

        {/* Quiet Legal & Google Maps Attribution Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white px-4 sm:px-8 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <span>
            TourSafe 360 · Kerala Smart Tourism Safety, Identification, Tracking & AI System ·{' '}
            {t.keralaEmergencyHeader}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-800 underline"
            >
              Google Maps Terms
            </a>
            <a
              href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-800 underline"
            >
              Privacy Policy
            </a>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 grid grid-cols-5 gap-1">
        {(
          [
            { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'tourist-id', label: 'Tourist ID', icon: <IdCard className="w-4 h-4" /> },
            { id: 'kerala-destinations', label: 'Kerala', icon: <Compass className="w-4 h-4" /> },
            { id: 'ai-recommendations', label: 'AI Plan', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'profile', label: 'Profile', icon: <UserCheck className="w-4 h-4" /> },
          ] as { id: NavSection; label: string; icon: React.ReactNode }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveNav(m.id)}
            className={`flex flex-col items-center justify-center py-1 rounded-lg text-[11px] font-medium ${
              activeNav === m.id ? 'text-emerald-800 bg-emerald-50' : 'text-slate-600'
            }`}
          >
            {m.icon}
            <span className="mt-0.5 truncate">{m.label}</span>
          </button>
        ))}
      </nav>

      {/* Registration, Login & Password Reset Modal (Module 2 & 3) */}
      <AuthPortalModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          setActiveNav('tourist-id');
        }}
      />

      {/* Emergency SOS Confirmation Modal — Safeguard Against Accidental Activation */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-red-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-700">
                <AlertOctagon className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold text-slate-900">Confirm Emergency SOS Alert</h3>
              </div>
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confirming will capture your live GPS coordinates (
              <span className="font-mono-tabular font-semibold text-slate-900">
                {gpsPosition
                  ? `${formatCoord(gpsPosition.latitude, 5)}, ${formatCoord(gpsPosition.longitude, 5)}`
                  : 'requesting live browser GPS fix on confirm'}
              </span>
              ) and Tourist ID, and record an emergency cloud alert visible to your authorized
              contacts. For immediate voice police or medical dispatch in Kerala, tap{' '}
              <strong>Call 112</strong> or <strong>108</strong> below.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Incident Classification
              </label>
              <select
                value={sosAlertType}
                onChange={(e) => setSosAlertType(e.target.value as EmergencyAlertType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="sos_emergency">SOS Emergency Assistance</option>
                <option value="unexpected_location">Unexpected Location / Stranded</option>
                <option value="geofence_exit">Safe Geofence Boundary Breach</option>
                <option value="lost_communication">Intermittent Signal / Check-In Alert</option>
                <option value="low_battery">Critical Low Device Battery Warning</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Optional Situation Note (Landmark, Boat/Vehicle No., Medical Need)
              </label>
              <textarea
                rows={2}
                maxLength={350}
                value={sosNotes}
                onChange={(e) => setSosNotes(e.target.value)}
                placeholder="e.g. Near Munnar Mattupetty Road Viewpoint, need medical assistance..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="tel:112"
                className="px-3 py-2.5 text-xs font-bold text-center bg-red-100 text-red-900 rounded-lg hover:bg-red-200 font-mono-tabular"
              >
                Direct Call 112
              </a>
              <a
                href="tel:108"
                className="px-3 py-2.5 text-xs font-bold text-center bg-red-100 text-red-900 rounded-lg hover:bg-red-200 font-mono-tabular"
              >
                Ambulance 108
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sosSubmitting}
                onClick={handleConfirmSosAlert}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {sosSubmitting ? 'Recording Alert...' : 'Confirm & Record SOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (HAS_MAPS_KEY) {
    return (
      <APIProvider
        apiKey={RAW_MAPS_KEY}
        libraries={['marker', 'places', 'routes']}
        region="IN"
      >
        {contentTree}
      </APIProvider>
    );
  }

  return contentTree;
}
