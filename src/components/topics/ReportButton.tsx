"use client";

import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/http/client';

export function ReportButton({
  topicId,
  statementId,
  threadId,
  className,
}: {
  topicId?: string;
  statementId?: string;
  threadId?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const handleReport = async () => {
    try {
      const res = await apiFetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, statementId, threadId, reason: 'user_report', details: '' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Reported', description: 'Thanks for your report.' });
    } catch (err) {
      toast({ title: 'Report failed', variant: 'destructive' });
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleReport} className={className}>
      <Flag className="h-4 w-4 mr-1" /> Report
    </Button>
  );
}
