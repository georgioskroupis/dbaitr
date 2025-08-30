export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const GET = withAuth(async () => {
  try {
    const db = getDbAdmin();
    const snap = await db.collection('analytics').doc('transparency').get();
    if (!snap.exists) return NextResponse.json({ ok: true, data: null });
    return NextResponse.json({ ok: true, data: snap.data() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { public: true });

