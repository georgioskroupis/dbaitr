import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ShieldCheck, Scale, Sparkles, Eye, UserCheck, MessageSquare, ListChecks, Lock } from 'lucide-react';
import { BrandTooltip } from '@/components/branding/BrandTooltip';

export const metadata = {
  title: 'Manifesto · dbaitr',
  description: 'Our pledge and manifesto for civil, evidence-based debates with safety, transparency, and human-first decisions.',
};

const tldrItems = [
  'Real people, no hiding',
  'Civil debates only',
  'Evidence > hype',
  'Rules apply equally',
  'AI helps, humans decide',
  'Safety first, always',
  'Minimal data, full transparency',
  'Fair, capture-proof business',
];

const tldrIconMap: Record<string, JSX.Element> = {
  'Real people, no hiding': <UserCheck className="h-4 w-4 text-primary" />,
  'Civil debates only': <MessageSquare className="h-4 w-4 text-primary" />,
  'Evidence > hype': <Scale className="h-4 w-4 text-primary" />,
  'Rules apply equally': <ListChecks className="h-4 w-4 text-primary" />,
  'AI helps, humans decide': <Sparkles className="h-4 w-4 text-primary" />,
  'Safety first, always': <ShieldCheck className="h-4 w-4 text-primary" />,
  'Minimal data, full transparency': <Eye className="h-4 w-4 text-primary" />,
  'Fair, capture-proof business': <Lock className="h-4 w-4 text-primary" />,
};

export default function ManifestoPage() {
  const videoUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-video-bg.mp4?alt=media";
  return (
    <div className="relative min-h-screen">
      {/* Background video + overlay */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/video-poster.svg"
        aria-hidden="true"
        className="fixed inset-0 w-full h-full object-cover z-0"
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="fixed inset-0 bg-black/60 z-10 pointer-events-none" />

      <div className="relative z-20 container mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-10 sm:pt-0 sm:pb-12">
      <header className="mb-2 sm:mb-3 text-center">
        <h1 className="relative text-3xl md:text-4xl font-semibold text-white tracking-tight inline-block">
          Manifesto
          <span className="block h-[3px] w-full bg-gradient-to-r from-primary/70 via-primary/30 to-transparent rounded-full mt-2" />
        </h1>
        <p className="mt-3 text-white/70 max-w-2xl mx-auto">What we stand for, how we operate, and the guardrails that keep dbaitr honest.</p>
      </header>

      {/* Dictionary-style term section */}
      <section className="mb-8 sm:mb-10">
        <div className="max-w-[72ch] mx-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-md overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">dbaitr</h2>
              <span className="text-white/60 text-sm sm:text-base">/dɪˈbeɪ.tər/</span>
              <span className="text-primary text-xs sm:text-sm font-medium uppercase tracking-wide">noun</span>
            </div>
            <p className="mt-3 text-sm sm:text-base text-white/80 italic flex">
              <span className="text-white/60 mr-2">1.</span>
              <span>
                Wordplay on <span className="text-primary font-semibold">debater</span> (one who debates) + <span className="text-primary font-semibold">de-baiter</span> (one who removes bait).
              </span>
            </p>
            <p className="mt-3 text-sm sm:text-base text-white/90 leading-relaxed flex">
              <span className="text-white/60 mr-2">2.</span>
              <span>
                A person who argues with <span className="text-primary font-semibold">clarity</span>, <span className="text-primary font-semibold">civility</span>, and <span className="text-primary font-semibold">evidence</span>—while stripping away click‑bait, noise, and manipulation in the digital world.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* TL;DR Card */}
      <section className="mb-10 sm:mb-12">
        <div className="max-w-[72ch] mx-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-xl shadow-md overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">
              <span className="text-primary">Pledge</span> (at a glance)
            </h2>
            <ul className="grid sm:grid-cols-2 gap-2 sm:gap-3">
              {tldrItems.map((line, i) => (
                <li
                  key={i}
                  className="group flex items-center gap-3 text-sm sm:text-base rounded-md px-2 py-1 transition-colors hover:bg-white/5"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 border border-primary/20 text-primary">
                    {tldrIconMap[line] ?? <Sparkles className="h-4 w-4" />}
                  </span>
                  <span className="text-white/90">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Full Manifesto */}
      <section>
        <article className="max-w-[72ch] leading-relaxed mx-auto text-left">
          <p className="dropcap text-white/90">
            We built <BrandTooltip><span className="text-primary font-semibold underline decoration-transparent hover:decoration-primary/50 decoration-2 underline-offset-2 cursor-help">dbaitr</span></BrandTooltip> because <span className="text-primary font-semibold">truth</span> is getting drowned out by noise, bots, and outrage. Here, everything happens under <span className="text-primary font-semibold">real names</span>. No hiding, no anonymous sniping. If you’ve got an opinion, an experience, or a fact, you can put it on the table. But it has to stand up to questions, challenges, and <span className="text-primary font-semibold">evidence</span>. That’s the point—truth isn’t a slogan, it’s a process.
          </p>
          <div className="gradient-divider h-px my-6 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <p className="text-white/90 mt-4">
            Every voice gets space, but evidence wins the day. Majority doesn’t equal truth, critique beats consensus, and anyone can change their mind when shown something better. We keep it plain: no jargon shields, no outrage farming. Just structured question-and-response debates where authors defend their statements and anyone can ask—up to three times. You tag your claim as <span className="text-primary font-semibold">opinion</span>, <span className="text-primary font-semibold">experience</span>, or <span className="text-primary font-semibold">fact</span>, and if it’s a fact, we expect a source. <span className="text-primary font-semibold">Civility</span> isn’t optional. <span className="text-primary font-semibold">Bots</span> are banned. And if <span className="text-primary font-semibold">AI</span> helps draft something, it’s labeled clearly.
          </p>
          <p className="text-white/90 mt-4">
            <span className="text-primary font-semibold">Safety</span> is non-negotiable. Harassment, doxxing, manipulation, or deliberate misinformation? Gone. Severe abuse = permanent ban. Everything else follows a clear path: detect → act → allow appeal → learn. <span className="text-primary font-semibold">Appeals</span> exist, and we share aggregate outcomes publicly. We collect as little data as possible, keep it only as long as needed, and encrypt everything. <span className="text-primary font-semibold">Transparency</span> reports go out so everyone knows where we stand.
          </p>
          <p className="text-white/90 mt-4">
            <span className="text-primary font-semibold">AI</span> is here, but it never has the last word. It helps draft, discover, and suggest—but <span className="text-primary font-semibold">humans decide</span>. Identity is verified so accountability stays intact, but <span className="text-primary font-semibold">privacy</span> is respected. We’re serious about moderation, serious about uptime, and serious about moving fast in small, safe steps. <span className="text-primary font-semibold">Reliability</span> beats novelty. Truth beats polish.
          </p>
          <p className="text-white/90 mt-4">
            Access to truth stays <span className="text-primary font-semibold">free</span>. Early on, we fund it ourselves. As we grow, crowdfunding and fair subscriptions keep it alive. No shady deals, no ads that skew the platform, no tricks in pricing. Everything stays simple and <span className="text-primary font-semibold">fair</span>. Inside the team, we live by the same rules we set outside: be kind, be direct, be ready to be wrong. We disagree productively, document decisions, and keep them reversible when we can.
          </p>
          <p className="text-white/90 mt-4">
            If this works, success won’t look like metrics or dashboards. It’ll be quiet, human moments: a lie exposed, a truth defended, someone learning. If we fail, it’ll be because we forgot the very thing we came to protect. But if we succeed, it means future generations—including our own kids—can thank us for keeping <span className="text-primary font-semibold">truth</span> alive in the digital age.
          </p>
          <div className="mt-6 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 px-4 py-3 text-center shadow-[0_0_30px_-15px_rgba(236,39,51,0.5)]">
            <span className="text-white/90"> <BrandTooltip><span className="text-primary font-semibold underline decoration-transparent hover:decoration-primary/50 decoration-2 underline-offset-2 cursor-help">dbaitr</span></BrandTooltip>: de-bait everything.</span>
          </div>
        </article>
      </section>
      </div>
    </div>
  );
}
