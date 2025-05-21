
import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(
        "auth-layout flex min-h-screen flex-col items-center justify-center p-4", 
      )}>
      <div className="absolute inset-0 z-[-2] overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-video-bg.mp4?alt=media" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="absolute inset-0 z-[-1] bg-black/50"></div>
      
      <div className="relative z-10 mb-8 flex flex-col items-center">
        <Logo width={160} href="/" /> {/* Use the Logo component with new SVG */}
      </div>
      <div className="relative z-10 w-full max-w-md bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/10">
        {children}
      </div>
      <p className="relative z-10 mt-8 text-center text-sm text-white/50 font-light footer-text">
        &copy; {new Date().getFullYear()} dbaitr. All rights reserved. {/* Changed from db8 */}
      </p>
    </div>
  );
}
