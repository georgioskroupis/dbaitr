"use client";
import * as React from 'react';
import { apiFetch } from '@/lib/http/client';
import { useAdminGate } from '@/hooks/use-admin-gate';

export default function AdminDiagnosticsPage() {
  const { allowed, loading } = useAdminGate();
  const [items, setItems] = React.useState<any[]>([]);
  const [aggregates, setAggregates] = React.useState<Record<string, number>>({});
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState<string>('');
  const [route, setRoute] = React.useState<string>('');
  const [win, setWin] = React.useState<string>('24h');
  React.useEffect(() => {
    if (!allowed || loading) return;
    (async () => {
      setBusy(true);
      try {
        const params = new URLSearchParams();
        if (code) params.set('code', code);
        if (route) params.set('route', route);
        if (win) params.set('window', win);
        const r = await apiFetch(`/api/admin/diagnostics?${params.toString()}`);
        const j = await r.json();
        if (j?.ok) { setItems(j.items || []); setAggregates(j.aggregates || {}); }
      } finally { setBusy(false); }
    })();
  }, [allowed, loading, code, route, win]);
  if (loading || !allowed) return <div className="container mx-auto py-8"><p className="text-white/70">Checking admin access…</p></div>;
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-semibold text-white mb-4">Auth/App Check Diagnostics</h1>
      <div className="flex gap-2 mb-4">
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="code (e.g., rate_limited)" className="bg-white/5 border border-white/10 text-white px-2 py-1 rounded" />
        <input value={route} onChange={e=>setRoute(e.target.value)} placeholder="route (/api/...)" className="bg-white/5 border border-white/10 text-white px-2 py-1 rounded" />
        <select value={win} onChange={e=>setWin(e.target.value)} className="bg-white/5 border border-white/10 text-white px-2 py-1 rounded">
          <option value="1h">1h</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
        </select>
      </div>
      {Object.keys(aggregates).length > 0 && (
        <div className="mb-4 text-white/80">
          <h2 className="text-white text-lg mb-2">Aggregates</h2>
          {Object.entries(aggregates).map(([k,v]) => (
            <div key={k} className="text-sm">{k}: {v}</div>
          ))}
        </div>
      )}
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
