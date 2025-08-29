export const ANALYSIS_VERSION = {
  model: 'googleai/gemini-2.0-flash',
  prompt: 'v1.0-topic-pills',
};

export const PILL_MIN_CONFIDENCE = 0.65;
export const PILL_TIE_BREAK_DELTA = 0.10;
export const PILL_FLIP_COOLDOWN_MIN = 10; // minutes
export const PILL_INSTANT_JUMP = 0.20; // confidence jump to allow immediate flip
export const TREND_UP = 0.03;
export const TREND_DOWN = -0.03;

export const ENGAGEMENT = {
  shortWindowMin: 60, // minutes
  mediumWindowH: 24,
  longWindowD: 7,
  halfLifeH: 6,
  activeThreshold: 0.6,
};

export const DOMAIN_WEIGHTS: Record<string, number> = {
  'nytimes.com': 1.0,
  'nature.com': 1.0,
  'nih.gov': 1.0,
  'who.int': 1.0,
  'bbc.co.uk': 0.9,
  'reuters.com': 0.9,
};

export const FEATURE_FLAGS = {
  aiPills: true,
};

export function getDomainWeight(url: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return DOMAIN_WEIGHTS[host] ?? 0.5;
  } catch {
    return 0.5;
  }
}

