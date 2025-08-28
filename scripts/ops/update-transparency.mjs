#!/usr/bin/env node
// Aggregates transparency metrics and writes to analytics/transparency
// Usage: node scripts/ops/update-transparency.mjs
// Requires FIREBASE_SERVICE_ACCOUNT (JSON) or GOOGLE_APPLICATION_CREDENTIALS pointing to a key file

import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  let keyJson;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8').trim();
      if (decoded && decoded.startsWith('{')) {
        keyJson = JSON.parse(decoded);
      } else {
        // Fallback: some setups may mistakenly pass raw JSON in the B64 secret
        keyJson = JSON.parse(b64);
      }
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_B64 provided but failed to decode. Falling back to ADC/JSON env. Reason:', e.message);
    }
  }
  if (!keyJson && jsonStr) {
    try { keyJson = JSON.parse(jsonStr); } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON:', e.message);
    }
  }
  try {
    if (keyJson) {
      admin.initializeApp({ credential: admin.credential.cert(keyJson) });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS or GCE metadata
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
    return admin.app();
  } catch (e) {
    console.error('Failed to initialize Firebase Admin. Provide FIREBASE_SERVICE_ACCOUNT(_B64) or set GOOGLE_APPLICATION_CREDENTIALS to a valid key file.');
    throw e;
  }
}

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday start
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function startOfMonth(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [reportsSnap, actionsSnap, appealsSnap] = await Promise.all([
    db.collection('reports').get(),
    db.collection('moderation_actions').get(),
    db.collection('appeals').get(),
  ]);

  const countInRange = (snap, field = 'createdAt', after) => {
    let n = 0;
    snap.forEach(doc => {
      const d = doc.get(field);
      let dt;
      if (d && typeof d.toDate === 'function') dt = d.toDate();
      else if (d?.seconds) dt = new Date(d.seconds * 1000);
      else if (typeof d === 'string') dt = new Date(d);
      if (!dt) return;
      if (!after || dt >= after) n++;
    });
    return n;
  };

  const appealsStatus = (filterFn) => {
    let n = 0;
    appealsSnap.forEach(doc => { if (filterFn(doc.data())) n++; });
    return n;
  };

  const week = {
    reports: countInRange(reportsSnap, 'createdAt', weekStart),
    actions: countInRange(actionsSnap, 'createdAt', weekStart),
    appealsApproved: appealsStatus(a => a.status === 'resolved' && a.decision === 'approved' && (a.resolvedAt?.toDate?.() || new Date(a.resolvedAt || 0)) >= weekStart),
    appealsDenied: appealsStatus(a => a.status === 'resolved' && a.decision === 'denied' && (a.resolvedAt?.toDate?.() || new Date(a.resolvedAt || 0)) >= weekStart),
    appealsOpen: appealsStatus(a => a.status === 'open'),
  };

  const month = {
    reports: countInRange(reportsSnap, 'createdAt', monthStart),
    actions: countInRange(actionsSnap, 'createdAt', monthStart),
    appealsApproved: appealsStatus(a => a.status === 'resolved' && a.decision === 'approved' && (a.resolvedAt?.toDate?.() || new Date(a.resolvedAt || 0)) >= monthStart),
    appealsDenied: appealsStatus(a => a.status === 'resolved' && a.decision === 'denied' && (a.resolvedAt?.toDate?.() || new Date(a.resolvedAt || 0)) >= monthStart),
    appealsOpen: appealsStatus(a => a.status === 'open'),
  };

  const total = {
    reports: reportsSnap.size,
    actions: actionsSnap.size,
    appealsApproved: appealsStatus(a => a.status === 'resolved' && a.decision === 'approved'),
    appealsDenied: appealsStatus(a => a.status === 'resolved' && a.decision === 'denied'),
    appealsOpen: appealsStatus(a => a.status === 'open'),
  };

  const payload = {
    week,
    month,
    total,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('analytics').doc('transparency').set(payload, { merge: true });
  console.log('Updated analytics/transparency:', payload);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
