import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { clampString, generateSafeId } from './utils/geo';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const BOOTSTRAP_ADMIN_EMAIL = 'sit24it054@sairamtap.edu.in';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export interface RegistrationPayload {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  nationality: string;
  stateRegion: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  photoUrl?: string;
  personalInfoConsent: boolean;
  trackingConsent: boolean;
}

/**
 * Atomically ensures every authenticated user has a single, permanent, unique Kerala Tourist ID
 * in the format `TS360-KL-2026-000001`.
 * - Generates ONCE on initial registration or one-time migration for pre-existing accounts.
 * - Never regenerates on subsequent logins.
 * - Writes minimal non-PII QR verification card record at `/touristVerifications/{token}`.
 */
export async function ensureTouristProfileAndUniqueId(
  user: FirebaseUser,
  regData?: Partial<RegistrationPayload>
): Promise<{ touristId: string; verificationToken: string }> {
  const userRef = doc(db, 'users', user.uid);
  const counterRef = doc(db, 'systemCounters', 'touristId');

  const result = await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : null;

    // Case 1: Account already exists AND already has a permanent Tourist ID -> NEVER regenerate
    if (
      existingData &&
      typeof existingData.touristId === 'string' &&
      /^TS360-KL-[0-9]{4}-[0-9]{6}$/.test(existingData.touristId) &&
      typeof existingData.verificationToken === 'string' &&
      existingData.verificationToken.length > 0
    ) {
      return {
        touristId: existingData.touristId as string,
        verificationToken: existingData.verificationToken as string,
        isNewAccount: false,
      };
    }

    // Case 2: New registration OR one-time migration for existing account missing Tourist ID
    const counterSnap = await tx.get(counterRef);
    const prevSeq =
      counterSnap.exists() && typeof counterSnap.data().currentSeq === 'number'
        ? Math.floor(counterSnap.data().currentSeq)
        : 0;
    const nextSeq = prevSeq + 1;
    const year = 2026;
    const allocatedTouristId = `TS360-KL-${year}-${String(nextSeq).padStart(6, '0')}`;
    const verificationToken = generateSafeId('vrf');
    const verifRef = doc(db, 'touristVerifications', verificationToken);

    const safeName = clampString(
      regData?.fullName || existingData?.displayName || user.displayName || 'Kerala Traveler',
      80
    );
    const safeNationality = clampString(
      regData?.nationality || existingData?.nationality || 'Indian',
      60
    );
    const safePhoto = clampString(
      regData?.photoUrl ?? existingData?.photoUrl ?? user.photoURL ?? '',
      2048
    );
    const registeredDateIso =
      (typeof existingData?.registeredDateIso === 'string' && existingData.registeredDateIso) ||
      new Date().toISOString();

    if (counterSnap.exists()) {
      tx.update(counterRef, {
        currentSeq: nextSeq,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(counterRef, {
        currentSeq: 1,
        updatedAt: serverTimestamp(),
      });
    }

    tx.set(verifRef, {
      token: verificationToken,
      touristId: allocatedTouristId,
      uid: user.uid,
      displayName: safeName,
      nationality: safeNationality,
      photoUrl: safePhoto,
      registeredDateIso,
      emailVerified: Boolean(user.emailVerified),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (userSnap.exists()) {
      tx.update(userRef, {
        displayName: safeName,
        touristId: allocatedTouristId,
        verificationToken,
        nationality: safeNationality,
        photoUrl: safePhoto,
        registeredDateIso,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(userRef, {
        uid: user.uid,
        displayName: safeName,
        touristId: allocatedTouristId,
        verificationToken,
        nationality: safeNationality,
        photoUrl: safePhoto,
        registeredDateIso,
        accountStatus: 'active',
        trackingConsent: regData?.trackingConsent ?? true,
        sharingConsent: true,
        trackingIntervalSec: 10,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return {
      touristId: allocatedTouristId,
      verificationToken,
      isNewAccount: !userSnap.exists(),
    };
  });

  // Ensure isolated private PII record exists or updates when registration payload is supplied
  if (result.isNewAccount || regData) {
    const privRef = doc(db, 'users', user.uid, 'private', 'info');
    await setDoc(
      privRef,
      {
        uid: user.uid,
        email: clampString(regData?.email || user.email || '', 160),
        phone: clampString(regData?.phone || user.phoneNumber || '', 30),
        dob: clampString(regData?.dob || '', 20),
        stateRegion: clampString(regData?.stateRegion || 'Kerala', 60),
        country: clampString(regData?.country || 'India', 60),
        personalInfoConsent: regData?.personalInfoConsent ?? true,
        travelStyle: 'family',
        budgetTier: 'moderate',
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  }

  // Register initial emergency contact if provided during signup
  if (regData?.emergencyContactName?.trim() && regData?.emergencyContactPhone?.trim()) {
    const cId = generateSafeId('cnt');
    await setDoc(doc(db, 'users', user.uid, 'contacts', cId), {
      ownerId: user.uid,
      name: clampString(regData.emergencyContactName, 80),
      phone: clampString(regData.emergencyContactPhone, 30),
      email: clampString(regData.emergencyContactEmail || '', 160),
      relationship: 'Primary Emergency Contact',
      notifyOnSos: true,
      notifyOnGeofence: true,
      createdAt: serverTimestamp(),
    });
  }

  return {
    touristId: result.touristId,
    verificationToken: result.verificationToken,
  };
}

export async function registerTouristWithEmail(
  password: string,
  payload: RegistrationPayload
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(auth, payload.email.trim(), password);
  await updateProfile(cred.user, {
    displayName: clampString(payload.fullName, 80),
    photoURL: payload.photoUrl ? clampString(payload.photoUrl, 2048) : undefined,
  });
  await ensureTouristProfileAndUniqueId(cred.user, payload);
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn('Verification email dispatch notice:', e);
  }
  return cred.user;
}

export async function signInTouristWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureTouristProfileAndUniqueId(cred.user);
  return cred.user;
}

export async function sendTouristPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}
