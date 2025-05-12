
'use client';

import { useEffect, useState } from 'react';
import { seedTestData } from '@/lib/seedDatabase';
import { useToast } from '@/hooks/use-toast';

const SEED_FLAG_KEY = 'db8_seeded_v2'; // Changed key to ensure re-seed if old flag existed

export default function AppBootstrapper() {
  const { toast } = useToast();
  const [isSeedingAttempted, setIsSeedingAttempted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSeedingAttempted) {
      const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY);

      if (alreadySeeded === 'true') {
        console.log('✅ db8: Seeding previously completed (localStorage flag found). Skipping.');
        setIsSeedingAttempted(true); // Mark as attempted to avoid re-runs in HMR
        return;
      }

      setIsSeedingAttempted(true); // Mark as attempted before async call
      console.log('ℹ️ db8: LocalStorage flag not found. Attempting to check/run seed data function...');

      let isMounted = true;

      async function runSeed() {
        try {
          const result = await seedTestData();
          if (isMounted) {
            console.log('🔥 Seed function result:', result.message);
            if (result.success) {
              // If the function indicates it actually wrote data or confirmed it's okay to set the flag
              if (result.message.includes("successfully written") || result.message.includes("already contains topic data")) {
                localStorage.setItem(SEED_FLAG_KEY, 'true');
                console.log('✅ db8: localStorage flag set. Seeding process complete for this browser.');
                 if (result.message.includes("successfully written")) {
                    toast({
                        title: "Database Seeded",
                        description: result.message,
                        variant: "default",
                        duration: 5000,
                    });
                 }
              }
            } else {
                toast({
                    title: "Database Seeding Check Failed",
                    description: `Could not complete the seed check process: ${result.message}`,
                    variant: "destructive",
                    duration: 9000,
                });
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error('🔥 Error calling seedTestData function:', error);
            let errorMessage = 'An unknown error occurred during the seeding process.';
            if (error instanceof Error) {
              errorMessage = error.message;
            }
            toast({
              title: "Database Seeding Failed",
              description: `Could not automatically seed database: ${errorMessage}`,
              variant: "destructive",
              duration: 9000,
            });
          }
        }
      }

      runSeed();

      return () => {
        isMounted = false;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeedingAttempted]); // Runs when isSeedingAttempted changes or on mount

  return null;
}
