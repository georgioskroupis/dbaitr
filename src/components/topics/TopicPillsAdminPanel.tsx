"use client";

import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type Cat = 'tone'|'style'|'outcome'|'substance'|'engagement'|'argumentation';

const OPTIONS: Record<Cat, string[]> = {
  tone: ['heated','calm'],
  style: ['structured','informal'],
  outcome: ['controversial','consensus'],
  substance: ['evidence','opinion'],
  engagement: ['active','dormant'],
  argumentation: ['solid','weak'],
};

export function TopicPillsAdminPanel({ topicId, categories }: { topicId: string; categories?: any }) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const canModerate = !!(user && (userProfile?.isModerator || userProfile?.isAdmin));
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  if (!canModerate) return null;

  async function recomputeNow() {
    if (!user) return;
    setRunning(true);
    try {
      const t = await user.getIdToken();
      const res = await fetch('/api/analysis/recompute', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ topicId }) });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Recompute queued', description: 'Analysis updated.' });
    } catch {
      toast({ title: 'Recompute failed', description: 'Try again shortly.', variant: 'destructive' });
    } finally { setRunning(false); }
  }

  async function override(cat: Cat, value: string) {
    if (!user) return;
    setSaving(cat);
    try {
      const t = await user.getIdToken();
      const res = await fetch('/api/admin/analysis/override', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ topicId, category: cat, value, note: note || undefined }) });
      if (!res.ok) throw new Error('Failed');
      toast({ title: `Overridden ${cat}`, description: `Set to ${value}` });
    } catch {
      toast({ title: 'Override failed', description: 'Check permissions and try again.', variant: 'destructive' });
    } finally { setSaving(null); }
  }

  return (
    <div className="p-3 rounded-lg border border-white/10 bg-black/40">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-white/70">Moderator Controls</div>
        <div className="flex items-center gap-2">
          <Input placeholder="Override note (optional)" value={note} onChange={e => setNote(e.target.value)} className="h-8 w-64 bg-white/5 border-white/20 text-white" />
          <Button size="sm" className="h-8" onClick={recomputeNow} disabled={running}>{running ? 'Recomputing…' : 'Recompute now'}</Button>
        </div>
      </div>
      <Separator className="my-2 bg-white/10" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(OPTIONS) as Cat[]).map(cat => {
          const current = categories?.[cat]?.value || '';
          return (
            <div key={cat} className="flex items-center gap-2">
              <div className="w-28 text-xs text-white/60 capitalize">{cat}</div>
              <Select onValueChange={(v) => override(cat, v)} defaultValue={current}>
                <SelectTrigger className="h-8 bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Set value" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-white/10 text-white">
                  {OPTIONS[cat].map(v => <SelectItem key={v} value={v} disabled={saving === cat}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

