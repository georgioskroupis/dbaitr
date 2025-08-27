"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type PeriodStats = {
  reports?: number;
  actions?: number;
  appealsApproved?: number;
  appealsDenied?: number;
  appealsOpen?: number;
};

type TransparencyDoc = {
  updatedAt?: string;
  week?: PeriodStats;
  month?: PeriodStats;
  total?: PeriodStats;
};

export default function TransparencyPage() {
  const [data, setData] = useState<TransparencyDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'analytics', 'transparency');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setData(snap.data() as any);
        } else {
          setData({});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const S = ({ title, stats }: { title: string; stats?: PeriodStats }) => (
    <Card className="bg-black/40 border border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-white/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-white/60">Reports</p>
          <p className="text-xl">{stats?.reports ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/60">Moderator Actions</p>
          <p className="text-xl">{stats?.actions ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/60">Appeals Approved</p>
          <p className="text-xl">{stats?.appealsApproved ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/60">Appeals Denied</p>
          <p className="text-xl">{stats?.appealsDenied ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/60">Appeals Open</p>
          <p className="text-xl">{stats?.appealsOpen ?? '—'}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-white">Transparency</h1>
      <p className="text-white/70 text-sm">
        We publish community safety metrics to promote accountability. Counts update periodically.
      </p>
      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : (
        <div className="space-y-4">
          <S title="This Week" stats={data?.week} />
          <S title="This Month" stats={data?.month} />
          <S title="All Time" stats={data?.total} />
          <Separator className="bg-white/10" />
          <p className="text-xs text-white/50">Last updated: {data?.updatedAt || '—'}</p>
        </div>
      )}
    </div>
  );
}

