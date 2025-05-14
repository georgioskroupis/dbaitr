
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
import { seedMultiTopicTestData } from '@/lib/seedDatabase';


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth(); 
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function ensureSeededOnDashboard() {
      console.log('ℹ️ Dashboard: Checking/running multi-topic seed data function...');
      try {
        const result = await seedMultiTopicTestData();
        console.log('📦 Dashboard seed function result:', result.message);
        if (result.success) {
          if (result.message.includes("successfully written")) {
             toast({
                title: "Database Health Check",
                description: "Ensured multi-topic debate data is available.",
                variant: "default",
                duration: 5000,
             });
          } else if (result.message.includes("already contains")) {
              console.log("📦 Dashboard: Multi-topic data confirmed to be present.");
          }
        } else { 
          toast({
            title: "Dashboard Data Check Failed",
            description: `Could not ensure multi-topic seed data from dashboard: ${result.message}. Some topics might be missing.`,
            variant: "destructive",
            duration: 9000,
          });
        }
      } catch (error: any) {
          console.error('🔥 Dashboard: Error calling seedMultiTopicTestData function during dashboard load:', error);
          toast({
              title: "Dashboard Data Error",
              description: `An error occurred during the dashboard's multi-topic data check: ${error.message || 'Unknown error.'}`,
              variant: "destructive",
              duration: 9000,
          });
      }
    }
    ensureSeededOnDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


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
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-semibold text-white">Debate Topics</h1>
        {/* "Create New Topic" button removed as per request */}
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-xl bg-black/20 text-center backdrop-blur-sm">
          <img src="https://placehold.co/300x200.png" alt="Empty state" data-ai-hint="empty state no topics" className="mb-6 rounded-md opacity-70" />
          <h2 className="text-2xl font-semibold text-white mb-2">No Debate Topics Yet</h2>
          <p className="text-white/50 mb-6">It looks a bit quiet here. Be the first to spark a debate and create a new topic!</p>
          <Button asChild size="lg" className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition">
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
