"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

export default function NewLivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public'|'unlisted'|'private'>('unlisted');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const createLive = async () => {
    if (!user) { router.push('/auth'); return; }
    setLoading(true);
    try {
      const token = await user.getIdToken(true); // force refresh to pick up updated claims
      const res = await fetch('/api/live/create', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, visibility }) });
      if (res.status === 403) {
        setMessage('Hosting live debates is limited to Supporters or Admins. Visit Pricing to upgrade.');
        return;
      }
      const j = await res.json();
      if (res.status === 409 && j?.error === 'youtube_not_connected') {
        setMessage('YouTube is not connected. An admin must connect the global channel in Settings → Integrations → YouTube.');
        return;
      }
      if (res.status === 409 && j?.error === 'live_streaming_not_enabled') {
        setMessage('Live streaming is not enabled on the configured YouTube channel. Enable it in YouTube Studio (Settings → Channel → Feature eligibility or Live → Enable) and wait up to 24 hours.');
        return;
      }
      if (!res.ok || !j?.ok) {
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      if (!j?.ok) throw new Error(j?.error || 'failed');
      router.push(`/live/${j.debateId}`);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to create live');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-black/40 border border-white/10 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-white">Schedule Live Debate</CardTitle>
        </CardHeader>
        <CardContent className="text-white/80 space-y-3">
          {message && <p className="text-rose-300">{message}</p>}
          <div>
            <label className="text-sm text-white/80">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Debate title" className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-sm text-white/80">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this debate about?" className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-sm text-white/80">Visibility</label>
            <div className="mt-1 flex gap-2">
              {(['public','unlisted','private'] as const).map(v => (
                <button key={v} onClick={() => setVisibility(v)} className={`px-3 py-1.5 rounded-md text-sm ${visibility===v?'bg-rose-500/20 text-rose-300 border border-rose-500/30':'bg-white/5 text-white/80 border border-white/10'}`}>{v}</button>
              ))}
            </div>
          </div>
          <Button onClick={createLive} disabled={loading} className="bg-rose-500 hover:bg-rose-400">{loading?'Creating…':'Create'}</Button>
          {message && (
            <div className="pt-2 text-sm text-white/70">
              {message} {message?.includes('Supporters') && (
                <a href="/pricing" className="underline text-rose-300">Pricing</a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
