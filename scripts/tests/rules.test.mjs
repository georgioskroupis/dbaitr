#!/usr/bin/env node
// Firestore Rules emulator tests for roles/status across core collections.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'node:fs';

async function run() {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-test', firestore: { rules } });
  const unauth = env.unauthenticatedContext().firestore();
  const ctx = (uid, claims) => env.authenticatedContext(uid, claims).firestore();

  // Public reads
  await assertSucceeds(unauth.collection('topics').doc('t1').get());

  // Matrix helpers
  const roles = ['restricted','viewer','moderator','admin','super-admin'];
  const statuses = ['Grace','Verified','Suspended','Banned'];

  // users
  await assertFails(unauth.collection('users').doc('u1').get());
  await assertSucceeds(ctx('u1', { role: 'viewer', status: 'Verified' }).collection('users').doc('u1').get());
  await assertFails(ctx('u2', { role: 'viewer', status: 'Verified' }).collection('users').doc('u1').get());
  await assertSucceeds(ctx('admin1', { role: 'admin', status: 'Verified' }).collection('users').doc('u1').get());

  // user_private owner only (admins also allowed)
  await assertSucceeds(ctx('u1', { role: 'viewer', status: 'Grace' }).collection('user_private').doc('u1').set({ claimsChangedAt: 'x' }));
  await assertFails(ctx('u2', { role: 'viewer', status: 'Grace' }).collection('user_private').doc('u1').set({ a: 1 }));

  // topics create
  await assertSucceeds(ctx('u1', { role: 'viewer', status: 'Grace' }).collection('topics').add({ createdBy: 'u1', title: 't' }));
  await assertFails(ctx('u1', { role: 'viewer', status: 'Suspended' }).collection('topics').add({ createdBy: 'u1', title: 't' }));

  // statements create/update (owner or mod)
  const dbv = ctx('u1', { role: 'viewer', status: 'Verified' });
  const tRef = dbv.collection('topics').doc('T');
  await assertSucceeds(tRef.set({ createdBy: 'u1', title: 'T' }));
  await assertSucceeds(tRef.collection('statements').add({ createdBy: 'u1', content: 'c' }));
  const modDb = ctx('m1', { role: 'moderator', status: 'Verified' });
  await assertSucceeds(modDb.collection('topics').doc('T').collection('statements').doc('S').set({ moderation: { flagged: true } }, { merge: true }));

  // threads create: Verified or Grace; Suspended denied
  await assertSucceeds(dbv.collection('topics').doc('TX').collection('statements').doc('SX').collection('threads').add({ createdBy: 'u1', topicId: 'TX', statementId: 'SX', content: 'q', type: 'question' }));
  await assertFails(ctx('u1', { role: 'viewer', status: 'Suspended' }).collection('topics').doc('TY').collection('statements').doc('SY').collection('threads').add({ createdBy: 'u1', topicId: 'TY', statementId: 'SY', content: 'q', type: 'question' }));

  // admin/** and analysis/** denied to client writes
  await assertFails(ctx('admin1', { role: 'admin', status: 'Verified' }).collection('admin').doc('x').set({ any: 1 }));
  await assertFails(ctx('admin1', { role: 'admin', status: 'Verified' }).collection('analysis').doc('x').set({ any: 1 }));

  await env.cleanup();
  console.log('Rules tests passed.');
}
run().catch((e) => { console.error(e); process.exit(1); });
