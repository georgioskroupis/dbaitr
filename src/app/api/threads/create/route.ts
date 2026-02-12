import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { analyzeToxicity } from '@/lib/perspective';
import { getClientKey, postIpLimiter, postUserLimiter } from '@/lib/rateLimit';
import { withinGraceWindow } from '@/lib/authz/grace';

export const runtime = 'nodejs';

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    const uid = ctx.uid;

    const { topicId, statementId, statementAuthorId, parentId, content, type, aiAssisted } = await req.json();
    if (!topicId || !statementId || !content || !type) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    if (type !== 'question' && type !== 'response') return NextResponse.json({ ok: false, error: 'bad_type' }, { status: 400 });

    // Cross-endpoint rate limiting (per IP + per user)
    const ipKey = `ip:${getClientKey(req)}`;
    if (!postIpLimiter.check(ipKey)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    if (!postUserLimiter.check(`user:${uid}`)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

    // Gate: KYC claims or immutable account-creation grace period.
    // Per-topic strict policy disables grace
    let requireStrict = false;
    try {
      const tSnap = await db.collection('topics').doc(topicId).get();
      const t = (tSnap.exists ? (tSnap.data() as any) : {}) || {};
      requireStrict = !!(t?.postingPolicy?.requireVerified || t?.requireVerifiedNow || t?.sensitive);
    } catch {}
    let ok = !!ctx?.kycVerified;
    if (!ok && !requireStrict) {
      try {
        const userRecord = await getAuthAdmin().getUser(uid);
        ok = withinGraceWindow(userRecord?.metadata?.creationTime || null);
      } catch {
        ok = false;
      }
    }
    if (!ok) return NextResponse.json({ ok: false, error: 'kyc_required' }, { status: 403 });

    // Enforce question limits and response rights
    if (type === 'question') {
      const snap = await db.collection('topics').doc(topicId).collection('statements').doc(statementId)
        .collection('threads').where('createdBy', '==', uid).where('type', '==', 'question').get();
      if (snap.size >= 3) return NextResponse.json({ ok: false, error: 'limit' }, { status: 403 });
    } else if (type === 'response') {
      if (!statementAuthorId || uid !== statementAuthorId) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    // Load dynamic moderation thresholds (fallback to defaults)
    let blockThreshold = 0.90;
    let flagThreshold = 0.75;
    try {
      const settingsDoc = await db.collection('settings').doc('moderation').get();
      const cfg = settingsDoc.exists ? (settingsDoc.data() as any) : null;
      if (cfg?.blockThreshold && typeof cfg.blockThreshold === 'number') blockThreshold = cfg.blockThreshold;
      if (cfg?.flagThreshold && typeof cfg.flagThreshold === 'number') flagThreshold = cfg.flagThreshold;
    } catch {}

    // Toxicity filter via Perspective API
    try {
      const tox = await analyzeToxicity(String(content || ''));
      if (tox.ok) {
        const max = tox.maxScore || 0;
        const label = tox.maxLabel || 'TOXICITY';
        if (max >= blockThreshold) {
          return NextResponse.json({ ok: false, error: 'toxicity', label, score: max }, { status: 422 });
        }
      }
    } catch {}

    const ref = await db.collection('topics').doc(topicId).collection('statements').doc(statementId)
      .collection('threads').add({
        topicId,
        statementId,
        statementAuthorId: statementAuthorId || null,
        parentId: parentId || null,
        content,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        type,
        ...(aiAssisted ? { aiAssisted: true } : {}),
      });
    // Store moderation flags if needed (non-blocking)
    try {
      const tox = await analyzeToxicity(String(content || ''));
      if (tox.ok && (tox.maxScore || 0) >= flagThreshold) {
        await ref.set({ moderation: { flagged: true, reason: 'toxicity', maxLabel: tox.maxLabel, maxScore: tox.maxScore, scores: tox.scores } }, { merge: true });
      }
    } catch {}
    // Detect AI assistance probability (best-effort)
    try {
      const key = process.env.HUGGINGFACE_API_KEY;
      if (key) {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/ai/detect-assist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content }) });
        const j = await resp.json();
        if (j?.ok && typeof j?.prob === 'number') {
          await ref.set({ aiAssistProb: j.prob, ...(j.prob > 0.7 ? { aiAssisted: true } : {}) }, { merge: true });
        }
      }
    } catch {}
    // Trigger topic analysis (debounced)
    try {
      const { markAnalysisRequested, markDiscussionOverviewRequested } = await import('@/lib/server/analysis');
      await markAnalysisRequested(topicId);
      await markDiscussionOverviewRequested(topicId);
    } catch {}
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
