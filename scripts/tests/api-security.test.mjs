#!/usr/bin/env node
/*
  Emulator-backed API security contract tests.
  These validate Firestore rule boundaries that API routes rely on:
  - server-only collections are not writable by clients
  - privileged liveDebates fields cannot be client-written
  - private namespaces remain inaccessible to clients
*/
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'node:fs';

async function run() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('API security tests skipped: FIRESTORE_EMULATOR_HOST not set.');
    return;
  }

  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const env = await initializeTestEnvironment({
    projectId: 'demo-test-api-security',
    firestore: { rules },
  });

  const ctx = (uid, claims) => env.authenticatedContext(uid, claims).firestore();

  // Seed documents that represent server/API writes.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('reports').doc('r1').set({ reason: 'seeded', status: 'open' });
    await db.collection('liveDebates').doc('ld1').set({
      createdBy: 'owner1',
      title: 'Debate',
      description: 'seeded',
    });
    await db.collection('liveRooms').doc('ld1').set({
      title: 'Debate Room',
      hostUid: 'owner1',
      status: 'scheduled',
      settings: { supporterOnly: false, slowModeSec: 0 },
    });
    await db.collection('liveRooms').doc('ld1').collection('messages').doc('m1').set({
      uid: 'owner1',
      role: 'host',
      text: 'seed',
      createdAt: new Date(),
    });
  });

  const viewer = ctx('v1', { role: 'viewer', status: 'Verified' });
  const supporter = ctx('s1', { role: 'supporter', status: 'Verified' });
  const moderator = ctx('m1', { role: 'moderator', status: 'Verified' });
  const admin = ctx('a1', { role: 'admin', status: 'Verified' });
  const owner = ctx('owner1', { role: 'supporter', status: 'Verified' });
  const superAdmin = ctx('sa1', { role: 'super-admin', status: 'Verified' });

  // reports are server-only writes; moderators can read.
  await assertFails(viewer.collection('reports').doc('r2').set({ reason: 'x' }));
  await assertFails(moderator.collection('reports').doc('r2').set({ reason: 'x' }));
  await assertSucceeds(moderator.collection('reports').doc('r1').get());

  // users profile documents are server-owned creates.
  await assertFails(viewer.collection('users').doc('v1').set({ uid: 'v1', email: 'v1@example.com' }));

  // server-only collections used by privileged APIs must remain client-denied.
  await assertFails(viewer.collection('_private').doc('idv').collection('challenges').doc('c1').set({ uid: 'v1' }));
  await assertFails(viewer.collection('_private').doc('idv').collection('nullifierHashes').doc('n1').set({ uid: 'v1' }));
  await assertFails(viewer.collection('admin_operations').doc('op1').set({ ok: true }));
  await assertFails(viewer.collection('moderation_actions').doc('ma1').set({ action: 'clear_flag' }));
  await assertFails(superAdmin.collection('admin_operations').doc('op2').set({ ok: true }));

  // Private namespace must remain inaccessible to clients.
  await assertFails(admin.collection('_private').doc('youtubeTokens').collection('global').doc('host').get());
  await assertFails(admin.collection('_private').doc('youtubeTokens').collection('global').doc('host').set({ refreshToken: 'x' }));

  // liveDebates create path: supporter+Verified only, and client must not write youtube/status fields.
  await assertSucceeds(supporter.collection('liveDebates').doc('ld2').set({
    createdBy: 's1',
    title: 'Safe Create',
    description: 'ok',
  }));
  await assertFails(supporter.collection('liveDebates').doc('ld3').set({
    createdBy: 's1',
    title: 'Bad Create',
    youtube: { streamId: 'forbidden' },
  }));
  await assertFails(supporter.collection('liveDebates').doc('ld4').set({
    createdBy: 's1',
    title: 'Bad Create 2',
    status: 'live',
  }));

  // liveDebates update path: owner/admin may update non-privileged fields only.
  await assertSucceeds(owner.collection('liveDebates').doc('ld1').set({ title: 'Owner Edit' }, { merge: true }));
  await assertFails(owner.collection('liveDebates').doc('ld1').set({ youtube: { streamId: 'nope' } }, { merge: true }));
  await assertSucceeds(admin.collection('liveDebates').doc('ld1').set({ description: 'Admin Edit' }, { merge: true }));
  await assertFails(admin.collection('liveDebates').doc('ld1').set({ status: 'live' }, { merge: true }));

  // admin/** and analysis/** stay non-writable by clients.
  await assertFails(admin.collection('admin').doc('x').set({ any: 1 }));
  await assertFails(viewer.collection('analysis').doc('x').set({ any: 1 }));

  // liveRooms/messages are client-read-only; writes must go through server APIs.
  await assertSucceeds(viewer.collection('liveRooms').doc('ld1').get());
  await assertSucceeds(viewer.collection('liveRooms').doc('ld1').collection('messages').doc('m1').get());
  await assertFails(viewer.collection('liveRooms').doc('ld1').set({ title: 'nope' }, { merge: true }));
  await assertFails(viewer.collection('liveRooms').doc('ld1').collection('messages').doc('m2').set({ text: 'nope' }));

  await env.cleanup();
  console.log('API security tests passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
