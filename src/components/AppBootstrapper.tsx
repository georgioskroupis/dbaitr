
'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { seedMultiTopicTestData } from '@/lib/seedDatabase'; // Updated to use the new seed function
import { initAppCheckIfConfigured } from '@/lib/appCheckClient';
import { useToast } from '@/hooks/use-toast';

const SEED_FLAG_KEY = 'db8_seeded_v3_multitopic'; // Changed key to ensure re-seed with new data

export default function AppBootstrapper() {
  const { toast } = useToast();
  const [isSeedingAttempted, setIsSeedingAttempted] = useState(false);

  useEffect(() => {
    // Initialize App Check if configured
    initAppCheckIfConfigured();
    // This effect should only run once per component mount.
    // The isSeedingAttempted state helps manage if we've already tried in this session.
    // The localStorage flag manages persistence across sessions/reloads for the same browser.
    if (typeof window !== 'undefined' && !isSeedingAttempted) {
      const alreadySeededThisBrowser = localStorage.getItem(SEED_FLAG_KEY);

      if (alreadySeededThisBrowser === 'true') {
        logger.debug('✅ db8 (AppBootstrapper): Multi-topic seeding previously completed in this browser (localStorage flag found). Skipping.');
        setIsSeedingAttempted(true); 
        return;
      }

      setIsSeedingAttempted(true); 
      logger.debug('ℹ️ db8 (AppBootstrapper): Multi-topic localStorage flag not found. Attempting to check/run seed data function...');

      let isMounted = true;

      async function runSeed() {
        try {
          const result = await seedMultiTopicTestData(); 
          if (isMounted) {
            logger.debug('🔥 AppBootstrapper: Multi-topic seed function result:', result.message);
            if (result.success) {
              // Set localStorage flag if seeding was successful OR if data was confirmed to already exist.
              // This prevents repeated checks from AppBootstrapper on subsequent visits in the same browser.
              localStorage.setItem(SEED_FLAG_KEY, 'true');
              logger.debug('✅ db8 (AppBootstrapper): localStorage flag set. Seeding process marked as complete for this browser session.');
              
              // Only toast if new data was actually written by this specific call.
              if (result.message.includes("successfully written")) { 
                toast({
                    title: "Database Seeded with New Topics",
                    description: "The initial set of multi-topic debate data has been successfully loaded.",
                    variant: "default",
                    duration: 7000,
                });
              } else if (result.message.includes("already contains")) {
                logger.debug("✅ db8 (AppBootstrapper): Multi-topic data already present in Firestore, no new data written by this call.");
              }
            } else { // Seeding check/write failed
                toast({
                    title: "Initial Data Check Failed",
                    description: `Could not complete the initial multi-topic seed process: ${result.message}. Some features may be limited.`,
                    variant: "destructive",
                    duration: 9000,
                });
            }
          }
        } catch (error) {
          if (isMounted) {
            logger.error('🔥 AppBootstrapper: Error calling seedMultiTopicTestData function:', error);
            let errorMessage = 'An unknown error occurred during the initial multi-topic seeding process.';
            if (error instanceof Error) {
              errorMessage = error.message;
            }
            toast({
              title: "Initial Data Setup Failed",
              description: `Could not automatically set up initial database with new topics: ${errorMessage}. Please try refreshing or contact support.`,
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
  }, [isSeedingAttempted]); // Removed toast from deps, it's stable from useToast hook

  return null;
}
