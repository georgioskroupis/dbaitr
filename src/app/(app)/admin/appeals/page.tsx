"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useAdminGate } from '@/hooks/use-admin-gate';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AppealItem {
  id: string;
  topicId?: string | null;
  statementId?: string | null;
  threadId?: string | null;
  reason: string;
  createdBy?: string;
  status: 'open' | 'resolved';
  decision?: 'approved' | 'denied';
  rationale?: string;
}

export default function AppealsAdminPage() {
  const { userProfile, user } = useAuth();
  const { allowed: isAdmin, loading: adminLoading } = useAdminGate();
  const { toast } = useToast();
  const router = useRouter();
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [rationale, setRationale] = useState<Record<string, string>>({});

  const canModerate = isAdmin || !!(userProfile as any)?.isModerator;
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (canModerate) { setAllow(true); return; }
    (async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const u = getAuth().currentUser;
        if (u) {
          const t = await u.getIdToken();
          const res = await apiFetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${t}` } });
          const j = await res.json();
          if (j?.ok && j.role === 'admin') { setAllow(true); return; }
        }
      } catch {}
      router.replace('/dashboard');
    })();
  }, [adminLoading, canModerate, router]);

  useEffect(() => {
    async function loadAppeals() {
      if (!canModerate && !allow) return;
      setLoading(true);
      try {
        if (user) {
          const token = await user.getIdToken();
          const res = await apiFetch('/api/admin/appeals', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const j = await res.json();
            if (j?.ok) { 
              setAppeals(j.appeals || []);
              if (Array.isArray(j.errors) && j.errors.length) {
                toast({ title: 'Some data could not be loaded', description: j.errors.join('; ') });
              }
              return; 
            }
          }
        }
        const q = query(collection(db, 'appeals'), orderBy('createdAt', 'desc'), limit(100));
        const snap = await getDocs(q);
        setAppeals(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (err) {
        toast({ title: 'Failed to load appeals', variant: 'destructive' });
      } finally { setLoading(false); }
    }
    loadAppeals();
  }, [canModerate, allow, toast, user]);

  const resolve = async (appealId: string, decision: 'approved'|'denied') => {
    if (!user) return;
    setResolvingId(appealId);
    try {
      const token = await user.getIdToken();
      const res = await apiFetch('/api/appeals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appealId, decision, rationale: rationale[appealId] || '' }),
      });
      if (!res.ok) throw new Error('http');
      toast({ title: 'Appeal resolved' });
      // Refresh quick
      const q = query(collection(db, 'appeals'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setAppeals(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch {
      toast({ title: 'Resolution failed', variant: 'destructive' });
    } finally { setResolvingId(null); }
  };

  if (!canModerate && !allow) {
    return (
      <div className="container mx-auto py-10">
        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle>Appeals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/70">You do not have moderation privileges.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold text-white mb-6">Appeals</h1>
      {loading ? (
        <p className="text-white/70">Loading appeals...</p>
      ) : appeals.length === 0 ? (
        <p className="text-white/70">No appeals.</p>
      ) : (
        <div className="space-y-4">
          {appeals.map(a => (
            <Card key={a.id} className="bg-black/40 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Appeal: {a.statementId || a.threadId}</CardTitle>
              </CardHeader>
              <CardContent className="text-white/80 space-y-3">
                <p className="text-sm">Status: {a.status}</p>
                <p className="text-sm">Topic: {a.topicId || '-'}</p>
                <p className="text-sm">Statement: {a.statementId || '-'}</p>
                <p className="text-sm">Thread: {a.threadId || '-'}</p>
                <div>
                  <p className="text-sm font-semibold">Reason</p>
                  <p className="text-sm whitespace-pre-wrap">{a.reason}</p>
                </div>
                {a.status === 'open' ? (
                  <div className="space-y-2">
                    <textarea
                      value={rationale[a.id] || ''}
                      onChange={(e) => setRationale(prev => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder="Decision rationale (optional)"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resolve(a.id, 'approved')} disabled={resolvingId === a.id} className="bg-emerald-600 hover:bg-emerald-500">Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => resolve(a.id, 'denied')} disabled={resolvingId === a.id}>Deny</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm">Decision: {a.decision}</p>
                    {a.rationale && <p className="text-sm">Rationale: {a.rationale}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
import { apiFetch } from '@/lib/http/client';
