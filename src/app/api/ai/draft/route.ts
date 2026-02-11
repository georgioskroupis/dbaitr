import { NextResponse } from 'next/server';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { ai } from '@/ai/genkit';

export const runtime = 'nodejs';

export const POST = withAuth(async (req) => {
  try {
    const { topic, context, type } = await req.json();
    const prompt = `Write a concise ${type || 'statement'} for a debate.\nTopic: ${topic || ''}\nContext: ${context || ''}\nKeep it respectful and clear.`;
    const res = await ai.generate({ prompt });
    const text = (res?.output?.text || '').trim();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
