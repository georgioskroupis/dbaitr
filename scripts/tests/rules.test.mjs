#!/usr/bin/env node
// Minimal Firestore Rules emulator tests for roles/status.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'node:fs';

async function run() {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const env = await initializeTestEnvironment({
    projectId: 'demo-test',
    firestore: { rules },
  });
  const mk = (claims) => env.authenticatedContext('u1', claims).firestore();
  const unauth = env.unauthenticatedContext().firestore();

  // Public read topics
  await assertSucceeds(unauth.collection('topics').doc('t1').get());

  // Viewer Grace can create topic
  await assertSucceeds(mk({ role: 'viewer', status: 'Grace' }).collection('topics').add({ createdBy: 'u1', title: 'x' }));
  // Suspended cannot create
  await assertFails(mk({ role: 'viewer', status: 'Suspended' }).collection('topics').add({ createdBy: 'u1', title: 'x' }));
  // Moderator can update topic (non-analysis fields)
  await assertSucceeds(mk({ role: 'moderator', status: 'Verified' }).collection('topics').doc('t2').set({ title: 'y' }, { merge: true }));

  // Admin area denied
  await assertFails(mk({ role: 'admin', status: 'Verified' }).collection('admin').doc('x').set({ a: 1 }));

  await env.cleanup();
  console.log('Rules tests passed.');
}
run().catch((e) => { console.error(e); process.exit(1); });

