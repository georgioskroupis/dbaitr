// Optional Firebase Admin initialization for server-only APIs (e.g., Stripe webhooks, claims)
import fs from 'node:fs';
import path from 'node:path';
import type { App as AdminApp } from 'firebase-admin/app';
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAppCheck, type AppCheck } from 'firebase-admin/app-check';

let adminApp: AdminApp | null = null;

export function getAdminApp(): AdminApp | null {
  if (adminApp) return adminApp;
  try {
    if (getApps().length) return getApp();
    // Resolve credentials from env or fallback file with some tolerance
    let creds: any = null;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    if (raw) {
      try {
        creds = JSON.parse(raw);
      } catch {
        try {
          // Attempt to sanitize accidental raw newlines in private_key
          creds = JSON.parse(raw.replace(/\r?\n/g, '\\n'));
        } catch {}
      }
    }
    if (!creds) {
      const file = path.join(process.cwd(), '.secrets', 'serviceAccount.json');
      if (fs.existsSync(file)) {
        try { creds = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
      }
    }
    if (creds && creds.client_email) {
      adminApp = initializeApp({ credential: cert(creds as any) });
      return adminApp;
    }
    // Fall back to Application Default Credentials (ADC) if no JSON provided
    adminApp = initializeApp();
    return adminApp;
  } catch (e) {
    return null;
  }
}

export function getAuthAdmin(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getDbAdmin(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export { FieldValue };

export function getAppCheckAdmin(): AppCheck | null {
  const app = getAdminApp();
  try {
    return app ? getAppCheck(app) : null;
  } catch {
    return null;
  }
}
