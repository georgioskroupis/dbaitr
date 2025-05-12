import { getTopicById, getPostsForTopic } from '@/lib/firestoreActions';
import { TopicDetailClient } from '@/components/topics/TopicDetailClient';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Frown } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TopicPageProps {
  params: {
    topicId: string;
  };
}

// Enable dynamic rendering and revalidation
export const dynamic = 'force-dynamic';
// export const revalidate = 60; // Revalidate data every 60 seconds

export default async function TopicPage({ params }: TopicPageProps) {
  const topicId = params.topicId;
  
  const topic = await getTopicById(topicId);
  
  if (!topic) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center text-center">
        <Frown className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Topic Not Found</h1>
        <p className="text-muted-foreground mb-6">The debate topic you're looking for doesn't exist or may have been removed.</p>
        <Button asChild>
          <Link href="/dashboard">Back to Topics</Link>
        </Button>
      </div>
    );
  }

  // Fetch posts in parallel or sequentially after topic is confirmed
  const posts = await getPostsForTopic(topicId);

  return (
    <div className="container mx-auto py-6">
      <TopicDetailClient initialTopic={topic} initialPosts={posts} />
    </div>
  );
}
