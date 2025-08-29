"use client";

import * as React from 'react';
import { onAuthStateChanged, type User, getAuth } from 'firebase/auth';

export function useIsAdmin() {
  const [user, setUser] = React.useState<User | null>(null);
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let unsub: (() => void) | undefined;
    try {
      const a = getAuth();
      unsub = onAuthStateChanged(a, (u) => setUser(u));
    } catch {
      // If Firebase isn't initialized yet, retry on next tick
      const id = setTimeout(() => {
        try {
          const a2 = getAuth();
          unsub = onAuthStateChanged(a2, (u) => setUser(u));
        } catch {}
      }, 0);
      return () => clearTimeout(id);
    }
    return () => { if (unsub) unsub(); };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (user) {
          await user.getIdToken(true);
          const r = await user.getIdTokenResult();
          const role = (r?.claims as any)?.role;
          if (!cancelled) setIsAdmin(role === 'admin');
          if (!cancelled && role !== 'admin') {
            try {
              const t = await user.getIdToken();
              const res = await fetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${t}` } });
              if (res.ok) {
                const j = await res.json();
                if (j?.ok && j.role === 'admin') {
                  setIsAdmin(true);
                  await user.getIdToken(true);
                }
              }
            } catch {}
          }
        } else if (!cancelled) {
          setIsAdmin(false);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, loading } as const;
}
