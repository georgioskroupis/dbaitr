import { getAuthAdmin, getAppCheckAdmin } from '@/lib/firebase/admin';
import type { ClaimsShape, Role, Status } from './types';

export class HttpError extends Error { constructor(public status: number, public code: string, message?: string) { super(message || code); } }

export async function verifyAppCheckStrict(req: Request): Promise<{ token: string }>{
  const ac = getAppCheckAdmin();
  const hdr = req.headers.get('X-Firebase-AppCheck') || req.headers.get('X-Firebase-AppCheck-Token');
  if (!hdr) throw new HttpError(401, 'unauthenticated_appcheck');
  try { await ac.verifyToken(hdr); return { token: hdr }; }
  catch { throw new HttpError(401, 'unauthenticated_appcheck'); }
}

export async function verifyIdTokenStrict(req: Request): Promise<{ uid: string; claims: ClaimsShape }>{
  const auth = getAuthAdmin();
  const authz = req.headers.get('authorization') || '';
  const match = authz.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';
  if (!token) throw new HttpError(401, 'unauthenticated');
  try {
    // Primary verification (signature/audience/issuer/expiry). Avoid hard dependency on revoke checks.
    const decoded = await auth.verifyIdToken(token);
    // Optional strict revocation check for environments that explicitly require it.
    if (String(process.env.AUTH_CHECK_REVOKED_STRICT || '') === '1') {
      try {
        await auth.verifyIdToken(token, true);
      } catch (revErr: any) {
        const revCode = String(revErr?.code || '');
        // Keep availability when revoke check infra is unavailable/misconfigured.
        if (revCode.includes('auth/id-token-revoked') || revCode.includes('auth/user-disabled')) {
          throw revErr;
        }
        try {
          console.warn(JSON.stringify({
            level: 'warn',
            where: 'verifyIdTokenStrict',
            error: 'revocation_check_unavailable',
            code: revCode || 'unknown',
          }));
        } catch {}
      }
    }
    const claims = decoded as unknown as ClaimsShape;
    return { uid: decoded.uid, claims };
  } catch (e: any) {
    const code = String(e?.code || 'unauthenticated');
    if (code.includes('auth/id-token-expired')) throw new HttpError(440, 'login_timeout');
    try {
      console.warn(JSON.stringify({
        level: 'warn',
        where: 'verifyIdTokenStrict',
        error: 'id_token_verify_failed',
        code,
      }));
    } catch {}
    throw new HttpError(401, 'unauthenticated');
  }
}

export function assertRole(min: Role, claims: ClaimsShape) {
  const order: Role[] = ['restricted','viewer','supporter','moderator','admin','super-admin'];
  const have = claims.role as Role | undefined;
  if (!have) {
    try { console.warn(JSON.stringify({ level: 'warn', where: 'assertRole', have: null, required: min })); } catch {}
    throw new HttpError(403, 'forbidden');
  }
  if (order.indexOf(have) < order.indexOf(min)) {
    try { console.warn(JSON.stringify({ level: 'warn', where: 'assertRole', have, required: min })); } catch {}
    throw new HttpError(403, 'forbidden');
  }
}

export function assertStatus(allowed: Status[], claims: ClaimsShape) {
  const st = (claims.status as Status | undefined) || 'Grace';
  if (!allowed.includes(st)) {
    try { console.warn(JSON.stringify({ level: 'warn', where: 'assertStatus', have: st, allowed })); } catch {}
    if (st === 'Suspended') throw new HttpError(423, 'locked');
    throw new HttpError(403, 'forbidden');
  }
}
