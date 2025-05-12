
'use client';

import { useEffect, useState } from 'react';
import { seedMultiTopicTestData } from '@/lib/seedDatabase'; // Updated to use the new seed function
import { useToast } from '@/hooks/use-toast';

const SEED_FLAG_KEY = 'db8_seeded_v3_multitopic'; // Changed key to ensure re-seed with new data

export default function AppBootstrapper() {
  const { toast } = useToast();
  const [isSeedingAttempted, setIsSeedingAttempted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isSeedingAttempted) {
      const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY);

      if (alreadySeeded === 'true') {
        console.log('✅ db8: Multi-topic seeding previously completed (localStorage flag found). Skipping.');
        setIsSeedingAttempted(true); 
        return;
      }

      setIsSeedingAttempted(true); 
      console.log('ℹ️ db8: Multi-topic localStorage flag not found. Attempting to check/run seed data function...');

      let isMounted = true;

      async function runSeed() {
        try {
          // Call the new seed function
          const result = await seedMultiTopicTestData(); 
          if (isMounted) {
            console.log('🔥 Multi-topic seed function result:', result.message);
            if (result.success) {
              if (result.message.includes("successfully written") || result.message.includes("already contains the new multi-topic dataset")) {
                localStorage.setItem(SEED_FLAG_KEY, 'true');
                console.log('✅ db8: Multi-topic localStorage flag set. Seeding process complete for this browser.');
                 if (result.message.includes("successfully written")) { // Only toast if new data was actually written
                    toast({
                        title: "Database Seeded with New Topics",
                        description: result.message,
                        variant: "default",
                        duration: 7000, // Increased duration for visibility
                    });
                 }
              }
            } else {
                toast({
                    title: "Database Multi-Topic Seeding Check Failed",
                    description: `Could not complete the multi-topic seed check process: ${result.message}`,
                    variant: "destructive",
                    duration: 9000,
                });
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error('🔥 Error calling seedMultiTopicTestData function:', error);
            let errorMessage = 'An unknown error occurred during the multi-topic seeding process.';
            if (error instanceof Error) {
              errorMessage = error.message;
            }
            toast({
              title: "Database Multi-Topic Seeding Failed",
              description: `Could not automatically seed database with new topics: ${errorMessage}`,
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
  }, [isSeedingAttempted]); 

  return null;
}

    