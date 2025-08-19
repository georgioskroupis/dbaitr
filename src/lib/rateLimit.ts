type Key = string;

class SimpleRateLimiter {
  private windowMs: number;
  private max: number;
  private store: Map<Key, number[]> = new Map();

  constructor({ windowMs, max }: { windowMs: number; max: number }) {
    this.windowMs = windowMs;
    this.max = max;
  }

  check(key: Key): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const arr = this.store.get(key) || [];
    const recent = arr.filter((t) => t > windowStart);
    recent.push(now);
    this.store.set(key, recent);
    return recent.length <= this.max;
  }
}

export const globalRateLimiter = new SimpleRateLimiter({ windowMs: 15_000, max: 30 });

export function getClientKey(req: Request): string {
  try {
    // Use IP if available; fallback to user agent
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const ua = req.headers.get('user-agent') || 'unknown';
    return ip || ua;
  } catch {
    return 'unknown';
  }
}

