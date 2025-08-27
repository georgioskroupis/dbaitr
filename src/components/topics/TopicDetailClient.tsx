
"use client";

import type { Topic, Statement as StatementType } from '@/types';
import { TopicAnalysis } from './TopicAnalysis';
import { SentimentDensity } from '@/components/analytics/SentimentDensity';
import { doc, getDoc, collection, getDocs, orderBy, query, updateDoc, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PostForm } from './PostForm';
import { DebatePostCard } from './DebatePostCard';
import { useEffect, useState, useCallback } from 'react';
// Avoid importing server actions in a client component
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import { format, isValid, parseISO } from 'date-fns'; 
import { logger } from '@/lib/logger';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { collectionGroup } from 'firebase/firestore';


interface TopicDetailClientProps {
  initialTopic: Topic;
  initialStatements: StatementType[]; 
}

export function TopicDetailClient({ initialTopic, initialStatements }: TopicDetailClientProps) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [statements, setStatements] = useState<StatementType[]>(initialStatements);
  const [isLoadingTopicDetails, setIsLoadingTopicDetails] = useState<boolean>(!initialTopic.description);
  const [isLoadingStatements, setIsLoadingStatements] = useState<boolean>(false);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [sentimentBins, setSentimentBins] = useState<number[] | null>(null);
  const [sentimentMean, setSentimentMean] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  
  const [clientTopicCreatedAtDate, setClientTopicCreatedAtDate] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalStatements: number;
    totalQuestions: number;
    avgQuestionsPerStatement: number;
    percentQuestionsAnswered: number;
    userQuestions: number;
    userHasStatement: boolean;
  }>({ totalStatements: 0, totalQuestions: 0, avgQuestionsPerStatement: 0, percentQuestionsAnswered: 0, userQuestions: 0, userHasStatement: false });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  useEffect(() => {
    if (initialTopic?.createdAt) {
      try {
        const date = parseISO(initialTopic.createdAt);
        if (isValid(date)) {
          setClientTopicCreatedAtDate(format(date, 'MMMM d, yyyy'));
        } else {
          setClientTopicCreatedAtDate('N/A');
        }
      } catch (e) {
        setClientTopicCreatedAtDate('N/A');
        logger.error("Error parsing initialTopic.createdAt:", e);
      }
    } else {
      setClientTopicCreatedAtDate('N/A');
    }
  }, [initialTopic?.createdAt]);


  useEffect(() => {
    async function fetchCreator() {
      try {
        if (topic.createdBy) {
          const ref = doc(db, 'users', topic.createdBy);
          const snap = await getDoc(ref);
          if (snap.exists()) setCreatorProfile(snap.data() as any);
        }
      } catch {}
    }
    if (topic?.createdBy) fetchCreator();
  }, [topic?.createdBy]);

  useEffect(() => {
    async function fetchAiSummary() {
      if (topic && (!topic.description || topic.description.trim() === '')) {
        setIsLoadingTopicDetails(true);
        try {
          const analysisResult = await generateTopicAnalysis({ topic: topic.title });
          if (analysisResult.analysis) {
            try {
              await updateDoc(doc(db, 'topics', topic.id), { description: analysisResult.analysis });
            } catch {}
            setTopic(prev => ({ ...prev, description: analysisResult.analysis }));
          } else {
            logger.warn("AI topic summary result was empty for topic:", topic.title);
          }
        } catch (error: any) {
          logger.error(`Detailed error: Failed to generate or fetch AI topic summary for topic "${topic.title}" (ID: ${topic.id}):`, error);
          toast({
            title: "AI Summary Unavailable",
            description: `Could not load the AI-generated summary for this topic. This may be a temporary issue. Error: ${error.message || 'Unknown AI error.'}`,
            variant: "default",
            duration: 7000,
          });
        } finally {
          setIsLoadingTopicDetails(false);
        }
      } else if (topic && topic.description) {
         setIsLoadingTopicDetails(false);
      }
    }
    if (topic?.id && topic?.title) { 
        fetchAiSummary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, topic?.title, toast]); 

  useEffect(() => {
    // Compute debate-level stats
    async function computeStats() {
      try {
        if (!topic?.id) return;
        setLoadingStats(true);
        // Statements count
        const stSnap = await getDocs(collection(db, 'topics', topic.id, 'statements'));
        const totalStatements = stSnap.size;

        // Questions under this topic via collection group
        const qSnap = await getDocs(query(collectionGroup(db, 'threads'), where('topicId', '==', topic.id), where('type', '==', 'question')));
        const totalQuestions = qSnap.size;
        const questionIds = new Set(qSnap.docs.map(d => d.id));

        // Responses by authors to those questions
        const rSnap = await getDocs(query(collectionGroup(db, 'threads'), where('topicId', '==', topic.id), where('type', '==', 'response')));
        const answeredQuestionIds = new Set<string>();
        rSnap.docs.forEach(d => {
          const data: any = d.data() || {};
          const parentId = data.parentId;
          const byAuthor = data.createdBy && data.statementAuthorId && data.createdBy === data.statementAuthorId;
          if (parentId && byAuthor && questionIds.has(parentId)) answeredQuestionIds.add(parentId);
        });
        const percentQuestionsAnswered = totalQuestions > 0 ? (answeredQuestionIds.size / totalQuestions) * 100 : 0;

        // Current user questions count for this topic
        let userQuestions = 0;
        let userHasStatement = false;
        try {
          // @ts-ignore - optional user
          const uid = (await import('firebase/auth')).getAuth().currentUser?.uid;
          if (uid) {
            const uqSnap = await getDocs(query(collectionGroup(db, 'threads'), where('topicId', '==', topic.id), where('type', '==', 'question'), where('createdBy', '==', uid)));
            userQuestions = uqSnap.size;
            const hasPostedSnap = await getDocs(query(collection(db, 'topics', topic.id, 'statements'), where('createdBy', '==', uid), limit(1)));
            userHasStatement = !hasPostedSnap.empty;
          }
        } catch {}

        setStats({
          totalStatements,
          totalQuestions,
          avgQuestionsPerStatement: totalStatements > 0 ? totalQuestions / totalStatements : 0,
          percentQuestionsAnswered,
          userQuestions,
          userHasStatement,
        });
      } catch (e) {
        logger.error('Failed to compute stats:', e);
      } finally {
        setLoadingStats(false);
      }
    }
    computeStats();
  }, [topic?.id, statements.length]);

  useEffect(() => {
    async function loadSentimentAgg() {
      try {
        if (!topic?.id) return;
        // Prefer topic-wide aggregation
        const ref = doc(db, 'topics', topic.id, 'aggregations', 'sentiment');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          if (Array.isArray(d.sentimentDist) && d.sentimentDist.length === 101) setSentimentBins(d.sentimentDist);
          if (typeof d.mean === 'number') setSentimentMean(d.mean);
        }
      } catch (e) {}
    }
    loadSentimentAgg();
  }, [topic?.id]);

  // Helper to derive label from mean score (0..100)
  const sentimentLabel = (score?: number) => {
    if (typeof score !== 'number') return undefined;
    if (score <= 20) return 'Very Negative';
    if (score <= 40) return 'Negative';
    if (score <= 60) return 'Neutral';
    if (score <= 80) return 'Positive';
    return 'Very Positive';
  };

  const refreshData = useCallback(async () => {
    if (!topic?.id) return; 
    setIsLoadingStatements(true);
    setIsLoadingTopicDetails(true); 
    try {
      const toISO = (ts: any) => {
        try {
          if (!ts) return undefined;
          if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
          if (ts.seconds !== undefined && ts.nanoseconds !== undefined) {
            return new Date(ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6)).toISOString();
          }
          if (ts instanceof Date) return ts.toISOString();
        } catch {}
        return ts;
      };
      // Load statements
      const q = query(collection(db, 'topics', topic.id, 'statements'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const updatedStatements = snap.docs.map((d) => {
        const data: any = d.data() || {};
        if (data.createdAt) data.createdAt = toISO(data.createdAt);
        if (data.lastEditedAt) data.lastEditedAt = toISO(data.lastEditedAt);
        if (data.sentiment && data.sentiment.updatedAt) data.sentiment.updatedAt = toISO(data.sentiment.updatedAt);
        return { id: d.id, ...data };
      }) as any[];
      setStatements(updatedStatements as any);
      // Load topic
      const tSnap = await getDoc(doc(db, 'topics', topic.id));
      if (tSnap.exists()) {
        const tData: any = tSnap.data() || {};
        if (tData.createdAt) tData.createdAt = toISO(tData.createdAt);
        if (tData.updatedAt) tData.updatedAt = toISO(tData.updatedAt);
        const updatedTopic = { id: tSnap.id, ...tData } as Topic;
        setTopic(prev => ({ ...updatedTopic, description: updatedTopic.description || prev.description }));
      }
    } catch (error: any) {
      logger.error(`Detailed error: Failed to refresh data for topic "${topic.title}" (ID: ${topic.id}):`, error);
      toast({
        title: "Data Refresh Failed",
        description: `Could not update data for this topic. Error: ${error.message || 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingStatements(false);
      setIsLoadingTopicDetails(false);
    }
  }, [topic?.id, topic?.title, toast]);


  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';

  if (!topic) { 
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-rose-500" />
        <p className="ml-3 text-lg text-white/80">Loading topic data...</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
      {/* Debate Stats */}
      <div className="p-3 sm:p-4 rounded-xl border border-white/10 bg-black/30">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">Statements: {loadingStats ? '—' : stats.totalStatements}</Badge>
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">Questions: {loadingStats ? '—' : stats.totalQuestions}</Badge>
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">Avg Q/Stmt: {loadingStats ? '—' : stats.avgQuestionsPerStatement.toFixed(2)}</Badge>
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">Answered: {loadingStats ? '—' : `${Math.round(stats.percentQuestionsAnswered)}%`}</Badge>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant={stats.userHasStatement ? 'default' : 'secondary'} className={stats.userHasStatement ? 'bg-green-600 text-white' : 'bg-white/10 text-white/80'}>
              {stats.userHasStatement ? 'You posted' : 'No statement yet'}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">Your questions: {loadingStats ? '—' : stats.userQuestions}</Badge>
          </div>
        </div>
      </div>
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white mb-2">{topic.title}</h1>
         {clientTopicCreatedAtDate && (
            <p className="text-xs sm:text-sm text-white/50">
                Created by {creatorNameDisplay} on {clientTopicCreatedAtDate}
            </p>
        )}
        <TopicAnalysis analysis={topic.description} isLoading={isLoadingTopicDetails && !topic.description} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        <div className="md:col-span-2 space-y-4 sm:space-y-6">
          <h2 className="text-xl md:text-2xl font-semibold text-white">Debate Area</h2>
          {isLoadingStatements ? (
             Array.from({ length: 3 }).map((_, index) => (
                <Card className="mb-4 bg-black/20 backdrop-blur-sm p-0 rounded-xl shadow-md border border-white/10" key={index}>
                  <CardHeader className="flex flex-row items-center space-x-3 p-4">
                    <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32 bg-white/10" />
                      <Skeleton className="h-3 w-20 bg-white/10" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <Skeleton className="h-4 w-full bg-white/10" />
                    <Skeleton className="h-4 w-5/6 bg-white/10" />
                  </CardContent>
                </Card>
              ))
          ) : statements.length > 0 ? (
            statements.map(statement => <DebatePostCard key={statement.id} statement={statement} />)
          ) : (
            <Alert className="border-rose-500/30 bg-rose-500/5">
              <Terminal className="h-4 w-4 text-rose-400" />
              <AlertTitle className="text-rose-300 font-semibold">Silence isn’t truth.</AlertTitle>
              <AlertDescription className="text-white/80">Add your voice.</AlertDescription>
            </Alert>
          )}
        </div>
        <div className="md:col-span-1 space-y-4 sm:space-y-6">
          {/* Topic-wide sentiment density above "Your Statement" */}
          {sentimentBins && (
            <div className="p-3 rounded-md border border-white/10 bg-black/30">
              {typeof sentimentMean === 'number' && (
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm text-white">Result</p>
                  <p className="text-sm text-white/70">
                    {sentimentLabel(sentimentMean)}
                    <span className="text-white/40"> · {Math.round(sentimentMean)}%</span>
                  </p>
                </div>
              )}
              <SentimentDensity bins={sentimentBins} mean={sentimentMean} />
            </div>
          )}

          <PostForm topic={topic} onStatementCreated={refreshData} />
        </div>
      </div>
    </div>
  );
}
