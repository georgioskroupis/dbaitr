"use client";
import * as React from 'react';
import { apiFetch } from '@/lib/http/client';
import { useAdminGate } from '@/hooks/use-admin-gate';

export default function AdminDiagnosticsPage() {
  const { allowed, loading } = useAdminGate();
  const [items, setItems] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!allowed || loading) return;
    (async () => {
      setBusy(true);
      try {
        const r = await apiFetch('/api/admin/diagnostics');
        const j = await r.json();
        if (j?.ok) setItems(j.items || []);
      } finally { setBusy(false); }
    })();
  }, [allowed, loading]);
  if (loading || !allowed) return <div className="container mx-auto py-8"><p className="text-white/70">Checking admin access…</p></div>;
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-semibold text-white mb-4">Auth/App Check Diagnostics</h1>
      {busy ? <p className="text-white/70">Loading…</p> : (
        <div className="space-y-2">
          {items.length === 0 ? <p className="text-white/70">No recent denials.</p> : items.map((it) => (
            <div key={it.id} className="text-sm text-white/80 border border-white/10 rounded p-2 bg-black/30">
              <div><span className="text-white/60">At:</span> {new Date(it.at?._seconds? it.at._seconds*1000: it.at).toLocaleString()}</div>
              <div><span className="text-white/60">Route:</span> {it.route}</div>
              <div><span className="text-white/60">Code:</span> {it.code}</div>
              <div><span className="text-white/60">Status:</span> {it.status}</div>
              <div><span className="text-white/60">RequestId:</span> {it.requestId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

