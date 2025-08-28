"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/mo',
      features: [
        'Read any debate',
        'Post 1 statement per topic',
        'Ask up to 3 questions per statement',
        'AI sentiment on your posts',
        'No ads — ever',
      ],
      cta: { label: 'Get Started', href: '/auth' },
    },
    {
      name: 'Pro',
      price: '$9',
      period: '/mo',
      features: [
        'Unlimited statements & questions',
        'Priority analysis & insights',
        'Advanced filters & exports',
        'Upcoming: creator tools',
        'No ads — ever',
      ],
      note: 'Transparent pricing. Cancel anytime.',
      cta: { label: 'Join Waitlist', href: '/auth' },
    },
  ];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-white">Pricing</h1>
        <p className="mt-2 text-white/70">Simple plans — clearly labeled. No ads. No dark patterns.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
        {plans.map((p) => (
          <Card key={p.name} className="bg-black/40 border border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-baseline justify-between">
                <span>{p.name}</span>
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
                <Button asChild className="bg-rose-500 hover:bg-rose-400">
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-white/50">Stripe billing hooks are in place; checkout will be enabled when Pro launches.</p>
    </div>
  );
}

