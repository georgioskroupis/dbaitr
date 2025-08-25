
import { getTopicByIdServer, getStatementsForTopicServer } from '@/lib/server/topics';
import { TopicDetailClient } from '@/components/topics/TopicDetailClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Frown } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TopicPageProps {
  params: Promise<{
    topicId: string;
  }>;
}

// Default to automatic/static rendering. Server actions revalidate paths after writes.

export default async function TopicPage({ params }: TopicPageProps) {
  const { topicId } = await params;
  
  const topic = await getTopicByIdServer(topicId);
  
  if (!topic) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center text-center">
        <Frown className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-semibold text-white mb-2">Topic Not Found</h1>
        <p className="text-white/50 mb-6">The debate topic you're looking for doesn't exist or may have been removed.</p>
        <Button asChild className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition">
          <Link href="/dashboard">Back to Topics</Link>
        </Button>
      </div>
    );
  }

  const statements = await getStatementsForTopicServer(topicId); 

  return (
    <div className="container mx-auto py-6">
      <TopicDetailClient initialTopic={topic} initialStatements={statements} /> 
    </div>
  );
}
