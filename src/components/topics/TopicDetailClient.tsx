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
import { Terminal } from "lucide-react";
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton'; // For loading state

interface TopicDetailClientProps {
  initialTopic: Topic;
  initialPosts: PostType[];
}

export function TopicDetailClient({ initialTopic, initialPosts }: TopicDetailClientProps) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [posts, setPosts] = useState<PostType[]>(initialPosts);
  const [isLoadingTopic, setIsLoadingTopic] = useState<boolean>(!initialTopic.aiAnalysis); // Load analysis if not present
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);

  // Fetch AI analysis if not already present or if it's empty
  useEffect(() => {
    async function fetchAnalysis() {
      if (topic && (!topic.aiAnalysis || topic.aiAnalysis.trim() === '')) {
        setIsLoadingTopic(true);
        try {
          const analysisResult = await generateTopicAnalysis({ topic: topic.title });
          if (analysisResult.analysis) {
            await updateTopicWithAnalysis(topic.id, analysisResult.analysis); // Update in Firestore
            setTopic(prev => ({ ...prev, aiAnalysis: analysisResult.analysis }));
          }
        } catch (error) {
          console.error("Error fetching topic analysis:", error);
          // Optionally show a toast or error message
        } finally {
          setIsLoadingTopic(false);
        }
      } else if (topic && topic.aiAnalysis) {
         setIsLoadingTopic(false); // Analysis already loaded
      }
    }
    fetchAnalysis();
  }, [topic?.id, topic?.title, topic?.aiAnalysis]);

  const refreshPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const updatedPosts = await getPostsForTopic(topic.id);
      setPosts(updatedPosts);
    } catch (error) {
      console.error("Error refreshing posts:", error);
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
                <Card className="mb-4" key={index}>
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
                Be the first to share your thoughts on this topic.
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
