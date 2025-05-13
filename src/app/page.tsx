
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gavel } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/Logo';
import { useToast } from '@/hooks/use-toast';
import { findSimilarTopics } from '@/ai/flows/find-similar-topics';
import { getAllTopicTitles, getTopicByTitle } from '@/lib/firestoreActions';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingTopicTitles, setExistingTopicTitles] = useState<string[]>([]);

  const videoUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-video-bg.mp4?alt=media";
  const actionButtonIconUrl = "https://firebasestorage.googleapis.com/v0/b/db8app.firebasestorage.app/o/db8-debate-icon-white.png?alt=media&token=498c3433-2870-440d-aa40-3634a450c8ad";

  useEffect(() => {
    async function fetchTopics() {
      try {
        const titles = await getAllTopicTitles();
        setExistingTopicTitles(titles);
      } catch (error) {
        console.error("Detailed error: Failed to load existing topic titles for the homepage search functionality:", error);
        toast({
          title: "Error Loading Topic Data",
          description: "Failed to load the list of existing debate topics. This might be a temporary network issue or a problem with our servers. Please try refreshing the page. If the problem persists, please contact support.",
          variant: "destructive",
        });
      }
    }
    fetchTopics();
  }, [toast]);

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: "Empty Search", description: "Please enter a topic to search or create.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const similarTopicsResult = await findSimilarTopics({
        newTopic: searchQuery,
        existingTopics: existingTopicTitles,
      });

      if (similarTopicsResult.isSimilar && similarTopicsResult.closestMatch) {
        const existingTopic = await getTopicByTitle(similarTopicsResult.closestMatch);
        if (existingTopic?.id) {
          toast({ title: "Topic Found!", description: `Redirecting to "${existingTopic.title}".` });
          router.push(`/topics/${existingTopic.id}`);
          return;
        }
      }
      
      toast({ title: "Create New Topic", description: `Let's create "${searchQuery}".` });
      router.push(`/topics/new?title=${encodeURIComponent(searchQuery)}`);

    } catch (error: any) {
      console.error("Detailed error: Error during topic search or initial creation step:", error);
      toast({
        title: "Search/Create Topic Error",
        description: `Something went wrong while trying to search for or create the topic "${searchQuery}". Please check your internet connection and try again. If the problem continues, please contact support. Error detail: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex min-h-screen flex-col items-center justify-center p-4 md:p-8 overflow-hidden",
    )}>
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-[-2]"
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-75 z-[-1]"></div>
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl text-center space-y-8">
        <Logo width={280} href="/" />
        
        <form onSubmit={handleSearchSubmit} className="w-full space-y-6 group">
          <div className="relative">
            <Gavel
              className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary transition-transform group-hover:rotate-[10deg] group-focus-within:rotate-[10deg]"
              strokeWidth={2}
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What are you debating about?"
              className="w-full pl-14 pr-14 py-4 text-lg rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur-md transition"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              disabled={isLoading || !searchQuery.trim()}
              aria-label="Search"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white/80" />
              ) : (
                <img
                  src={actionButtonIconUrl}
                  alt="Search"
                  className="h-5 w-5"
                />
              )}
            </Button>
          </div>
        </form>
      </div>
       <p className="relative z-10 mt-auto pt-8 text-center text-base text-white/50 font-light footer-text">
        &copy; {new Date().getFullYear()} db8. All rights reserved.
      </p>
    </div>
  );
}

