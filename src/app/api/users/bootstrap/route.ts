import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';
import { setClaims } from '@/lib/authz/claims';
import type { Role, Status } from '@/lib/authz/types';

export const runtime = 'nodejs';

const FULL_NAME_MAX = 80;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const VALID_ROLES: Role[] = ['restricted', 'viewer', 'supporter', 'moderator', 'admin', 'super-admin'];
const VALID_STATUSES: Status[] = ['Grace', 'Verified', 'Suspended', 'Banned', 'Deleted'];

function normalizeFullName(value: unknown): string | null {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw || raw.length < 3 || raw.length > FULL_NAME_MAX) return null;
  const parts = raw.split(' ').filter(Boolean);
  if (parts.length < 2) return null;
  if (!/^[\p{L}\p{M}.'\- ]+$/u.test(raw)) return null;
  return raw;
}

function mapStatusForUserDoc(status: Status): 'grace' | 'verified' | 'suspended' | 'banned' | 'deleted' {
  switch (status) {
    case 'Verified':
      return 'verified';
    case 'Suspended':
      return 'suspended';
    case 'Banned':
      return 'banned';
    case 'Deleted':
      return 'deleted';
    default:
      return 'grace';
  }
}

function detectProvider(providerIds: string[] | undefined): 'password' | 'google' | 'apple' | 'unknown' {
  const providers = providerIds || [];
  if (providers.includes('password')) return 'password';
  if (providers.includes('google.com')) return 'google';
  if (providers.includes('apple.com')) return 'apple';
  return 'unknown';
}

function normalizeRole(value: unknown): Role | null {
  const role = String(value || '').trim() as Role;
  return VALID_ROLES.includes(role) ? role : null;
}

function normalizeStatus(value: unknown): Status | null {
  const status = String(value || '').trim() as Status;
  return VALID_STATUSES.includes(status) ? status : null;
}

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const uid = String(ctx?.uid || '');
    if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestedFullName = normalizeFullName(body?.fullName);

    const auth = getAuthAdmin();
    const db = getDbAdmin();
    const authUser = await auth.getUser(uid);
    const existingClaims = authUser.customClaims || {};
    const usersRef = db.collection('users').doc(uid);
    const usersSnap = await usersRef.get();
    const existingProfile = usersSnap.exists ? (usersSnap.data() as any) : null;

    const existingFullName = normalizeFullName(existingProfile?.fullName);
    const authDisplayName = normalizeFullName(authUser.displayName);
    const fullName = requestedFullName || existingFullName || authDisplayName;
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'full_name_required' }, { status: 422 });
    }

    const creationMs = Date.parse(authUser.metadata.creationTime || '');
    const derivedGraceUntilMs = Number.isFinite(creationMs) ? creationMs + TEN_DAYS_MS : null;
    const claimPatch: { role?: Role; status?: Status; kycVerified?: boolean; graceUntilMs?: number } = {};
    const roleFromClaims = normalizeRole(existingClaims.role);
    const statusFromClaims = normalizeStatus(existingClaims.status);
    const graceUntilFromClaims = typeof existingClaims.graceUntilMs === 'number'
      ? existingClaims.graceUntilMs
      : null;
    if (!roleFromClaims) claimPatch.role = 'viewer';
    if (!statusFromClaims) claimPatch.status = 'Grace';
    if (typeof existingClaims.kycVerified !== 'boolean') claimPatch.kycVerified = false;

    const effectiveStatusBeforePatch = (claimPatch.status || statusFromClaims || 'Grace') as Status;
    const effectiveKycBeforePatch = typeof claimPatch.kycVerified === 'boolean'
      ? claimPatch.kycVerified
      : !!existingClaims.kycVerified;
    if (effectiveStatusBeforePatch === 'Grace' && !graceUntilFromClaims && typeof derivedGraceUntilMs === 'number') {
      claimPatch.graceUntilMs = derivedGraceUntilMs;
    }
    const effectiveGraceUntilMs = typeof claimPatch.graceUntilMs === 'number'
      ? claimPatch.graceUntilMs
      : graceUntilFromClaims;
    if (
      effectiveStatusBeforePatch === 'Grace' &&
      !effectiveKycBeforePatch &&
      typeof effectiveGraceUntilMs === 'number' &&
      Date.now() > effectiveGraceUntilMs
    ) {
      claimPatch.status = 'Suspended';
    }

    if (Object.keys(claimPatch).length > 0) await setClaims(uid, claimPatch);

    const effectiveRole = claimPatch.role || roleFromClaims || 'viewer';
    const effectiveStatus = claimPatch.status || statusFromClaims || 'Grace';
    const effectiveKycVerified =
      typeof claimPatch.kycVerified === 'boolean'
        ? claimPatch.kycVerified
        : !!existingClaims.kycVerified;

    const now = FieldValue.serverTimestamp();
    const updatePayload: Record<string, unknown> = {
      uid,
      email: authUser.email ? authUser.email.toLowerCase() : null,
      fullName,
      provider: detectProvider(authUser.providerData.map((p) => p.providerId)),
      role: effectiveRole,
      status: mapStatusForUserDoc(effectiveStatus),
      kycVerified: effectiveKycVerified,
      updatedAt: now,
    };

    if (!usersSnap.exists) {
      updatePayload.createdAt = now;
      updatePayload.registeredAt = authUser.metadata.creationTime || now;
    } else if (!existingProfile?.registeredAt) {
      updatePayload.registeredAt = authUser.metadata.creationTime || now;
    }

    await usersRef.set(updatePayload, { merge: true });

    return NextResponse.json({
      ok: true,
      profile: {
        uid,
        email: updatePayload.email,
        fullName,
        role: effectiveRole,
        status: mapStatusForUserDoc(effectiveStatus),
        kycVerified: effectiveKycVerified,
        provider: updatePayload.provider,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { idempotent: true, rateLimit: { userPerMin: 10, ipPerMin: 60 } });
