
"use client"; // Make it a client component to use hooks

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TopicCard } from '@/components/topics/TopicCard';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import { getTopics } from '@/lib/firestoreActions';
import type { Topic } from '@/types';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

// export const revalidate = 60; // Revalidate every 60 seconds - remove for client component with dynamic data fetching

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth(); // Use auth context
  const router = useRouter();
  const [topics, setTopics] = React.useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = React.useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/'); // Redirect to homepage if not authenticated
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchTopics() {
      if (user) { // Only fetch if user is authenticated
        setIsLoadingTopics(true);
        try {
          const fetchedTopics = await getTopics();
          setTopics(fetchedTopics);
        } catch (error) {
          console.error("Failed to fetch topics:", error);
          // Handle error (e.g., show toast)
        } finally {
          setIsLoadingTopics(false);
        }
      }
    }
    if (!authLoading && user) {
        fetchTopics();
    }
  }, [user, authLoading]);


  if (authLoading || (!user && !authLoading)) { // Show loader if auth is loading or if redirecting
    return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading Dashboard...</p>
      </div>
    );
  }
  
  if (isLoadingTopics) {
     return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading Topics...</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Debate Topics</h1>
        <Button asChild>
          <Link href="/topics/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Topic
          </Link>
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card text-center">
          <img src="https://picsum.photos/seed/empty/300/200" alt="Empty state" data-ai-hint="empty state" className="mb-6 rounded-md opacity-70" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">No Topics Yet</h2>
          <p className="text-muted-foreground mb-6">Be the first to start a debate!</p>
          <Button asChild size="lg">
            <Link href="/topics/new">
              <PlusCircle className="mr-2 h-5 w-5" />
              Create Your First Topic
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
