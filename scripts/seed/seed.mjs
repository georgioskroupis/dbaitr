#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;

function getAdmin() {
  if (getApps().length) return getApp();
  // Resolve credentials from env or fallback file
  let creds;
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const file = path.join(process.cwd(), '.secrets', 'serviceAccount.json');
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
  if (!creds && fs.existsSync(file)) {
    try {
      creds = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
  }
  if (!creds || !creds.client_email) {
    console.error('FIREBASE_SERVICE_ACCOUNT not configured. Aborting.');
    process.exit(1);
  }
  return initializeApp({ credential: cert(creds) });
}

const app = getAdmin();
const db = getFirestore(app);

function parseCSV(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    // simple parser: split on commas not inside quotes
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur); cur=''; continue; }
      cur += ch;
    }
    cells.push(cur);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cells[idx] ?? '').trim());
    return obj;
  });
}

function slugify(title) {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
}

async function seedUsers(file) {
  const rows = parseCSV(file);
  for (const r of rows) {
    const ref = db.collection('users').doc(r.uid);
    await ref.set({
      uid: r.uid,
      email: r.email,
      fullName: r.fullName,
      kycVerified: String(r.kycVerified).toLowerCase() === 'true',
      createdAt: FieldValue.serverTimestamp(),
      registeredAt: FieldValue.serverTimestamp(),
      provider: 'password',
    }, { merge: true });
  }
  console.log(`Seeded ${rows.length} users`);
}

async function seedTopics(file) {
  const rows = parseCSV(file);
  for (const r of rows) {
    const ref = db.collection('topics').doc(r.id);
    await ref.set({
      title: r.title,
      description: r.description,
      createdBy: r.createdBy,
      createdAt: FieldValue.serverTimestamp(),
      scoreFor: 0,
      scoreAgainst: 0,
      scoreNeutral: 0,
      slug: slugify(r.title),
    }, { merge: true });
  }
  console.log(`Seeded ${rows.length} topics`);
}

async function seedStatements(file) {
  const rows = parseCSV(file);
  const scoreDelta = {}; // topicId -> {for: n, against: n, neutral: n}
  for (const r of rows) {
    const ref = db.collection('topics').doc(r.topicId).collection('statements').doc(r.id);
    await ref.set({
      topicId: r.topicId,
      createdBy: r.createdBy,
      content: r.content,
      position: r.position,
      aiConfidence: 0.9,
      createdAt: FieldValue.serverTimestamp(),
      lastEditedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    scoreDelta[r.topicId] = scoreDelta[r.topicId] || { for:0, against:0, neutral:0 };
    if (r.position === 'for') scoreDelta[r.topicId].for++;
    else if (r.position === 'against') scoreDelta[r.topicId].against++;
    else scoreDelta[r.topicId].neutral++;
  }
  // apply topic score updates
  const updates = Object.entries(scoreDelta);
  for (const [topicId, v] of updates) {
    const tref = db.collection('topics').doc(topicId);
    await tref.set({
      scoreFor: FieldValue.increment(v.for),
      scoreAgainst: FieldValue.increment(v.against),
      scoreNeutral: FieldValue.increment(v.neutral),
    }, { merge: true });
  }
  console.log(`Seeded ${rows.length} statements and updated topic scores`);
}

async function seedThreads(file) {
  const rows = parseCSV(file);
  for (const r of rows) {
    const ref = db.collection('topics').doc(r.topicId).collection('statements').doc(r.statementId).collection('threads').doc(r.id);
    await ref.set({
      topicId: r.topicId,
      statementId: r.statementId,
      parentId: r.parentId || null,
      content: r.content,
      createdBy: r.createdBy,
      type: r.type,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log(`Seeded ${rows.length} thread nodes`);
}

async function main() {
  const base = path.join(process.cwd(), 'scripts', 'seed', 'data');
  await seedUsers(path.join(base, 'users.csv'));
  await seedTopics(path.join(base, 'topics.csv'));
  await seedStatements(path.join(base, 'statements.csv'));
  await seedThreads(path.join(base, 'threads.csv'));
  console.log('Seeding complete. You can run backfill to compute sentiment.');
}

main().catch((e) => { console.error(e); process.exit(1); });
