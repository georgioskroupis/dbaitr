
"use client";

import type { Topic, Post as PostType } from '@/types';
import { TopicAnalysis } from './TopicAnalysis';
import { PositionTally } from './PositionTally';
import { PostForm } from './PostForm';
import { DebatePostCard } from './DebatePostCard';
import { useEffect, useState } from 'react';
import { getPostsForTopic, getTopicById, updateTopicWithAnalysis } from '@/lib/firestoreActions';
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, WifiOff } from "lucide-react"; // Added WifiOff for network errors
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton'; 
import { useToast } from '@/hooks/use-toast';


interface TopicDetailClientProps {
  initialTopic: Topic;
  initialPosts: PostType[];
}

export function TopicDetailClient({ initialTopic, initialPosts }: TopicDetailClientProps) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [posts, setPosts] = useState<PostType[]>(initialPosts);
  const [isLoadingTopic, setIsLoadingTopic] = useState<boolean>(!initialTopic.aiAnalysis); 
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const { toast } = useToast();

  // Fetch AI analysis if not already present or if it's empty
  useEffect(() => {
    async function fetchAnalysis() {
      if (topic && (!topic.aiAnalysis || topic.aiAnalysis.trim() === '')) {
        setIsLoadingTopic(true);
        try {
          const analysisResult = await generateTopicAnalysis({ topic: topic.title });
          if (analysisResult.analysis) {
            await updateTopicWithAnalysis(topic.id, analysisResult.analysis); 
            setTopic(prev => ({ ...prev, aiAnalysis: analysisResult.analysis }));
          } else {
            // Case where analysis is empty but no error thrown by AI flow
            console.warn("AI topic analysis result was empty for topic:", topic.title);
          }
        } catch (error: any) {
          console.error(`Detailed error: Failed to generate or fetch AI topic analysis for topic "${topic.title}" (ID: ${topic.id}):`, error);
          toast({
            title: "AI Analysis Unavailable",
            description: `Could not load the AI-generated overview for this topic. This may be a temporary issue with the AI service or network. The debate can still proceed without it. Error: ${error.message || 'Unknown AI error.'}`,
            variant: "default", // Not destructive as it's non-critical
            duration: 7000,
          });
        } finally {
          setIsLoadingTopic(false);
        }
      } else if (topic && topic.aiAnalysis) {
         setIsLoadingTopic(false); 
      }
    }
    fetchAnalysis();
  }, [topic?.id, topic?.title, topic?.aiAnalysis, toast]);

  const refreshPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const updatedPosts = await getPostsForTopic(topic.id);
      setPosts(updatedPosts);
    } catch (error: any) {
      console.error(`Detailed error: Failed to refresh posts for topic "${topic.title}" (ID: ${topic.id}):`, error);
      toast({
        title: "Post Refresh Failed",
        description: `Could not update the list of posts for this topic. This might be due to a network connection problem or a temporary server issue. Please try refreshing the page or check your connection. Error: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">
          Created by {topic.creatorName || 'Anonymous'} on {topic.createdAt ? new Date(topic.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
        </p>
        {topic.description && <p className="mt-3 text-md text-foreground/80">{topic.description}</p>}
      </div>

      <TopicAnalysis analysis={topic.aiAnalysis} isLoading={isLoadingTopic} />
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Debate Area</h2>
          {isLoadingPosts ? (
             Array.from({ length: 3 }).map((_, index) => (
                <Card className="mb-4 bg-card/80 shadow-md" key={index}>
                  <CardHeader className="flex flex-row items-center space-x-3 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </CardContent>
                </Card>
              ))
          ) : posts.length > 0 ? (
            posts.map(post => <DebatePostCard key={post.id} post={post} />)
          ) : (
            <Alert className="border-primary/30 bg-primary/5">
              <Terminal className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary/90">No Posts Yet!</AlertTitle>
              <AlertDescription className="text-foreground/80">
                This debate is just getting started. Be the first to share your thoughts and set the tone!
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="md:col-span-1 space-y-6">
           <PositionTally posts={posts} isLoading={isLoadingPosts} />
           <PostForm topic={topic} onPostCreated={refreshPosts} />
        </div>
      </div>
    </div>
  );
}

