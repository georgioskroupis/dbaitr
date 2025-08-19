"use client";

import { useEffect, useRef, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      setProgress(pct);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed top-0 md:top-16 left-0 right-0 z-40 pointer-events-none">
      <div className="h-px bg-border" />
      <div
        className="relative -mt-px h-px will-change-transform origin-left bg-gradient-to-r from-primary/70 via-primary to-primary/70"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden
      />
    </div>
  );
}
