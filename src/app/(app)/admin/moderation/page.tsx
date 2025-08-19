"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, limit, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
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
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);

  const canModerate = !!userProfile?.isAdmin || !!(userProfile as any)?.isModerator;

  useEffect(() => {
    async function loadReports() {
      if (!canModerate) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        setReports(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (err) {
        logger.error('Failed to load reports:', err);
        toast({ title: 'Failed to load reports', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [canModerate, toast]);

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

  if (!canModerate) {
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
      ) : reports.length === 0 ? (
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
  );
}

