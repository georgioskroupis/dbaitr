// Canonical Firebase Admin initialization (server only)
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApp, getApps, type App as AdminApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAppCheck, type AppCheck } from 'firebase-admin/app-check';

let app: AdminApp | null = null;
let resolvedProjectId: string | null = null;

function resolveProjectId(creds: any): string | undefined {
  if (resolvedProjectId) return resolvedProjectId;
  const fromEnv = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const fromCreds = String(creds?.project_id || '').trim();
  const fromPublicEnv = String(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  const picked = fromEnv || fromCreds || fromPublicEnv || '';
  resolvedProjectId = picked || null;
  return resolvedProjectId || undefined;
}

export function getAdminApp(): AdminApp {
  if (app) return app;
  if (getApps().length) return getApp();
  // Try FIREBASE_SERVICE_ACCOUNT JSON, then .secrets/serviceAccount.json, else ADC
  let creds: any = null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (raw) {
    try { creds = JSON.parse(raw); }
    catch { try { creds = JSON.parse(raw.replace(/\r?\n/g, '\\n')); } catch {}
    }
  }
  if (!creds) {
    const file = path.join(process.cwd(), '.secrets', 'serviceAccount.json');
    if (fs.existsSync(file)) {
      try { creds = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    }
  }
  const projectId = resolveProjectId(creds);
  app = creds?.client_email
    ? initializeApp({ credential: cert(creds), ...(projectId ? { projectId } : {}) })
    : initializeApp(projectId ? { projectId } : undefined);
  return app;
}

export function getAuthAdmin(): Auth { return getAuth(getAdminApp()); }
export function getDbAdmin(): Firestore { return getFirestore(getAdminApp()); }
export function getAppCheckAdmin(): AppCheck { return getAppCheck(getAdminApp()); }
export { FieldValue };
