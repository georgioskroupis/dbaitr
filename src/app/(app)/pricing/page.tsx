"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PricingPage() {
  const plans = [
    {
      name: 'Free Verified User',
      price: '€0',
      period: '/mo',
      features: [
        'Verify identity (no bots, no anonymous)',
        'Post statements (opinion, experience, fact — sources for facts)',
        'Ask up to 3 follow-up questions per statement',
        'Post responses to questions',
        'Search & join existing topics',
        'AI-assisted drafting & sentiment analytics',
        'No ads — ever',
      ],
      note: 'Truth tools for all. Topic creation is limited to paid tiers.',
      cta: { label: 'Get Verified Free', href: '/auth' },
      featured: false,
    },
    {
      name: 'Supporter (Core)',
      price: '€9',
      period: '/month',
      features: [
        'All Free features',
        'Create new topics (seed debates)',
        'Ask up to 5 follow-up questions per statement',
        'Host live-stream debates (when launched)',
        'Priority moderation & support',
      ],
      note: 'Sustains the platform; unlocks control and advanced participation.',
      cta: { label: 'Join Supporter', href: '/auth' },
      featured: true,
    },
    {
      name: 'Academic / NGO License',
      price: '€99–199',
      period: '/month (or €10–15/seat)',
      features: [
        'All Supporter features for students/staff',
        'Institution-wide verified accounts',
        'Private debate rooms (classes, NGOs, workshops)',
        'Analytics dashboards (participation, engagement, outcomes)',
        'Shared moderation tools',
        'Multi-classroom / group management',
      ],
      note: 'Expands dbaitr into education and civil society at scale.',
      cta: { label: 'Contact for License', href: '/auth' },
      featured: false,
    },
    {
      name: 'Enterprise / Premium',
      price: '€299–499',
      period: '/month (custom scaling)',
      features: [
        'All Academic features',
        'Dedicated analytics & reporting',
        'API access for research/monitoring',
        'Custom moderation & SLA',
        'Team dashboards',
        'Branded debate spaces',
      ],
      note: 'For think tanks, research orgs, and large institutions.',
      cta: { label: 'Talk to Us', href: '/auth' },
      featured: false,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-white">Pricing</h1>
        <p className="mt-2 text-white/70">Simple plans — clearly labeled. No ads. No dark patterns.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
        {plans.map((p) => (
          <Card key={p.name} className={`border ${p.featured ? 'bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 border-rose-500/30' : 'bg-black/40 border-white/10'}`}>
            <CardHeader>
              <CardTitle className="text-white flex items-baseline justify-between">
                <span className="tracking-tight">{p.name}</span>
                <span className="text-xl font-semibold">{p.price}<span className="text-white/60 text-sm font-normal">{p.period}</span></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white/80 space-y-4">
              <ul className="space-y-2 list-disc list-inside">
                {p.features.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
              {p.note && <p className="text-xs text-white/60">{p.note}</p>}
              <div className="pt-2">
                <Button asChild className={p.featured ? 'bg-rose-500 hover:bg-rose-400' : ''}>
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-white/50">Stripe billing hooks are in place; paid checkout will be enabled as tiers launch.</p>
    </div>
  );
}
