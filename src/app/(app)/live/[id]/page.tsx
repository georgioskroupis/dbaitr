"use client";

import * as React from 'react';
import { getDb } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveChat } from '@/components/live/LiveChat';
import { apiFetch } from '@/lib/http/client';

function Player({ videoId, live }: { videoId: string; live: boolean }) {
  if (!videoId) return null;
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0&playsinline=1${live?'&live=1':''}`;
  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe className="absolute inset-0 w-full h-full" src={src} title="YouTube player" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
    </div>
  );
}

export default function LiveDetailPage(props: any) {
  const db = getDb();
  const params = (props as any)?.params as { id: string };
  const { user } = useAuth();
  const [data, setData] = React.useState<any>(null);
  const [ingest, setIngest] = React.useState<{ ingestAddress: string; streamName: string } | null>(null);

  React.useEffect(() => {
    const ref = doc(db, 'liveDebates', params.id);
    const unsub = onSnapshot(ref, (snap) => setData({ id: snap.id, ...(snap.data() || {}) }));
    return () => unsub();
  }, [params.id]);

  const isOwner = user && data?.createdBy === user.uid;

  const fetchIngest = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await apiFetch(`/api/live/${params.id}/ingest`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (j?.ok) setIngest({ ingestAddress: j.ingestAddress, streamName: j.streamName });
  };

  const transition = async (to: 'testing'|'live'|'complete') => {
    if (!user) return;
    const token = await user.getIdToken();
    await apiFetch(`/api/live/${params.id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to }) });
  };

  if (!data) return null;
  const status = data.status as string;
  const vid = data?.youtube?.videoId as string | undefined;
  const live = status === 'live';

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-white">{data.title}</h1>
      {vid && (status==='live' || status==='complete') && (
        <Player videoId={vid} live={status==='live'} />
      )}
      {status==='scheduled' && <p className="text-white/70">Scheduled. Waiting for start.</p>}

      {(isOwner) && (
        <Card className="bg-black/40 border border-white/10">
          <CardHeader><CardTitle className="text-white">Host Console</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-white/80">
            <div className="flex gap-2">
              <Button onClick={() => transition('testing')} variant="outline">Go to Testing</Button>
              <Button onClick={() => transition('live')} className="bg-rose-500 hover:bg-rose-400">Go Live</Button>
              <Button onClick={() => transition('complete')} variant="outline">End Stream</Button>
            </div>
            <div>
              <Button onClick={fetchIngest} variant="outline">Show RTMP Ingest</Button>
              {ingest && (
                <div className="mt-2 text-sm">
                  <p>Server: <span className="text-white/90 break-all">{ingest.ingestAddress}</span></p>
                  <p>Stream Key: <span className="text-white/90 break-all">{ingest.streamName}</span></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <LiveChat roomId={params.id} />
    </div>
  );
}
