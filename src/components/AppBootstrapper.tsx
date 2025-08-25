
'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
// Seeding disabled in production/CI to avoid server-client boundary issues
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

      // Seeding intentionally disabled here to ensure clean SSR/CI builds

      return () => {
        isMounted = false;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeedingAttempted]); // Removed toast from deps, it's stable from useToast hook

  return null;
}
