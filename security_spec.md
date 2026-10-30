# TourSafe 360 Kerala — Security Specification (Payload-First Security TDD)

## 1. Data Invariants

1. **PII Split Isolation (`/users/{userId}` vs `/users/{userId}/private/{docId}`)**:
   - `/users/{userId}` stores only non-PII account metadata (`uid`, `displayName`, `touristId`, `verificationToken`, `nationality`, `photoUrl`, `accountStatus`, consent booleans, interval). Readable by `isOwner(userId)` or `isAdmin()`.
   - `/users/{userId}/private/{docId}` stores PII (`email`, `phone`, `dob`, `stateRegion`, `country`, `personalInfoConsent`, preferences) and is strictly readable/writable ONLY by `isOwner(userId)` (not even admins can scrape private PII).
2. **Immutable Unique Tourist ID & Safe QR Verification (`/systemCounters/touristId` & `/touristVerifications/{token}`)**:
   - `/systemCounters/touristId` can only increment `currentSeq` by `+1` (`incoming().currentSeq == existing().currentSeq + 1`), preventing counter tampering or duplicate IDs.
   - Once `touristId` is written on `/users/{userId}`, it is immutable (`incoming().touristId == existing().touristId`); existing accounts lacking `touristId` may perform a one-time atomic migration.
   - `/touristVerifications/{token}` contains ONLY non-PII Digital ID fields (`touristId`, `displayName`, `nationality`, `registeredDateIso`, `emailVerified`, `status`). Single-doc `get` requires knowing the opaque `token`; `list` is restricted to `isAdmin()` to block enumeration/scraping.
3. **Private Location History Privacy (`/users/{userId}/locationLogs/{logId}`)**:
   - Administrators MUST NOT gain access to private live location histories. Access is strictly `isOwner(userId)` AND parent `/users/{userId}` must exist (Master Gate).
4. **Master Gate Relational Sync**:
   - Every subcollection under `/users/{userId}/...` (`private`, `contacts`, `geofences`, `locationLogs`, `notifications`) verifies `isOwner(userId)` and `exists(/databases/$(database)/documents/users/$(userId))` on writes.
5. **Authorized Wireless Sharing (`/trackingSessions/{sessionId}`)**:
   - Only `ownerId == request.auth.uid` can create, update, or delete a tracking session.
   - Email-based contact reads strictly mandate `isVerifiedUser()` (`request.auth.token.email_verified == true`) so unverified email accounts cannot spoof an authorized contact's email.
6. **Terminal State Locking**:
   - `emergencyEvents/{eventId}`: Once `resource.data.status == 'resolved'`, further non-admin updates are blocked.
   - `reports/{reportId}`: Once `resource.data.status == 'closed'`, further non-admin updates are blocked.
7. **Verified Identity & Anti-Spoofing**:
   - Bootstrapped admin (`sit24it054@sairamtap.edu.in`) strictly requires `request.auth.token.email_verified == true` OR `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
8. **Strict Timestamps & Immutable Owners**:
   - `createdAt == request.time` on `create`; `createdAt == resource.data.createdAt` and `updatedAt == request.time` on `update`.
   - `ownerId` / `uid` / `reporterId` / `createdBy` / `touristId` are immutable across updates.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on User Profile**:
   `{ "uid": "u1", "displayName": "Alice", "trackingConsent": true, "sharingConsent": false, "trackingIntervalSec": 10, "isAdmin": true, "createdAt": "SERVER_TIME", "updatedAt": "SERVER_TIME" }` -> Rejected by `hasOnly()`.
2. **Unverified Admin Email Spoof**:
   Auth token `{ uid: "attacker", email: "sit24it054@sairamtap.edu.in", email_verified: false }` reading `/reports` or writing `/safetyAlerts` -> Rejected by `isVerifiedUser()`.
3. **Admin Scraping Private Location History**:
   Admin user `{ uid: "admin1", email: "sit24it054@sairamtap.edu.in", email_verified: true }` attempting `get` or `list` on `/users/victim1/locationLogs` -> Rejected because `isAdmin()` is excluded from `locationLogs`.
4. **Non-Owner PII Read**:
   Authenticated user `u2` attempting `get` on `/users/u1/private/info` -> Rejected by `isOwner(userId)`.
5. **Tourist ID Mutation / Forgery**:
   User `u1` attempting `update` on `/users/u1` changing `touristId` from `"TS360-KL-2026-000001"` to `"TS360-KL-2026-999999"` -> Rejected by immutable `touristId` gate.
6. **Tourist Counter Jump / Reset Attack**:
   User `u1` attempting `update` on `/systemCounters/touristId` setting `currentSeq: 999999` or `0` -> Rejected by `incoming().currentSeq == existing().currentSeq + 1`.
7. **Public Scraping of `/touristVerifications` Collection**:
   Anonymous or standard user attempting `list` on `/touristVerifications` -> Rejected (`allow list: if isAdmin()`).
8. **Owner Spoofing on Emergency Event**:
   User `u1` creating `/emergencyEvents/ev1` with `ownerId: "u2"` -> Rejected by `data.ownerId == request.auth.uid`.
9. **Terminal State Re-opening**:
   User `u1` updating `/emergencyEvents/ev1` when `existing().status == "resolved"` -> Rejected by terminal state lock.
10. **Client Timestamp Forgery**:
    User `u1` creating `/users/u1/locationLogs/log1` with `createdAt: Timestamp(2020, 1, 1)` -> Rejected by `incoming().createdAt == request.time`.
11. **Unbounded Array / Type Poisoning in `authorizedEmails`**:
    User `u1` creating `/trackingSessions/sess1` with 50 emails (`size() > 10`) -> Rejected by `authorizedEmails.size() <= 10`.
12. **Blanket List Scraping on `/trackingSessions`**:
    User `u2` executing unfiltered `getDocs(collection(db, 'trackingSessions'))` -> Rejected by `allow list` requiring `resource.data.ownerId == request.auth.uid || (isVerifiedUser() && request.auth.token.email in resource.data.authorizedEmails)`.
