"use client";

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';

export default function AppealsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearchParams();
  const [topicId, setTopicId] = React.useState('');
  const [statementId, setStatementId] = React.useState('');
  const [threadId, setThreadId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit = !!user && reason.trim().length >= 10 && (statementId || threadId || topicId);
  
  React.useEffect(() => {
    try {
      const t = search.get('topicId') || '';
      const s = search.get('statementId') || '';
      const th = search.get('threadId') || '';
      const rf = search.get('reason') || '';
      if (t) setTopicId(t);
      if (s) setStatementId(s);
      if (th) setThreadId(th);
      if (rf) setReason(rf);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async () => {
    if (!user) { toast({ title: 'Sign in required', variant: 'destructive' }); return; }
    if (!canSubmit) { toast({ title: 'Provide details', description: 'Include a statement or thread ID and at least 10 characters.', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await apiFetch('/api/appeals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topicId: topicId || undefined, statementId: statementId || undefined, threadId: threadId || undefined, reason }),
      });
      if (!res.ok) throw new Error('http');
      toast({ title: 'Appeal submitted', description: 'We’ll review and respond soon.' });
      setReason(''); setTopicId(''); setStatementId(''); setThreadId('');
    } catch {
      toast({ title: 'Failed to submit appeal', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-semibold text-white mb-4">Appeal a Moderation Decision</h1>
      <Card className="bg-black/40 backdrop-blur-md border border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Submit Appeal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-white/80">
          <p className="text-sm">Provide the content reference and explain why the decision should be reconsidered.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/60">Topic ID (optional)</label>
              <Input value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="topicId" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-white/60">Statement ID</label>
              <Input value={statementId} onChange={(e) => setStatementId(e.target.value)} placeholder="statementId (optional for blocked submissions)" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-white/60">Thread ID (optional)</label>
              <Input value={threadId} onChange={(e) => setThreadId(e.target.value)} placeholder="threadId" className="bg-white/5 border-white/10 text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60">Your rationale</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={5} placeholder="Explain calmly and clearly..." className="bg-white/5 border-white/10 text-white" />
            <p className="text-[11px] text-white/40 mt-1">Min 10 characters.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onSubmit} disabled={!canSubmit || submitting} className="bg-rose-500 hover:bg-rose-400">
              {submitting ? 'Submitting…' : 'Submit Appeal'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { apiFetch } from '@/lib/http/client';
