"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

export default function HomePage() {
  const { user, loading, isVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (isVerified) {
          router.replace('/dashboard');
        } else {
          router.replace('/verify-identity');
        }
      } else {
        router.replace('/sign-in');
      }
    }
  }, [user, loading, isVerified, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <Logo width={180} href="/" />
      <Loader2 className="h-12 w-12 animate-spin text-primary mt-8" />
      <p className="mt-4 text-lg text-foreground">Loading db8...</p>
    </div>
  );
}
