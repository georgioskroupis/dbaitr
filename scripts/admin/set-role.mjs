#!/usr/bin/env node
// Set a Firebase Auth custom role claim for a user.
// Usage:
//   UID=yourUid ROLE=admin node scripts/admin/set-role.mjs
//   node scripts/admin/set-role.mjs --uid yourUid --role admin
//   node scripts/admin/set-role.mjs --email user@example.com --role admin

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length) return getApp();
  let creds = null;
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
  if (creds && creds.client_email) {
    return initializeApp({ credential: cert(creds) });
  }
  // Fallback to ADC
  return initializeApp();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { uid: process.env.UID || null, email: process.env.EMAIL || null, role: process.env.ROLE || null };
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    if (k === '--uid') out.uid = args[++i];
    else if (k === '--email') out.email = args[++i];
    else if (k === '--role') out.role = args[++i];
  }
  return out;
}

async function main() {
  const { uid, email, role } = parseArgs();
  if (!role || (!uid && !email)) {
    console.error('Usage: node scripts/admin/set-role.mjs (--uid UID | --email EMAIL) --role ROLE');
    process.exit(1);
  }
  initAdmin();
  const auth = getAuth();
  let user = null;
  try {
    user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
  } catch (e) {
    console.error('Failed to find user:', e?.message || e);
    process.exit(1);
  }
  const claims = user.customClaims || {};
  const newClaims = { ...claims, role };
  await auth.setCustomUserClaims(user.uid, newClaims);
  console.log(`Set role for ${user.uid} (${user.email || 'no-email'}) → ${role}`);
  console.log('Note: The user must refresh their ID token (sign out/in, or call getIdToken(true)).');
}

main().catch((e) => { console.error(e); process.exit(1); });

