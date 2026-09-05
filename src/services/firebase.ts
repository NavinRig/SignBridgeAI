import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocFromServer,
  query,
  orderBy,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TranscriptItem, UserPreferences } from '../types';

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with databaseId as specified in config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation Types for Error Logging
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

// CRITICAL: Standard error handler conforming to FirestoreErrorInfo
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

// CRITICAL: Connection verification at initialization
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Firestore connected successfully to database:', firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authentication Methods
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.error('Google Sign-in error:', err);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out error:', err);
  }
}

export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// Firestore Transcripts Sync
export function subscribeUserTranscripts(
  userId: string,
  onUpdate: (items: TranscriptItem[]) => void
): Unsubscribe {
  const path = `users/${userId}/transcripts`;
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TranscriptItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: data.id || docSnap.id,
          timestamp: data.timestamp,
          type: data.type,
          naturalText: data.naturalText,
          speaker: data.speaker,
          confidence: data.confidence,
          bookmarked: data.bookmarked || false,
          tone: data.tone,
          aslGloss: data.aslGloss,
          rawSigns: data.rawSigns,
          tags: data.tags,
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveTranscriptToFirestore(userId: string, item: TranscriptItem): Promise<void> {
  const path = `users/${userId}/transcripts/${item.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'transcripts', item.id), {
      id: item.id,
      userId,
      timestamp: item.timestamp,
      type: item.type,
      naturalText: item.naturalText || '',
      speaker: item.speaker || 'Signer',
      confidence: item.confidence ?? 0.95,
      bookmarked: Boolean(item.bookmarked),
      tone: item.tone || 'neutral',
      aslGloss: item.aslGloss || '',
      rawSigns: item.rawSigns || [],
      tags: item.tags || ['meeting'],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleBookmarkInFirestore(
  userId: string,
  transcriptId: string,
  bookmarked: boolean
): Promise<void> {
  const path = `users/${userId}/transcripts/${transcriptId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'transcripts', transcriptId), {
      bookmarked,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTranscriptFromFirestore(userId: string, transcriptId: string): Promise<void> {
  const path = `users/${userId}/transcripts/${transcriptId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'transcripts', transcriptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// User Preferences & Background Blur Sync
export function subscribeUserPreferences(
  userId: string,
  onUpdate: (prefs: UserPreferences) => void
): Unsubscribe {
  const path = `users/${userId}/preferences/settings`;
  return onSnapshot(
    doc(db, 'users', userId, 'preferences', 'settings'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as UserPreferences);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveUserPreferencesToFirestore(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<void> {
  const path = `users/${userId}/preferences/settings`;
  try {
    await setDoc(
      doc(db, 'users', userId, 'preferences', 'settings'),
      {
        userId,
        backgroundBlur: prefs.backgroundBlur || 'off',
        backgroundBlurRadius: prefs.backgroundBlurRadius ?? 0,
        handedness: prefs.handedness || 'Right',
        highContrastMode: Boolean(prefs.highContrastMode),
        fontSize: prefs.fontSize || 'md',
        hapticsEnabled: prefs.hapticsEnabled !== false,
        soundCuesEnabled: prefs.soundCuesEnabled !== false,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Sign Practice Mastery Sync
export function subscribeUserMastery(
  userId: string,
  onUpdate: (mastery: Record<string, boolean>) => void
): Unsubscribe {
  const path = `users/${userId}/mastery`;
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const masteryMap: Record<string, boolean> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.signId && data.completed) {
          masteryMap[data.signId] = true;
        }
      });
      onUpdate(masteryMap);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveSignMasteryToFirestore(
  userId: string,
  signId: string,
  signName: string,
  bestScore: number
): Promise<void> {
  const path = `users/${userId}/mastery/${signId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'mastery', signId), {
      userId,
      signId,
      signName,
      bestScore,
      completed: bestScore >= 78,
      timestamp: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
