
// src/app/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';
import { TopNav } from '@/components/layout/TopNav';
import { SearchBar } from '@/components/search/SearchBar';


export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [enableVideoBg, setEnableVideoBg] = useState(false);
 
  const videoUrl = "/db8-video-bg.mp4";
  // const actionButtonIconUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/dbaitr-gavel-hook-favicon.png?alt=media"; // Old gavel hook, not the bubble

  // Defer background video loading; respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mql && mql.matches) {
      setEnableVideoBg(false);
      return;
    }
    const node = heroRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setEnableVideoBg(true);
          obs.disconnect();
        }
      },
      { root: null, threshold: 0.1, rootMargin: '0px 0px 200px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

 


  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      <TopNav variant="landing" />
      {/* Inline critical CSS to prevent first-paint resize of logo width */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Reserve exact width+height for the logo at first paint (bigger across breakpoints) */
            #landing-logo-wrap{width:260px;height:58px;margin-left:auto;margin-right:auto}
            @media (min-width:640px){#landing-logo-wrap{width:320px;height:71px}}
            @media (min-width:768px){#landing-logo-wrap{width:420px;height:93px}}
            @media (min-width:1024px){#landing-logo-wrap{width:520px;height:116px}}

            /* Raise the stack without relying on external CSS */
            #landing-stack{transform:translateY(-96px)}
            @media (min-width:768px){#landing-stack{transform:translateY(-112px)}}
          `,
        }}
      />
      <div ref={heroRef} className={cn(
        "relative flex-1 p-4 md:p-8",
      )}>
        {enableVideoBg ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/video-poster.svg"
            aria-hidden="true"
            className="absolute top-0 left-0 w-full h-full object-cover z-[-2]"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 w-full h-full object-cover z-[-2]"
            style={{ backgroundImage: 'url(/video-poster.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-[-1]"></div> {/* Overlay for readability */}

        {/* Centered content */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div id="landing-stack" className="w-full max-w-2xl mx-auto text-center space-y-8">
            <div id="landing-logo-wrap">
              <Logo
                width={520}
                href="/"
                sizes="(min-width:1024px) 520px, (min-width:768px) 420px, (min-width:640px) 320px, 260px"
                fluid
              />
            </div>

            <SearchBar placeholder="What's the debate?" />
          </div>
        </div>
      </div>
    </div>
  );
}
