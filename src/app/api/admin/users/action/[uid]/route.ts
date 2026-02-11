import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import { setClaims } from '@/lib/authz/claims';
import type { Role, Status } from '@/lib/authz/types';

export const runtime = 'nodejs';

type Action = 'suspend'|'ban'|'reinstate'|'changeRole'|'forceSignOut'|'forcePasswordReset'|'invalidateSessions'|'kycOverride'|'hardDelete';
const VALID_ROLES: Role[] = ['restricted', 'viewer', 'supporter', 'moderator', 'admin', 'super-admin'];

export const POST = withAuth(async (req, ctx?: { params?: { uid: string } } & any) => {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    const actorUid = (ctx?.uid as string) || '';
    const actorRole = (ctx?.role as string) || '';
    const body = await req.json();
    const action: Action = body?.action;
    const reason: string = String(body?.reason || '').trim();
    const targetRole: string | undefined = body?.role;
    const kyc: boolean | undefined = body?.kyc;
    if (!action) return NextResponse.json({ ok: false, error: 'missing_action' }, { status: 400 });
    if (['changeRole','suspend','ban','reinstate','kycOverride','forceSignOut','invalidateSessions','forcePasswordReset','hardDelete'].includes(action) && reason.length < 5) {
      return NextResponse.json({ ok: false, error: 'reason_required' }, { status: 400 });
    }

    const uid = (ctx?.params as any)?.uid as string;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const cur = (snap.data() as any) || {};

    // Permissions
    const isSuper = actorRole === 'super-admin';
    const hasAdminRole = actorRole === 'admin' || isSuper;
    if (!hasAdminRole) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    if (action === 'changeRole' && !isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const updates: any = {};
    const claimUpdates: { role?: Role; status?: Status; kycVerified?: boolean } = {};
    let shouldDeleteAuthUser = false;
    let audit: any = { by: actorUid, action, reason, at: FieldValue.serverTimestamp(), from: {}, to: {} };

    if (action === 'suspend') {
      updates.status = 'suspended';
      updates.suspendedAt = FieldValue.serverTimestamp();
      claimUpdates.status = 'Suspended';
    } else if (action === 'ban') {
      updates.status = 'banned';
      updates.bannedAt = FieldValue.serverTimestamp();
      claimUpdates.status = 'Banned';
    } else if (action === 'reinstate') {
      // Admin may reinstate; in stricter flows super-admin approves; for MVP allow admin
      updates.status = cur.kycVerified ? 'verified' : 'grace';
      updates.reinstatedAt = FieldValue.serverTimestamp();
      claimUpdates.status = cur.kycVerified ? 'Verified' : 'Grace';
    } else if (action === 'changeRole') {
      if (!targetRole || !VALID_ROLES.includes(targetRole as Role)) {
        return NextResponse.json({ ok: false, error: 'missing_role' }, { status: 400 });
      }
      updates.role = targetRole;
      claimUpdates.role = targetRole as Role;
    } else if (action === 'kycOverride') {
      if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      if (typeof kyc !== 'boolean') return NextResponse.json({ ok: false, error: 'missing_kyc' }, { status: 400 });
      updates.kycVerified = kyc;
      updates.kycOverriddenAt = FieldValue.serverTimestamp();
      claimUpdates.kycVerified = kyc;
    } else if (action === 'forceSignOut' || action === 'invalidateSessions') {
      await auth.revokeRefreshTokens(uid);
    } else if (action === 'forcePasswordReset') {
      // Generate link; returning is acceptable as sending email server-side is out-of-scope for provider change.
      const link = await auth.generatePasswordResetLink(cur.email || '');
      return NextResponse.json({ ok: true, link });
    } else if (action === 'hardDelete') {
      if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      updates.status = 'deleted';
      updates.deletedAt = FieldValue.serverTimestamp();
      updates.tombstoned = true;
      updates.fullName = 'Deleted User';
      updates.photoURL = null;
      updates.email = null;
      shouldDeleteAuthUser = true;
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

    if (Object.keys(claimUpdates).length) {
      await setClaims(uid, claimUpdates);
    }

    // If banned, also revoke sessions
    if (action === 'ban') {
      try { await auth.revokeRefreshTokens(uid); } catch {}
    }
    if (shouldDeleteAuthUser) {
      try { await auth.revokeRefreshTokens(uid); } catch {}
      try { await auth.deleteUser(uid); } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']), rateLimit: { userPerMin: 10, ipPerMin: 60 }, idempotent: true });
