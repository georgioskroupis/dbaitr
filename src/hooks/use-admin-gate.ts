"use client";
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/http/client';

export function useAdminGate() {
  const router = useRouter();
  const [allowed, setAllowed] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/admin/whoami');
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j?.ok && (j.role === 'admin' || j.role === 'super-admin')) {
          setAllowed(true);
        } else if (!cancelled) {
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
  }, [router]);
  return { allowed, loading } as const;
}
