// src/app/(app)/layout.tsx
"use client"; 

import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation'; 
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster'; 
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; 
import { Button } from '@/components/ui/button'; 
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TopNav } from '@/components/layout/TopNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
import { cn } from '@/lib/utils'; // Added import for cn

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isSuspended, kycVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (isSuspended) {
        if (pathname !== '/verify-identity' && pathname !== '/account-suspended') {
          router.replace('/account-suspended');
        }
      } else if (user && !kycVerified && pathname === '/account-suspended') { // User exists, not suspended, but not KYC verified, and on suspension page
        router.replace('/verify-identity'); // Guide to verify
      } else if (user && kycVerified && pathname === '/account-suspended') { // User exists, KYC verified, but somehow on suspension page
        router.replace('/dashboard'); // Should be on dashboard
      }
    }
  }, [authLoading, user, isSuspended, kycVerified, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-white/80">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
        <p className="mt-4 text-lg">Loading your db8 experience...</p>
      </div>
    );
  }
  
  const showSuspensionBanner = isSuspended && pathname !== '/account-suspended' && pathname !== '/verify-identity';

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {!isMobile && <TopNav variant="default" />}
      
      <main className={cn(
        "flex-1 w-full mx-auto",
        isMobile ? "pb-16" : "pt-0", // Padding for bottom nav
        "p-4 md:p-6 lg:p-8" 
      )}>
        {showSuspensionBanner && (
          <Alert variant="destructive" className="mb-6 bg-red-900/50 border-red-700 text-red-200">
            <AlertTitle className="font-semibold">Account Access Restricted</AlertTitle>
            <AlertDescription>
              Your identity verification is overdue. Please complete it to restore full access.
              <Button variant="link" asChild className="p-0 ml-2 text-rose-300 hover:text-rose-200 underline">
                <Link href="/verify-identity">Verify Identity Now</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>

      {isMobile && <BottomNav setSearchModalOpen={setIsSearchModalOpen} />}
      <GlobalSearchModal isOpen={isSearchModalOpen} onOpenChange={setIsSearchModalOpen} />

      <footer className="border-t border-white/10 py-4 text-center text-sm text-white/50 bg-black/80 backdrop-blur-sm">
        © {new Date().getFullYear()} db8 - AI Powered Debates
      </footer>
      <Toaster />
    </div>
  );
}
