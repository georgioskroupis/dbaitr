"use client";
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http/client';
import { getAuth, getAppCheckToken } from '@/lib/firebase/client';
import { useAuth } from '@/context/AuthContext';

export function useAdminGate() {
  const router = useRouter();
  const [allowed, setAllowed] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const { loading: authLoading, user } = useAuth();
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (authLoading) return; // wait for auth state to settle
        // best-effort ensure we have an App Check token before first call
        await getAppCheckToken().catch(() => null);
        let headers: Record<string, string> | undefined = undefined;
        try {
          const u = getAuth().currentUser;
          if (u) {
            const t = await u.getIdToken();
            headers = { Authorization: `Bearer ${t}` };
          }
        } catch {}
        let res = await apiFetch('/api/admin/whoami', headers ? { headers } : undefined);
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j?.ok && (j.role === 'admin' || j.role === 'super-admin')) {
          setAllowed(true);
        } else if (!cancelled) {
          if (res.status === 401) {
            // quick retry after forcing tokens
            try {
              await getAppCheckToken(true).catch(() => null);
              const u2 = getAuth().currentUser;
              const hdr2 = u2 ? { Authorization: `Bearer ${await u2.getIdToken(true)}` } : undefined;
              res = await apiFetch('/api/admin/whoami', hdr2 ? { headers: hdr2 } : undefined);
            } catch {}
          }
          if (res.status === 401) router.replace('/errors/401?reason=unauthenticated');
          else if (res.status === 423) router.replace('/errors/423?reason=locked');
          else router.replace('/errors/403?reason=forbidden');
        }
      } catch {
        if (!cancelled) router.replace('/errors/401?reason=unauthenticated');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, authLoading, user?.uid]);
  return { allowed, loading } as const;
}
