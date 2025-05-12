
'use client';

import { useEffect } from 'react';
import { seedTestData } from '@/lib/seedDatabase';
import { useToast } from '@/hooks/use-toast';

export default function AppBootstrapper() {
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    async function runSeed() {
      try {
        const result = await seedTestData();
        if (isMounted) {
          console.log('🔥 Seed result:', result.message);
          // Optionally, show a toast message, but only if it's not disruptive
          // For example, only toast on actual seeding, not on skip.
          if (result.message.includes("successfully written")) {
            toast({
              title: "Database Seeded",
              description: result.message,
              variant: "default",
              duration: 5000,
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('🔥 Seed error:', error);
          let errorMessage = 'An unknown error occurred during seeding.';
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
      isMounted = false; // Cleanup: set flag to false when component unmounts
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures it runs once on mount

  return null; // This component does not render anything visible
}
