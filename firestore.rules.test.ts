/**
 * TourSafe 360 Kerala — Firestore Security Rules Specification & Red Team Payload Suite
 * Verifies that all "Dirty Dozen" adversarial payloads defined in security_spec.md
 * violate the schema invariants, Master Gate, Tourist ID immutability, PII Split Isolation, or RBAC gates.
 */

export interface AdversarialPayloadCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authContext: {
    uid: string | null;
    email?: string;
    email_verified?: boolean;
  };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByGate: string;
}

export const DIRTY_DOZEN_SECURITY_SUITE: AdversarialPayloadCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Profile',
    targetPath: '/users/u1',
    operation: 'create',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: {
      uid: 'u1',
      displayName: 'Alice',
      trackingConsent: true,
      sharingConsent: false,
      trackingIntervalSec: 10,
      isAdmin: true,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidUserPublic -> data.keys().hasOnly(...)',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof',
    targetPath: '/safetyAlerts/alert_1',
    operation: 'create',
    authContext: { uid: 'attacker', email: 'sit24it054@sairamtap.edu.in', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isAdmin() -> isVerifiedUser() (email_verified == true)',
  },
  {
    id: 3,
    name: 'Administrator Scraping Private Location History',
    targetPath: '/users/victim1/locationLogs',
    operation: 'list',
    authContext: { uid: 'admin1', email: 'sit24it054@sairamtap.edu.in', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isOwner(userId) only; isAdmin() explicitly excluded per Module 17',
  },
  {
    id: 4,
    name: 'Non-Owner Reading Private PII Info',
    targetPath: '/users/u1/private/info',
    operation: 'get',
    authContext: { uid: 'u2', email: 'u2@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'Split PII Collection -> allow get: if isOwner(userId)',
  },
  {
    id: 5,
    name: 'Tourist ID Mutation After Assignment',
    targetPath: '/users/u1',
    operation: 'update',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: { touristId: 'TS360-KL-2026-999999' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isTouristIdPreservedOrMigrated() -> incoming().touristId == existing().touristId',
  },
  {
    id: 6,
    name: 'Tourist Counter Sequence Jump / Reset Attack',
    targetPath: '/systemCounters/touristId',
    operation: 'update',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: { currentSeq: 999999 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().currentSeq == existing().currentSeq + 1',
  },
  {
    id: 7,
    name: 'Public Enumeration / List Scraping on /touristVerifications',
    targetPath: '/touristVerifications',
    operation: 'list',
    authContext: { uid: 'u2', email: 'u2@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'allow list: if isAdmin()',
  },
  {
    id: 8,
    name: 'Owner Spoofing on Emergency Event',
    targetPath: '/emergencyEvents/ev1',
    operation: 'create',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: {
      ownerId: 'u2',
      ownerName: 'Spoofed',
      alertType: 'sos_emergency',
      latitude: 10.0889,
      longitude: 77.0595,
      accuracy: 12,
      notes: 'Fake alert',
      deliveryStatus: 'recorded_in_cloud',
      status: 'active',
      authorizedEmails: [],
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().ownerId == request.auth.uid',
  },
  {
    id: 9,
    name: 'Terminal State Re-Opening on Resolved Emergency Event',
    targetPath: '/emergencyEvents/ev_resolved',
    operation: 'update',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: { status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'existing().status != "resolved"',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery on Location Log',
    targetPath: '/users/u1/locationLogs/log1',
    operation: 'create',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: {
      ownerId: 'u1',
      tripId: 'trip_1',
      latitude: 10.0889,
      longitude: 77.0595,
      accuracy: 8,
      source: 'gps',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'incoming().createdAt == request.time',
  },
  {
    id: 11,
    name: 'Unbounded Array Size Poisoning in authorizedEmails',
    targetPath: '/trackingSessions/sess1',
    operation: 'create',
    authContext: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    payload: {
      authorizedEmails: Array.from({ length: 25 }, (_, i) => `user${i}@example.com`),
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'isValidEmailList -> emails.size() <= 10',
  },
  {
    id: 12,
    name: 'Blanket List Scraping on /trackingSessions',
    targetPath: '/trackingSessions',
    operation: 'list',
    authContext: { uid: 'scraper', email: 'scraper@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByGate: 'Query Enforcer -> existing().ownerId == request.auth.uid || (isVerifiedUser() && email in existing().authorizedEmails)',
  },
];
