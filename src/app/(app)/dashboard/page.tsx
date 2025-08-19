
"use client"; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TopicCard } from '@/components/topics/TopicCard';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { Topic } from '@/types';
import { useAuth } from '@/context/AuthContext'; 
import { useToast } from "@/hooks/use-toast";
// import { seedMultiTopicTestData } from '@/lib/seedDatabase';


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth(); 
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const { toast } = useToast();

  // Seeding is manual via /admin/seed-firestore to avoid client→server action imports.


  useEffect(() => {
    async function fetchTopics() {
      setIsLoadingTopics(true);
      try {
        const res = await fetch('/api/topics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTopics(Array.isArray(data.topics) ? data.topics : []);
      } catch (error: any) {
        logger.error("Detailed error: Failed to fetch topics for the dashboard:", error);
        toast({
          title: "Error Loading Debate Topics",
          description: `We couldn't load the debate topics at this time. This might be a network issue or a problem with our servers. Please try refreshing the page or check your internet connection. Error: ${error.message || 'Unknown error.'}`,
          variant: "destructive",
        });
      } finally {
        setIsLoadingTopics(false);
      }
    }
    if (!authLoading) {
        fetchTopics();
    }
  }, [authLoading, toast]); 


  if (authLoading || isLoadingTopics) { 
    return (
      <div className="flex min-h-[calc(100vh-150px)] flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
        <p className="mt-4 text-lg text-white/80">
          {authLoading ? "Loading Dashboard..." : "Loading Topics..."}
        </p>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white">Debate Topics</h1>
        {/* "Create New Topic" button removed as per request */}
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 sm:py-12 border-2 border-dashed border-white/10 rounded-xl bg-black/20 text-center backdrop-blur-sm">
          <img src="https://placehold.co/300x200.png" alt="Empty state" data-ai-hint="empty state no topics" className="mb-6 rounded-md opacity-70 w-full max-w-[320px] h-auto" />
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">No debates yet. Be the first de-baiter to speak.</h2>
          <p className="text-white/60 mb-6 max-w-prose px-4">Silence isn’t truth. Add your voice.</p>
          <Button asChild size="lg" className="px-4 sm:px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition">
            <Link href="/topics/new">
              <PlusCircle className="mr-2 h-5 w-5" /> Post your truth
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
