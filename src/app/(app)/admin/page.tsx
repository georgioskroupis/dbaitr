"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminHomePage() {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !isAdmin) {
      // Double-check with server before redirecting, in case token is stale
      (async () => {
        try {
          const { getAuth } = await import('firebase/auth');
          const u = getAuth().currentUser;
          if (u) {
            const t = await u.getIdToken();
            const res = await fetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${t}` } });
            const j = await res.json();
            if (j?.ok && j.role === 'admin') return; // allow access
          }
        } catch {}
        router.replace('/dashboard');
      })();
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <p className="text-white/70">Checking admin access…</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold text-white mb-6">Admin Panel</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Moderation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm mb-3">Review reports and system-flagged items.</p>
            <Link href="/admin/moderation" className="underline text-rose-300">Open Moderation</Link>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Appeals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm mb-3">Review and resolve user appeals.</p>
            <Link href="/admin/appeals" className="underline text-rose-300">Open Appeals</Link>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">YouTube Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm mb-3">Manage the global channel connection.</p>
            <Link href="/settings/integrations/youtube" className="underline text-rose-300">Open Integration</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
