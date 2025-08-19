type Fn = (...args: any[]) => void;

function isBrowser() {
  return typeof window !== 'undefined';
}

function debugEnabled(): boolean {
  try {
    // Prefer runtime-togglable flags
    if (isBrowser()) {
      const ls = window.localStorage?.getItem('DEBUG');
      if (ls === '1' || ls === 'true') return true;
      // Query param one-shot enables localStorage
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        try { window.localStorage?.setItem('DEBUG', '1'); } catch {}
        return true;
      }
      // Allow a global toggle
      // @ts-ignore
      if ((window as any).__DEBUG__ === true) return true;
    }
    // Fall back to env vars (baked for client, runtime on server)
    // eslint-disable-next-line no-constant-condition
    const envFlag = (process.env.NEXT_PUBLIC_DEBUG || process.env.DEBUG) as string | undefined;
    if (envFlag && (envFlag === '1' || envFlag.toLowerCase?.() === 'true')) return true;
  } catch {}
  return false;
}

const base = {
  debug: ((...args) => { if (debugEnabled()) console.debug(...args); }) as Fn,
  info: ((...args) => { if (debugEnabled()) console.info(...args); }) as Fn,
  warn: ((...args) => console.warn(...args)) as Fn,
  error: ((...args) => console.error(...args)) as Fn,
};

export const logger = base;

