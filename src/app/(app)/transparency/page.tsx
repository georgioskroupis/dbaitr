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
    <Card className="bg-gradient-to-br from-white/5 to-white/[0.03] border border-white/10 shadow-sm hover:shadow-md transition">
      <CardHeader>
        <CardTitle className="text-white text-lg tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-white/90 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-md bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/60">Reports</p>
          <p className="text-2xl font-semibold mt-1">{stats?.reports ?? '—'}</p>
        </div>
        <div className="rounded-md bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/60">Moderator Actions</p>
          <p className="text-2xl font-semibold mt-1">{stats?.actions ?? '—'}</p>
        </div>
        <div className="rounded-md bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/60">Appeals Approved</p>
          <p className="text-2xl font-semibold mt-1">{stats?.appealsApproved ?? '—'}</p>
        </div>
        <div className="rounded-md bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/60">Appeals Denied</p>
          <p className="text-2xl font-semibold mt-1">{stats?.appealsDenied ?? '—'}</p>
        </div>
        <div className="rounded-md bg-white/5 p-3 border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/60">Appeals Open</p>
          <p className="text-2xl font-semibold mt-1">{stats?.appealsOpen ?? '—'}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/10 to-indigo-500/10 p-6 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Transparency</h1>
          <p className="mt-2 text-white/80">We publish community safety and integrity metrics and explain, in plain language, how our systems work.</p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <p className="text-white/60">Loading metrics…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <S title="This Week" stats={data?.week} />
          <S title="This Month" stats={data?.month} />
          <S title="All Time" stats={data?.total} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">Last updated: {data?.updatedAt || '—'}</p>
      </div>

      <Separator className="bg-white/10" />

      {/* Transparency Report (static content) */}
      <div className="prose prose-invert max-w-none">
        <h1>Transparency Report</h1>
        <p>This report provides a clear overview of how the platform works, the safeguards that protect user safety, and how we uphold our manifesto values. It explains the systems behind debates, the measures that ensure fairness, and how anyone can independently verify them.</p>

        <h2>High-Level Overview</h2>
        <p>The platform supports civil, evidence-based debates. Users can share statements, join Q&amp;A threads, and view sentiment analytics, while identity checks and moderation preserve integrity. It is built with Firebase and Next.js, with additional services for sentiment analysis and ID verification. GitHub Actions publish transparency updates, and Stripe manages billing.</p>

        <h2>Architecture</h2>
        <ul>
          <li><strong>Frontend</strong>: Next.js powering features like threads, analytics, search, pricing, and profiles.</li>
          <li><strong>Server</strong>: API routes handling debate content, moderation, and analytics.</li>
          <li><strong>Data &amp; Access</strong>: Firestore stores topics, statements, users, and transparency metrics. Firebase Auth and KYC manage identity.</li>
          <li><strong>Integrity</strong>: Enforced through App Check, rate limits, Perspective toxicity filter, moderation tools, and sentiment analysis.</li>
        </ul>
        <h3>Systems</h3>
        <ul>
          <li><strong>Internal</strong>: Next.js app, Firestore, moderation loop.</li>
          <li><strong>External</strong>: Firebase Auth, Firestore, App Check, Perspective API, Hugging Face, Stripe.</li>
        </ul>

        <h2>Data Model</h2>
        <p>The model is straightforward: topics contain statements and threads; users have verified status; reports and appeals link to moderation; analytics track transparency and sentiment trends.</p>

        <h2>Main User Flows</h2>
        <ul>
          <li><strong>Join &amp; Sign In</strong>: Create an account with full name and email.</li>
          <li><strong>Verify Identity</strong>: Complete KYC/IDV with grace or strict requirements depending on topic.</li>
          <li><strong>Explore &amp; Post</strong>: Browse topics, search, and publish statements.</li>
          <li><strong>Debate</strong>: Ask or respond in threads, with civility filters applied.</li>
          <li><strong>Insights</strong>: View analytics such as Likert bars and filters.</li>
          <li><strong>Moderation</strong>: Report content or submit appeals.</li>
          <li><strong>Profile &amp; Plans</strong>: Manage profile information and review pricing.</li>
        </ul>

        <h2>Features &amp; Manifesto Alignment</h2>
        <ul>
          <li><strong>Identity</strong>: Real names, verified badges, and posting gates.</li>
          <li><strong>AI &amp; Transparency</strong>: Server-side stance detection, optional AI assist with clear labels, and public analytics.</li>
          <li><strong>Civility</strong>: Toxicity filtering, appeals process, and fair rate limits.</li>
          <li><strong>Data</strong>: Cleanup workflows ensure minimal retention.</li>
          <li><strong>Business Model</strong>: Honest, ad‑free pricing.</li>
        </ul>

        <h2>Security &amp; Trust</h2>
        <p>Access is secured with App Check, Firestore rules, and KYC verification. Perspective filtering safeguards civility, rate limits maintain fairness, and cleanup workflows manage data retention responsibly.</p>

        <h2>How to Verify</h2>
        <ol>
          <li><strong>Access</strong>: Check App Check headers on requests and test KYC behavior on different topics.</li>
          <li><strong>Civility</strong>: Submit toxic content to confirm it is blocked with an appeal option; attempt rapid posting to trigger rate limits.</li>
          <li><strong>Transparency</strong>: Use analytics filters and review the /transparency page and cleanup logs to confirm accuracy and accountability.</li>
        </ol>
      </div>
    </div>
  );
}
