import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import { ai } from '@/ai/genkit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    if (!auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    await auth.verifyIdToken(token);
    const { topic, context, type } = await req.json();
    const prompt = `Write a concise ${type || 'statement'} for a debate.\nTopic: ${topic || ''}\nContext: ${context || ''}\nKeep it respectful and clear.`;
    const res = await ai.generate({ prompt });
    const text = (res?.output?.text || '').trim();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

