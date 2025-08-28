// Server-side helper for Google Perspective API toxicity analysis
// Do not import this from client components.

export type PerspectiveScores = Record<string, number>;

export interface ToxicityResult {
  ok: boolean;
  scores: PerspectiveScores;
  maxLabel?: string;
  maxScore?: number;
}

export async function analyzeToxicity(text: string): Promise<ToxicityResult> {
  const key = process.env.PERSPECTIVE_API_KEY;
  if (!key || !text) return { ok: false, scores: {} };
  try {
    const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${encodeURIComponent(key)}`;
    const body = {
      comment: { text },
      languages: ['en'],
      doNotStore: true,
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        INSULT: {},
        THREAT: {},
        IDENTITY_ATTACK: {},
        PROFANITY: {},
      },
    } as const;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    const attr = (json?.attributeScores || {}) as Record<string, any>;
    const scores: PerspectiveScores = {};
    for (const k of Object.keys(attr)) {
      const v = attr[k]?.summaryScore?.value;
      if (typeof v === 'number') scores[k] = v;
    }
    let maxLabel: string | undefined;
    let maxScore: number | undefined;
    for (const [k, v] of Object.entries(scores)) {
      if (maxScore === undefined || v > maxScore) { maxScore = v; maxLabel = k; }
    }
    return { ok: true, scores, maxLabel, maxScore };
  } catch {
    return { ok: false, scores: {} };
  }
}

