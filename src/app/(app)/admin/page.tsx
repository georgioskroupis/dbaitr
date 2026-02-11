"use client";

import Link from 'next/link';
import * as React from 'react';
import { useAdminGate } from '@/hooks/use-admin-gate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminHomePage() {
  const { allowed, loading } = useAdminGate();

  if (loading || !allowed) {
    return (
      <div className="container mx-auto py-10">
        <p className="text-white/70">Checking admin access…</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold text-white mb-6">Admin Panel</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm mb-3">Search, review, and act on users.</p>
            <Link href="/admin/users" className="underline text-rose-300">Open Users</Link>
          </CardContent>
        </Card>
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
            <CardTitle className="text-white">Analysis Pills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 text-sm mb-3">Filter topics and apply pill overrides in bulk.</p>
            <Link href="/admin/analysis" className="underline text-rose-300">Open Analysis</Link>
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
