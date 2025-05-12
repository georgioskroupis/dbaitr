
"use client"; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TopicCard } from '@/components/topics/TopicCard';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import { getTopics } from '@/lib/firestoreActions';
import type { Topic } from '@/types';
import { useAuth } from '@/context/AuthContext'; 
import { useToast } from "@/hooks/use-toast";


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth(); 
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const { toast } = useToast();

  // Removed useEffect that redirected unauthenticated users.
  // Dashboard is now publicly accessible.

  useEffect(() => {
    async function fetchTopics() {
      setIsLoadingTopics(true);
      try {
        const fetchedTopics = await getTopics();
        setTopics(fetchedTopics);
      } catch (error: any) {
        console.error("Detailed error: Failed to fetch topics for the dashboard:", error);
        toast({
          title: "Error Loading Debate Topics",
          description: `We couldn't load the debate topics at this time. This might be a network issue or a problem with our servers. Please try refreshing the page or check your internet connection. Error: ${error.message || 'Unknown error.'}`,
          variant: "destructive",
        });
      } finally {
        setIsLoadingTopics(false);
      }
    }
    // Fetch topics once authentication status is resolved, regardless of whether a user is logged in.
    if (!authLoading) {
        fetchTopics();
    }
  }, [authLoading, toast]); // Removed `user` from dependency array as topics are public.


  // Display loading indicator while auth state or topics are loading.
  if (authLoading || isLoadingTopics) { 
    return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">
          {authLoading ? "Loading Dashboard..." : "Loading Topics..."}
        </p>
      </div>
    );
  }


  return (
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Debate Topics</h1>
        {/* "Create New Topic" button will lead to /topics/new, which has its own auth/KYC checks */}
        <Button asChild>
          <Link href="/topics/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Topic
          </Link>
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card text-center">
          <img src="https://picsum.photos/seed/empty-dashboard/300/200" alt="Empty state" data-ai-hint="empty state no topics" className="mb-6 rounded-md opacity-70" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">No Debate Topics Yet</h2>
          <p className="text-muted-foreground mb-6">It looks a bit quiet here. Be the first to spark a debate and create a new topic!</p>
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
