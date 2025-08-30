"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, limit, query, deleteDoc, doc, collectionGroup, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useAdminGate } from '@/hooks/use-admin-gate';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

interface ReportItem {
  id: string;
  topicId?: string | null;
  statementId?: string | null;
  threadId?: string | null;
  reason: string;
  details?: string;
  createdAt?: string;
}

export default function ModerationPage() {
  const { userProfile, user } = useAuth();
  const { allowed: isAdmin, loading: adminLoading } = useAdminGate();
  const { toast } = useToast();
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [flaggedStatements, setFlaggedStatements] = useState<any[]>([]);
  const [flaggedThreads, setFlaggedThreads] = useState<any[]>([]);

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
    async function loadReports() {
      if (!canModerate && !allow) return;
      setLoading(true);
      try {
        // Use admin API to avoid client rules/App Check issues
        if (user) {
          const token = await user.getIdToken();
          const res = await apiFetch('/api/admin/reports', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const j = await res.json();
            if (j?.ok) {
              setReports(j.reports || []);
              setFlaggedStatements(j.flaggedStatements || []);
              setFlaggedThreads(j.flaggedThreads || []);
              if (Array.isArray(j.errors) && j.errors.length) {
                toast({ title: 'Some data could not be loaded', description: j.errors.join('; ') });
              }
              return;
            }
          }
        }
        // As a last resort, try client reads
        const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        setReports(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        const fs = await getDocs(query(collectionGroup(db, 'statements'), where('moderation.flagged', '==', true), limit(50)) as any);
        setFlaggedStatements(fs.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        const ft = await getDocs(query(collectionGroup(db, 'threads'), where('moderation.flagged', '==', true), limit(50)) as any);
        setFlaggedThreads(ft.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (err) {
        logger.error('Failed to load reports:', err);
        toast({ title: 'Failed to load reports', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [canModerate, allow, toast]);

  const handleDeleteStatement = async (topicId: string, statementId: string) => {
    try {
      await deleteDoc(doc(db, 'topics', topicId, 'statements', statementId));
      toast({ title: 'Statement deleted' });
    } catch (err) {
      logger.error('Delete statement failed:', err);
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleDeleteThread = async (topicId: string, statementId: string, threadId: string) => {
    try {
      await deleteDoc(doc(db, 'topics', topicId, 'statements', statementId, 'threads', threadId));
      toast({ title: 'Thread node deleted' });
    } catch (err) {
      logger.error('Delete thread failed:', err);
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const clearStatementFlag = async (topicId: string, statementId: string, payload?: any) => {
    try {
      if (user) {
        const token = await user.getIdToken();
        await apiFetch('/api/moderation/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'clear_flag',
            target: 'statement',
            topicId,
            statementId,
            tags: payload?.tags || [],
            notes: payload?.notes || '',
            scores: payload?.scores || null,
            maxLabel: payload?.maxLabel || null,
            maxScore: payload?.maxScore || null,
          }),
        });
      }
      await updateDoc(doc(db, 'topics', topicId, 'statements', statementId), { 'moderation.flagged': false, 'moderation.reviewedAt': new Date().toISOString() } as any);
      toast({ title: 'Flag cleared' });
      // Refresh flagged lists
      const fs = await getDocs(query(collectionGroup(db, 'statements'), where('moderation.flagged', '==', true), limit(50)) as any);
      setFlaggedStatements(fs.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (err) {
      logger.error('Clear flag failed:', err);
      toast({ title: 'Clear failed', variant: 'destructive' });
    }
  };

  const clearThreadFlag = async (topicId: string, statementId: string, threadId: string, payload?: any) => {
    try {
      if (user) {
        const token = await user.getIdToken();
        await apiFetch('/api/moderation/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'clear_flag',
            target: 'thread',
            topicId,
            statementId,
            threadId,
            tags: payload?.tags || [],
            notes: payload?.notes || '',
            scores: payload?.scores || null,
            maxLabel: payload?.maxLabel || null,
            maxScore: payload?.maxScore || null,
          }),
        });
      }
      await updateDoc(doc(db, 'topics', topicId, 'statements', statementId, 'threads', threadId), { 'moderation.flagged': false, 'moderation.reviewedAt': new Date().toISOString() } as any);
      toast({ title: 'Flag cleared' });
      const ft = await getDocs(query(collectionGroup(db, 'threads'), where('moderation.flagged', '==', true), limit(50)) as any);
      setFlaggedThreads(ft.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (err) {
      logger.error('Clear thread flag failed:', err);
      toast({ title: 'Clear failed', variant: 'destructive' });
    }
  };

  if (!canModerate && !allow) {
    return (
      <div className="container mx-auto py-10">
        <Card className="bg-black/40 backdrop-blur-md border border-white/10">
          <CardHeader>
            <CardTitle>Moderation</CardTitle>
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
      <h1 className="text-3xl font-semibold text-white mb-6">Moderation</h1>
      {loading ? (
        <p className="text-white/70">Loading reports...</p>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl text-white mb-2">User Reports</h2>
            {reports.length === 0 ? (
              <p className="text-white/70">No reports.</p>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => (
                  <Card key={r.id} className="bg-black/40 backdrop-blur-md border border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white">Report: {r.reason}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-white/80 space-y-3">
                      {r.details && <p className="text-sm">Details: {r.details}</p>}
                      <p className="text-sm">Topic: {r.topicId || '-'}</p>
                      <p className="text-sm">Statement: {r.statementId || '-'}</p>
                      <p className="text-sm">Thread: {r.threadId || '-'}</p>
                      <div className="flex gap-2">
                        {r.topicId && r.statementId && (
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteStatement(r.topicId!, r.statementId!)}>
                            Delete Statement
                          </Button>
                        )}
                        {r.topicId && r.statementId && r.threadId && (
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteThread(r.topicId!, r.statementId!, r.threadId!)}>
                            Delete Thread Node
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl text-white mb-2">Flagged by System</h2>
            <div className="space-y-3">
              {flaggedStatements.map((s) => (
                <Card key={`fs-${s.id}`} className="bg-black/40 backdrop-blur-md border border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Statement Flag · {s.topicId} / {s.id}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-white/80 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{s.content}</p>
                    {s.moderation?.maxLabel && (
                      <p className="text-xs text-white/60">Top: {s.moderation.maxLabel} ({Math.round((s.moderation.maxScore || 0)*100)}%)</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => clearStatementFlag(s.topicId, s.id, { maxLabel: s.moderation?.maxLabel, maxScore: s.moderation?.maxScore, scores: s.moderation?.scores })} className="bg-emerald-600 hover:bg-emerald-500">Clear Flag</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteStatement(s.topicId, s.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {flaggedThreads.map((t) => (
                <Card key={`ft-${t.id}`} className="bg-black/40 backdrop-blur-md border border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Thread Flag · {t.topicId} / {t.statementId} / {t.id}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-white/80 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{t.content}</p>
                    {t.moderation?.maxLabel && (
                      <p className="text-xs text-white/60">Top: {t.moderation.maxLabel} ({Math.round((t.moderation.maxScore || 0)*100)}%)</p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => clearThreadFlag(t.topicId, t.statementId, t.id, { maxLabel: t.moderation?.maxLabel, maxScore: t.moderation?.maxScore, scores: t.moderation?.scores })} className="bg-emerald-600 hover:bg-emerald-500">Clear Flag</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteThread(t.topicId, t.statementId, t.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {flaggedStatements.length === 0 && flaggedThreads.length === 0 && (
                <p className="text-white/70">No items currently flagged by the system.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { apiFetch } from '@/lib/http/client';
