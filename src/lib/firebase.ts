"use client";
// Unified Firebase client initialization with server guard (no top-level await)
import { logger } from '@/lib/logger';
import type { FirebaseApp } from 'firebase/app';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import type { Database } from 'firebase/database';
import { getDatabase } from 'firebase/database';

let app: FirebaseApp | any;
let auth: Auth | any;
let db: Firestore | any;
let storage: FirebaseStorage | any;
let rtdb: Database | any;

if (typeof window !== 'undefined') {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as const;

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  try { rtdb = getDatabase(app); } catch { rtdb = undefined; }

  setPersistence(auth, browserLocalPersistence).catch((error: any) => {
    logger.error('Firebase Auth persistence error:', error?.code, error?.message);
  });
} else {
  // Server-side: provide defensive proxies to avoid accidental use
  const fail = (name: string) => () => {
    throw new Error(`Firebase client SDK '${name}' accessed on the server. Use Admin SDK or API routes.`);
  };
  app = {};
  auth = new Proxy({}, { get: fail('auth') });
  db = new Proxy({}, { get: fail('firestore') });
  storage = new Proxy({}, { get: fail('storage') });
  rtdb = new Proxy({}, { get: fail('database') });
}

export { app, auth, db, storage, rtdb };
