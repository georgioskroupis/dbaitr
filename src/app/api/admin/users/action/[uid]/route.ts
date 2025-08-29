import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

type Action = 'suspend'|'ban'|'reinstate'|'changeRole'|'forceSignOut'|'forcePasswordReset'|'invalidateSessions'|'kycOverride'|'hardDelete';

export async function POST(req: Request, { params }: { params: { uid: string } }) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const actorUid = decoded.uid;
    const actorRole = (decoded as any)?.role || '';
    const body = await req.json();
    const action: Action = body?.action;
    const reason: string = String(body?.reason || '').trim();
    const targetRole: string | undefined = body?.role;
    const kyc: boolean | undefined = body?.kyc;
    if (!action) return NextResponse.json({ ok: false, error: 'missing_action' }, { status: 400 });
    if (['changeRole','suspend','ban','reinstate','kycOverride','forceSignOut','invalidateSessions','forcePasswordReset'].includes(action) && reason.length < 5) {
      return NextResponse.json({ ok: false, error: 'reason_required' }, { status: 400 });
    }

    const uid = params.uid;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const cur = (snap.data() as any) || {};

    // Permissions
    const isSuper = actorRole === 'super-admin';
    const isAdmin = actorRole === 'admin' || isSuper;
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    if (action === 'changeRole' && !isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const updates: any = {};
    let audit: any = { by: actorUid, action, reason, at: FieldValue.serverTimestamp(), from: {}, to: {} };

    if (action === 'suspend') {
      updates.status = 'suspended';
      updates.suspendedAt = FieldValue.serverTimestamp();
    } else if (action === 'ban') {
      updates.status = 'banned';
      updates.bannedAt = FieldValue.serverTimestamp();
    } else if (action === 'reinstate') {
      // Admin may reinstate; in stricter flows super-admin approves; for MVP allow admin
      updates.status = cur.kycVerified ? 'verified' : 'grace';
      updates.reinstatedAt = FieldValue.serverTimestamp();
    } else if (action === 'changeRole') {
      if (!targetRole) return NextResponse.json({ ok: false, error: 'missing_role' }, { status: 400 });
      updates.role = targetRole;
      await auth.setCustomUserClaims(uid, { ...(cur.customClaims || {}), role: targetRole });
    } else if (action === 'kycOverride') {
      if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      if (typeof kyc !== 'boolean') return NextResponse.json({ ok: false, error: 'missing_kyc' }, { status: 400 });
      updates.kycVerified = kyc;
      updates.kycOverriddenAt = FieldValue.serverTimestamp();
    } else if (action === 'forceSignOut' || action === 'invalidateSessions') {
      await auth.revokeRefreshTokens(uid);
    } else if (action === 'forcePasswordReset') {
      // Generate link; returning is acceptable as sending email server-side is out-of-scope for provider change.
      const link = await auth.generatePasswordResetLink(cur.email || '');
      return NextResponse.json({ ok: true, link });
    } else if (action === 'hardDelete') {
      if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      try { await auth.deleteUser(uid); } catch {}
      updates.status = 'deleted';
      updates.deletedAt = FieldValue.serverTimestamp();
      updates.tombstoned = true;
      updates.fullName = 'Deleted User';
      updates.photoURL = null;
      updates.email = null;
      // revoke any lingering sessions
      try { await auth.revokeRefreshTokens(uid); } catch {}
    }

    // Compute before/after for audit
    audit.from = { role: cur.role || null, status: cur.status || null, kycVerified: !!cur.kycVerified };
    audit.to = { role: updates.role ?? cur.role ?? null, status: updates.status ?? cur.status ?? null, kycVerified: updates.kycVerified ?? !!cur.kycVerified };

    // Apply updates and write audit log
    const batch = db.batch();
    if (Object.keys(updates).length) batch.set(userRef, updates, { merge: true });
    const auditRef = userRef.collection('audit_logs').doc();
    batch.set(auditRef, audit, { merge: false });
    await batch.commit();

    // If banned, also revoke sessions
    if (action === 'ban') {
      try { await auth.revokeRefreshTokens(uid); } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
