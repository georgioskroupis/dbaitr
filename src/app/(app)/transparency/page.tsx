"use client";

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';
import { useAuth } from '@/context/AuthContext';
import { getAppCheckToken, getClientApp } from '@/lib/firebase/client';
import { apiFetch } from '@/lib/http/client';

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
  const db = getDb();
  const [data, setData] = useState<TransparencyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        try {
          const app = getClientApp();
          logger.debug('[transparency] app.projectId', (app?.options as any)?.projectId);
        } catch (e) {
          logger.debug('[transparency] getClientApp failed', (e as any)?.message || e);
        }
        try {
          const t = await getAppCheckToken().catch(() => null);
          logger.debug('[transparency] appcheck token present?', !!t, 'len', t ? String(t).length : 0);
        } catch {}
        logger.debug('[transparency] auth state', {
          uid: user?.uid || null,
          email: user?.email || null,
          role: (userProfile as any)?.role ?? null,
          status: (userProfile as any)?.status ?? null,
        });

        logger.debug('[transparency] fetching via API /api/analytics/transparency');
        const res = await apiFetch('/api/analytics/transparency');
        const j = await res.json();
        logger.debug('[transparency] api status', res.status, 'ok?', j?.ok === true);
        if (j?.ok) setData(j.data || {});
        else setData({});
      } finally {
        setLoading(false);
      }
    })();
    // One-shot diagnostics
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="bg-gradient-to-br from-white/5 to-white/[0.03] border border-white/10 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg tracking-tight flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-white/85 leading-relaxed space-y-3">
        {children}
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

      {/* Transparency Report (styled sections) */}
      <div className="space-y-6">
        <Section title="Transparency Report">
          <p>
            This report provides a clear overview of how the platform works, the safeguards that protect user safety, and how we uphold our manifesto values. It explains the systems behind debates, the measures that ensure fairness, and how anyone can independently verify them.
          </p>
        </Section>

        <Section title="High-Level Overview">
          <p>
            The platform supports civil, evidence-based debates. Users can share statements, join Q&amp;A threads, and view sentiment analytics, while identity checks and moderation preserve integrity. It is built with Firebase and Next.js, with additional services for sentiment analysis and ID verification. GitHub Actions publish transparency updates, and Stripe manages billing.
          </p>
        </Section>

        <Section title="Architecture">
          <ul className="list-disc list-inside space-y-1.5 marker:text-white/40">
            <li><span className="font-semibold">Frontend</span>: Next.js powering features like threads, analytics, search, pricing, and profiles.</li>
            <li><span className="font-semibold">Server</span>: API routes handling debate content, moderation, and analytics.</li>
            <li><span className="font-semibold">Data &amp; Access</span>: Firestore stores topics, statements, users, and transparency metrics. Firebase Auth and KYC manage identity.</li>
            <li><span className="font-semibold">Integrity</span>: Enforced through App Check, rate limits, Perspective toxicity filter, moderation tools, and sentiment analysis.</li>
          </ul>
          <div className="mt-3">
            <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Systems</p>
            <ul className="list-disc list-inside space-y-1.5 marker:text-white/40">
              <li><span className="font-semibold">Internal</span>: Next.js app, Firestore, moderation loop.</li>
              <li><span className="font-semibold">External</span>: Firebase Auth, Firestore, App Check, Perspective API, Hugging Face, Stripe.</li>
            </ul>
          </div>
        </Section>

        <Section title="Data Model">
          <p>
            The model is straightforward: topics contain statements and threads; users have verified status; reports and appeals link to moderation; analytics track transparency and sentiment trends.
          </p>
        </Section>

        <Section title="Main User Flows">
          <ul className="list-disc list-inside space-y-1.5 marker:text-white/40">
            <li><span className="font-semibold">Join &amp; Sign In</span>: Create an account with full name and email.</li>
            <li><span className="font-semibold">Verify Identity</span>: Complete KYC/IDV with grace or strict requirements depending on topic.</li>
            <li><span className="font-semibold">Explore &amp; Post</span>: Browse topics, search, and publish statements.</li>
            <li><span className="font-semibold">Debate</span>: Ask or respond in threads, with civility filters applied.</li>
            <li><span className="font-semibold">Insights</span>: View analytics such as Likert bars and filters.</li>
            <li><span className="font-semibold">Moderation</span>: Report content or submit appeals.</li>
            <li><span className="font-semibold">Profile &amp; Plans</span>: Manage profile information and review pricing.</li>
          </ul>
        </Section>

        <Section title="Features &amp; Manifesto Alignment">
          <ul className="list-disc list-inside space-y-1.5 marker:text-white/40">
            <li><span className="font-semibold">Identity</span>: Real names, verified badges, and posting gates.</li>
            <li><span className="font-semibold">AI &amp; Transparency</span>: Server-side stance detection, optional AI assist with clear labels, and public analytics.</li>
            <li><span className="font-semibold">Civility</span>: Toxicity filtering, appeals process, and fair rate limits.</li>
            <li><span className="font-semibold">Data</span>: Cleanup workflows ensure minimal retention.</li>
            <li><span className="font-semibold">Business Model</span>: Honest, ad‑free pricing.</li>
          </ul>
        </Section>

        <Section title="Security &amp; Trust">
          <p>
            Access is secured with App Check, Firestore rules, and KYC verification. Perspective filtering safeguards civility, rate limits maintain fairness, and cleanup workflows manage data retention responsibly.
          </p>
        </Section>

        <Section title="How to Verify">
          <ol className="list-decimal list-inside space-y-1.5 marker:text-white/50">
            <li><span className="font-semibold">Access</span>: Check App Check headers on requests and test KYC behavior on different topics.</li>
            <li><span className="font-semibold">Civility</span>: Submit toxic content to confirm it is blocked with an appeal option; attempt rapid posting to trigger rate limits.</li>
            <li><span className="font-semibold">Transparency</span>: Use analytics filters and review the /transparency page and cleanup logs to confirm accuracy and accountability.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}
