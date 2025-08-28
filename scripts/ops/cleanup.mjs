#!/usr/bin/env node
// Data minimization cleanup:
// - Delete idv_attempts older than IDV_TTL_DAYS (default 90)
// - Delete reports with status == 'resolved' older than REPORTS_TTL_DAYS (default 180) by resolvedAt, then fallback to createdAt
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
  const IDV_TTL_DAYS = parseInt(process.env.IDV_TTL_DAYS || '90', 10);
  const REPORTS_TTL_DAYS = parseInt(process.env.REPORTS_TTL_DAYS || '180', 10);

  const idvCutoff = daysAgo(IDV_TTL_DAYS);
  const reportsCutoff = daysAgo(REPORTS_TTL_DAYS);

  // idv_attempts by timestamp
  try {
    await deleteQuery(db, db.collection('idv_attempts').where('timestamp', '<', idvCutoff), 'idv_attempts');
  } catch (e) {
    console.error('[cleanup] idv_attempts failed:', e.message || e);
  }

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

  console.log('[cleanup] Done');
}

main().catch((e) => { console.error(e); process.exit(1); });

