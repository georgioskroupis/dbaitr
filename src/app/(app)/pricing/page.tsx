"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Check } from 'lucide-react';

type Plan = {
  name: string;
  price: string;
  period: string;
  features: string[];
  note?: string;
  cta: { label: string; href: string };
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Free Verified User',
    price: '€0',
    period: '/mo',
    features: [
      'Verify identity (no bots, no anonymous)',
      'Post statements with evidence for facts',
      'Ask up to 3 follow‑up questions',
      'Join and search existing topics',
      'AI‑assist drafting & sentiment',
      'No ads — ever',
    ],
    note: 'Topic creation is limited to paid tiers.',
    cta: { label: 'Get Verified Free', href: '/auth' },
  },
  {
    name: 'Supporter (Core)',
    price: '€9',
    period: '/mo',
    features: [
      'All Free features',
      'Create new topics (seed debates)',
      'Ask up to 5 follow‑up questions',
      'Host live‑stream debates (when launched)',
      'Priority moderation & support',
    ],
    note: 'Most popular — sustains the platform and unlocks control.',
    cta: { label: 'Join Supporter', href: '/auth' },
    featured: true,
  },
  {
    name: 'Academic / NGO License',
    price: '€99–199',
    period: '/mo (or €10–15/seat)',
    features: [
      'All Supporter features for students/staff',
      'Institution‑wide verified accounts',
      'Private debate rooms (classes/NGOs)',
      'Analytics dashboards & shared moderation',
      'Multi‑classroom / group management',
    ],
    note: 'Bring civil, evidence‑based debate to education and civil society.',
    cta: { label: 'Contact for License', href: '/auth' },
  },
  {
    name: 'Enterprise / Premium',
    price: '€299–499',
    period: '/mo (custom)',
    features: [
      'All Academic features',
      'Dedicated analytics & reporting',
      'API access for research/monitoring',
      'Custom moderation & SLA',
      'Team dashboards & branded spaces',
    ],
    note: 'For think tanks, research orgs, and large institutions.',
    cta: { label: 'Talk to Us', href: '/auth' },
  },
];

function TierCard({ plan }: { plan: Plan }) {
  const isFeatured = !!plan.featured;
  return (
    <div
      className={[
        'flex h-full min-h-[600px] md:min-h-[640px] xl:min-h-[680px] flex-col rounded-xl border shadow-sm',
        isFeatured
          ? 'bg-gradient-to-b from-rose-500/15 to-fuchsia-500/10 border-rose-500/40 ring-1 ring-rose-400/40 shadow-rose-500/10'
          : 'bg-black/55 border-white/12',
      ].join(' ')}
    >
      {/* Top: title + price */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        {isFeatured && (
          <div className="mb-2 inline-flex items-center rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] font-medium tracking-wide text-rose-200 ring-1 ring-rose-400/30">
            Most popular
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <h3 className="text-white text-lg md:text-xl font-semibold tracking-tight">
            {plan.name}
          </h3>
          <div className="text-white">
            <span className="text-2xl md:text-3xl font-bold">{plan.price}</span>
            <span className="ml-1 text-white/70 text-sm md:text-base font-normal">{plan.period}</span>
          </div>
        </div>
      </div>
      <div className="px-6">
        <div className="h-px w-full bg-white/15 rounded" />
      </div>

      {/* Middle: features */}
      <div className="flex-1 px-6 py-5 text-white/85">
        <ul className="space-y-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className={isFeatured ? 'h-4 w-4 text-rose-300 mt-0.5' : 'h-4 w-4 text-white/60 mt-0.5'} />
              <span className="text-sm leading-6">{f}</span>
            </li>
          ))}
        </ul>
        {plan.note && (
          <p className="mt-4 text-xs text-white/60 leading-5">{plan.note}</p>
        )}
      </div>
      <div className="px-6">
        <div className="h-px w-full bg-white/15 rounded" />
      </div>

      {/* Bottom: CTA */}
      <div className="px-6 py-5 mt-auto">
        <Button asChild className={isFeatured ? 'w-full bg-rose-500 hover:bg-rose-400 text-white' : 'w-full'}>
          <Link href={plan.cta.href}>{plan.cta.label}</Link>
        </Button>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] -mx-4 md:-mx-6 lg:-mx-8 -my-4 md:-my-6 lg:-my-8">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/video-poster.svg"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/db8-video-bg.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-black/50 z-10" />

      <div className="container mx-auto px-4 py-10 relative z-20">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">Pricing</h1>
          <p className="mt-2 text-white/70">Simple plans. No ads. No dark patterns.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 max-w-[84rem] mx-auto items-stretch">
          {plans.map((plan) => (
            <TierCard key={plan.name} plan={plan} />
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-white/55">
          Stripe billing hooks are in place; paid checkout will be enabled as tiers launch.
        </p>
      </div>
    </div>
  );
}
