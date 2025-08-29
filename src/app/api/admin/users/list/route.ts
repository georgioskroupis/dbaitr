import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const role = (decoded as any)?.role || '';
    if (role !== 'admin' && role !== 'super-admin') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const { q = '', filters = {}, sortBy = 'createdAt', sortDir = 'desc', page = 1, pageSize = 20 } = body || {};

    // We use a pragmatic query strategy:
    // - Exact email/uid lookup if q matches patterns
    // - Otherwise, apply available filters and server-side sort on a single field
    // - For fuzzy name, we fallback to prefix match on a cached lowercased field if available; otherwise client filters after fetch
    const users = db.collection('users');
    let qRef: FirebaseFirestore.Query = users;
    let total = 0;

    const emailLike = typeof q === 'string' && q.includes('@') ? q.trim().toLowerCase() : '';
    const uidLike = typeof q === 'string' && q.length >= 24 && q.length <= 128 ? q.trim() : '';

    if (emailLike) {
      qRef = qRef.where('email', '==', emailLike);
    } else if (uidLike && !filters.role && !filters.status) {
      // Direct doc lookup for uid
      const snap = await users.doc(uidLike).get();
      const item = snap.exists ? toRow(uidLike, snap.data() as any) : null;
      return NextResponse.json({ ok: true, items: item ? [item] : [], total: item ? 1 : 0 });
    }

    // Filters
    if (filters.role) qRef = qRef.where('role', '==', String(filters.role));
    if (filters.status) qRef = qRef.where('status', '==', String(filters.status));
    if (filters.kyc === 'true') qRef = qRef.where('kycVerified', '==', true);
    if (filters.kyc === 'false') qRef = qRef.where('kycVerified', '==', false);
    if (filters.provider) qRef = qRef.where('provider', '==', String(filters.provider));

    // Sort (single field ordering); ensure field exists
    const dir = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    qRef = qRef.orderBy(sortBy, dir === 'asc' ? 'asc' : 'desc');

    // Pagination via offset; acceptable for MVP admin scale (documented)
    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
    const limitN = Math.max(1, Math.min(100, Number(pageSize)));
    const all = await qRef.limit(offset + limitN).get();
    const docs = all.docs.slice(offset);
    total = all.size; // approximate; Firestore has no count() here without aggregation; acceptable for MVP

    let items = docs.map(d => toRow(d.id, d.data() as any));
    // Fuzzy name fallback: if q present and not email/uid, filter client-side contains on fullName
    if (q && !emailLike && !uidLike) items = items.filter(x => (x.fullName || '').toLowerCase().includes(String(q).toLowerCase()));

    return NextResponse.json({ ok: true, items, total });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

function toRow(uid: string, d: any) {
  return {
    uid,
    email: (d?.email || '').toLowerCase() || null,
    fullName: d?.fullName || null,
    role: d?.role || null,
    status: d?.status || null,
    kycVerified: !!d?.kycVerified,
    createdAt: tsToIso(d?.createdAt) || null,
    provider: d?.provider || null,
    lastActiveAt: tsToIso(d?.lastActiveAt) || null,
    flagsCount: typeof d?.flagsCount === 'number' ? d.flagsCount : 0,
  };
}

function tsToIso(ts: any): string | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toISOString();
    if (typeof ts === 'string') return ts;
    if (ts instanceof Date) return ts.toISOString();
  } catch {}
  return null;
}

