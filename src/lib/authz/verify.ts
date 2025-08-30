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
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new HttpError(401, 'unauthenticated');
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const claims = decoded as unknown as ClaimsShape;
    return { uid: decoded.uid, claims };
  } catch (e: any) {
    const code = String(e?.code || 'unauthenticated');
    if (code.includes('auth/id-token-expired')) throw new HttpError(440, 'login_timeout');
    throw new HttpError(401, 'unauthenticated');
  }
}

export function assertRole(min: Role, claims: ClaimsShape) {
  const order: Role[] = ['restricted','viewer','supporter','moderator','admin','super-admin'];
  const have = claims.role as Role | undefined;
  if (!have) throw new HttpError(403, 'forbidden');
  if (order.indexOf(have) < order.indexOf(min)) throw new HttpError(403, 'forbidden');
}

export function assertStatus(allowed: Status[], claims: ClaimsShape) {
  const st = (claims.status as Status | undefined) || 'Grace';
  if (!allowed.includes(st)) {
    if (st === 'Suspended') throw new HttpError(423, 'locked');
    throw new HttpError(403, 'forbidden');
  }
}

