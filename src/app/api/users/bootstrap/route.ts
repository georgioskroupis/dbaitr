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

function detectProviderFromSignInProvider(value: unknown): 'password' | 'google' | 'apple' | 'unknown' {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'password') return 'password';
  if (provider === 'google.com') return 'google';
  if (provider === 'apple.com') return 'apple';
  return 'unknown';
}

function toEpochMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    const v = value as any;
    if (typeof v.toDate === 'function') {
      const d = v.toDate();
      const ms = d instanceof Date ? d.getTime() : NaN;
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  return null;
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
    const db = getDbAdmin();
    const tokenClaims = ((ctx?.claims || {}) as any) || {};
    const tokenEmail = typeof tokenClaims?.email === 'string' ? tokenClaims.email.toLowerCase() : null;
    const tokenDisplayName = normalizeFullName(tokenClaims?.name);
    const tokenProvider = detectProviderFromSignInProvider(tokenClaims?.firebase?.sign_in_provider);

    let authUser: any = null;
    let existingClaims = tokenClaims;
    try {
      const auth = getAuthAdmin();
      authUser = await auth.getUser(uid);
      existingClaims = authUser.customClaims || tokenClaims;
    } catch (e: any) {
      try {
        console.warn(JSON.stringify({
          level: 'warn',
          route: '/api/users/bootstrap',
          error: 'auth_user_lookup_failed',
          code: String(e?.code || 'unknown'),
        }));
      } catch {}
    }

    const usersRef = db.collection('users').doc(uid);
    const usersSnap = await usersRef.get();
    const existingProfile = usersSnap.exists ? (usersSnap.data() as any) : null;

    const existingFullName = normalizeFullName(existingProfile?.fullName);
    const authDisplayName = normalizeFullName(authUser?.displayName);
    const fullName = requestedFullName || existingFullName || authDisplayName || tokenDisplayName;
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'full_name_required' }, { status: 422 });
    }

    const creationMs =
      toEpochMs(authUser?.metadata?.creationTime) ||
      toEpochMs(existingProfile?.createdAt) ||
      Date.now();
    const derivedGraceUntilMs = creationMs + TEN_DAYS_MS;
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

    if (Object.keys(claimPatch).length > 0) {
      try {
        await setClaims(uid, claimPatch);
      } catch (e: any) {
        try {
          console.warn(JSON.stringify({
            level: 'warn',
            route: '/api/users/bootstrap',
            error: 'set_claims_failed',
            code: String(e?.code || 'unknown'),
          }));
        } catch {}
      }
    }

    const effectiveRole = claimPatch.role || roleFromClaims || 'viewer';
    const effectiveStatus = claimPatch.status || statusFromClaims || 'Grace';
    const effectiveKycVerified =
      typeof claimPatch.kycVerified === 'boolean'
        ? claimPatch.kycVerified
        : !!existingClaims.kycVerified;

    const authEmail = typeof authUser?.email === 'string' ? authUser.email.toLowerCase() : null;
    const profileEmail = typeof existingProfile?.email === 'string' ? existingProfile.email.toLowerCase() : null;
    const authProvider = authUser
      ? detectProvider(Array.isArray(authUser.providerData) ? authUser.providerData.map((p: any) => p.providerId) : [])
      : 'unknown';
    const existingProvider = String(existingProfile?.provider || '').trim();

    const now = FieldValue.serverTimestamp();
    const updatePayload: Record<string, unknown> = {
      uid,
      email: authEmail || profileEmail || tokenEmail || null,
      fullName,
      provider:
        authProvider !== 'unknown'
          ? authProvider
          : (existingProvider === 'password' || existingProvider === 'google' || existingProvider === 'apple'
            ? existingProvider
            : tokenProvider),
      role: effectiveRole,
      status: mapStatusForUserDoc(effectiveStatus),
      kycVerified: effectiveKycVerified,
      updatedAt: now,
    };

    if (!usersSnap.exists) {
      updatePayload.createdAt = now;
      updatePayload.registeredAt = authUser?.metadata?.creationTime || now;
    } else if (!existingProfile?.registeredAt) {
      updatePayload.registeredAt = authUser?.metadata?.creationTime || now;
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
  } catch (e: any) {
    try {
      console.error(JSON.stringify({
        level: 'error',
        route: '/api/users/bootstrap',
        error: 'bootstrap_failed',
        code: String(e?.code || 'unknown'),
        message: String(e?.message || ''),
      }));
    } catch {}
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { idempotent: true, rateLimit: { userPerMin: 10, ipPerMin: 60 } });
