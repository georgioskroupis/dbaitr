"use client";

import * as React from 'react';
import { getDb } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type LiveDebate = {
  id: string;
  title: string;
  createdBy: string;
  scheduledStartTime?: string | null;
  status: 'draft'|'scheduled'|'testing'|'live'|'complete'|'canceled'|'error';
};

export function LiveIndex({ embedded = false, hideHeading = false }: { embedded?: boolean; hideHeading?: boolean }) {
  const db = getDb();
  const [tab, setTab] = React.useState<'live'|'upcoming'|'past'>('live');
  const [items, setItems] = React.useState<LiveDebate[]>([]);

  React.useEffect(() => {
    const col = collection(db, 'liveDebates');
    let q;
    if (tab === 'live') q = query(col, where('status','==','live'), orderBy('createdAt','desc'), limit(20));
    else if (tab === 'upcoming') q = query(col, where('status','in',['scheduled','testing']), orderBy('createdAt','desc'), limit(20));
    else q = query(col, where('status','in',['complete','canceled','error']), orderBy('createdAt','desc'), limit(20));
    const unsub = onSnapshot(
      q as any,
      (snap: any) => {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list as any);
      },
      (err: any) => {
        // If index missing in dev, log minimal info to console and continue gracefully.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('LiveIndex snapshot error:', err?.code || err?.name, err?.message);
        }
      }
    );
    return () => unsub();
  }, [tab]);

  return (
    <div className={embedded ? 'space-y-6' : 'container mx-auto px-4 py-8 space-y-6'}>
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Live Debates</h1>
          <Link href="/live/new" className="text-sm underline text-rose-400">Host a Live Debate</Link>
        </div>
      )}
      <div className="flex gap-2">
        {(['live','upcoming','past'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md text-sm ${tab===t?'bg-rose-500/20 text-rose-300 border border-rose-500/30':'bg-white/5 text-white/80 border border-white/10'}`}>{t==='live'?'Live Now':t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(it => (
          <Card key={it.id} className="bg-black/40 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg"><Link href={`/live/${it.id}`}>{it.title}</Link></CardTitle>
            </CardHeader>
            <CardContent className="text-white/70 text-sm">
              <p>Status: <span className="text-white/90">{it.status}</span></p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
