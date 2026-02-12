#!/usr/bin/env node
// Data minimization cleanup:
// - Delete reports with status == 'resolved' older than REPORTS_TTL_DAYS (default 180) by resolvedAt, then fallback to createdAt
// - Delete expired IDV challenge records older than IDV_CHALLENGE_RETENTION_DAYS (default 7)
// Usage: node scripts/ops/cleanup.mjs
// Auth: FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS

import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  let keyJson;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8').trim();
      keyJson = decoded.startsWith('{') ? JSON.parse(decoded) : JSON.parse(b64);
    } catch { /* fallthrough */ }
  }
  if (!keyJson && jsonStr) {
    try { keyJson = JSON.parse(jsonStr); } catch {}
  }
  if (keyJson) admin.initializeApp({ credential: admin.credential.cert(keyJson) });
  else admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return admin.app();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function deleteQuery(db, q, label, limitBatch = 300) {
  const snap = await q.get();
  if (snap.empty) return 0;
  let count = 0;
  const chunks = [];
  let batch = db.batch();
  let i = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    i++; count++;
    if (i >= limitBatch) { chunks.push(batch.commit()); batch = db.batch(); i = 0; }
  }
  if (i > 0) chunks.push(batch.commit());
  await Promise.all(chunks);
  console.log(`[cleanup] Deleted ${count} from ${label}`);
  return count;
}

async function main() {
  const app = initAdmin();
  const db = app.firestore();
  const REPORTS_TTL_DAYS = parseInt(process.env.REPORTS_TTL_DAYS || '180', 10);
  const IDV_CHALLENGE_RETENTION_DAYS = parseInt(process.env.IDV_CHALLENGE_RETENTION_DAYS || '7', 10);

  const reportsCutoff = daysAgo(REPORTS_TTL_DAYS);
  const challengeCutoffMs = Date.now() - IDV_CHALLENGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  // reports resolved by resolvedAt
  try {
    // Prefer resolvedAt when present
    await deleteQuery(
      db,
      db.collection('reports').where('status', '==', 'resolved').where('resolvedAt', '<', reportsCutoff),
      'reports(resolvedAt)'
    );
  } catch (e) {
    console.warn('[cleanup] reports(resolvedAt) query failed or no index:', e.message || e);
  }
  try {
    // Fallback by createdAt for resolved reports missing resolvedAt
    await deleteQuery(
      db,
      db.collection('reports').where('status', '==', 'resolved').where('createdAt', '<', reportsCutoff),
      'reports(createdAt)'
    );
  } catch (e) {
    console.warn('[cleanup] reports(createdAt) query failed or no index:', e.message || e);
  }

  // _private/idv/challenges cleanup by expiresAtMs
  try {
    await deleteQuery(
      db,
      db.collection('_private').doc('idv').collection('challenges').where('expiresAtMs', '<', challengeCutoffMs).limit(500),
      '_private/idv/challenges(expired)'
    );
  } catch (e) {
    console.warn('[cleanup] _private/idv/challenges query failed or no index:', e.message || e);
  }

  console.log('[cleanup] Done');
}

main().catch((e) => { console.error(e); process.exit(1); });
