
"use client";

import type { Topic, Statement as StatementType } from '@/types';
import { TopicAnalysis } from './TopicAnalysis';
import { DiscussionOverview } from './DiscussionOverview';
import { LikertBar } from '@/components/analytics/LikertBar';
import { doc, getDoc, collection, getDocs, orderBy, query, updateDoc, where, limit, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { PostForm } from './PostForm';
import { DebatePostCard } from './DebatePostCard';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
// Avoid importing server actions in a client component
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, Info } from "lucide-react";
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import { format, isValid, parseISO } from 'date-fns'; 
import { logger } from '@/lib/logger';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { collectionGroup } from 'firebase/firestore';
import { TopicPills } from './TopicPills';
import { TopicPillsAdminPanel } from './TopicPillsAdminPanel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { apiFetch } from '@/lib/http/client';


interface TopicDetailClientProps {
  initialTopic: Topic;
  initialStatements: StatementType[]; 
}

export function TopicDetailClient({ initialTopic, initialStatements }: TopicDetailClientProps) {
  const db = getDb();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [statements, setStatements] = useState<StatementType[]>(initialStatements);
  const [isLoadingTopicDetails, setIsLoadingTopicDetails] = useState<boolean>(!initialTopic.description);
  const [isLoadingStatements, setIsLoadingStatements] = useState<boolean>(false);
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [sentimentBins, setSentimentBins] = useState<number[] | null>(null);
  const [sentimentMean, setSentimentMean] = useState<number | undefined>(undefined);
  const [selectedLikert, setSelectedLikert] = useState<number | null>(null);

  useEffect(() => {
    // Initialize selectedLikert from query param once
    try {
      const v = searchParams.get('likert');
      if (v !== null) {
        const gi = parseInt(v, 10);
        if (!Number.isNaN(gi) && gi >= 0 && gi <= 4) setSelectedLikert(gi);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const { isAdmin } = useIsAdmin();
  
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
  const classifyRequestedRef = useRef<Set<string>>(new Set());

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
    // Realtime topic doc listener for analysis pills and metadata
    if (!initialTopic?.id) return;
    const unsub = onSnapshot(doc(db, 'topics', initialTopic.id), snap => {
      if (!snap.exists()) return;
      const d: any = snap.data() || {};
      const toISO = (ts: any) => {
        try { if (!ts) return undefined; if (typeof ts.toDate === 'function') return ts.toDate().toISOString(); if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toISOString(); if (ts instanceof Date) return ts.toISOString(); } catch {}
        return ts;
      };
      if (d.createdAt) d.createdAt = toISO(d.createdAt);
      if (d.updatedAt) d.updatedAt = toISO(d.updatedAt);
      if (d?.analysis?.version?.updatedAt) d.analysis.version.updatedAt = toISO(d.analysis.version.updatedAt);
      for (const k of ['tone','style','outcome','substance','engagement','argumentation']) {
        const c = d?.analysis?.categories?.[k];
        if (c?.updatedAt) c.updatedAt = toISO(c.updatedAt);
      }
      setTopic(prev => ({ ...(prev || {}), ...d } as any));
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic?.id]);

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
      if (!topic?.id) return;
      setLoadingStats(true);
      try {
        const res = await apiFetch(`/api/topics/${encodeURIComponent(topic.id)}/stats`);
        if (res.ok) {
          const j = await res.json();
          const totalStatements = Number(j.totalStatements || 0);
          const totalQuestions = Number(j.totalQuestions || 0);
          const percentQuestionsAnswered = Number(j.percentQuestionsAnswered || 0);
          // Preserve user-specific fields (may be 0 if not logged in)
          let userQuestions = 0;
          let userHasStatement = false;
          const uid = user?.uid;
          if (uid) {
            try {
              const uqSnap = await getDocs(query(collectionGroup(db, 'threads'), where('topicId', '==', topic.id), where('type', '==', 'question'), where('createdBy', '==', uid)));
              userQuestions = uqSnap.size;
            } catch {}
            try {
              const hasPostedSnap = await getDocs(query(collection(db, 'topics', topic.id, 'statements'), where('createdBy', '==', uid), limit(1)));
              userHasStatement = !hasPostedSnap.empty;
            } catch {}
          }
          setStats({
            totalStatements,
            totalQuestions,
            avgQuestionsPerStatement: totalStatements > 0 ? totalQuestions / totalStatements : 0,
            percentQuestionsAnswered,
            userQuestions,
            userHasStatement,
          });
        } else {
          setStats(s => ({ ...s, totalStatements: 0, totalQuestions: 0, avgQuestionsPerStatement: 0, percentQuestionsAnswered: 0 }));
        }
      } catch {
        setStats(s => ({ ...s, totalStatements: 0, totalQuestions: 0, avgQuestionsPerStatement: 0, percentQuestionsAnswered: 0 }));
      } finally {
        setLoadingStats(false);
      }
    }
    computeStats();
  }, [topic?.id, statements.length, user?.uid]);

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
      // Load statements once (initial refresh)
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

  // Realtime updates for statements so position/sentiment changes reflect quickly
  useEffect(() => {
    if (!topic?.id) return;
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
    const q = query(collection(db, 'topics', topic.id, 'statements'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => {
        const data: any = d.data() || {};
        if (data.createdAt) data.createdAt = toISO(data.createdAt);
        if (data.lastEditedAt) data.lastEditedAt = toISO(data.lastEditedAt);
        if (data.sentiment && data.sentiment.updatedAt) data.sentiment.updatedAt = toISO(data.sentiment.updatedAt);
        return { id: d.id, ...data };
      }) as any[];
      setStatements(list as any);

      // Opportunistic classification for any of the current user's pending statements
      try {
        const uid = user?.uid;
        if (!uid) return;
        for (const s of list as any[]) {
          if (s.createdBy === uid && s.position === 'pending' && !classifyRequestedRef.current.has(s.id)) {
            classifyRequestedRef.current.add(s.id);
            const token = await user.getIdToken();
            apiFetch('/api/statements/classify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ topicId: topic.id, statementId: s.id, text: s.content || '' }),
            }).catch(() => {});
          }
        }
      } catch {}
    });
    return () => unsub();
  }, [topic?.id, user?.uid]);


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
      {/* Moderator controls (collapsible, visible only to moderators/admins) */}
      {(user && (userProfile?.isModerator || userProfile?.isAdmin || isAdmin)) ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="mod-controls" className="border-white/10">
            <AccordionTrigger className="text-sm text-white/80">
              Moderator Controls
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <TopicPillsAdminPanel topicId={topic.id} categories={topic?.analysis?.categories} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
      {/* Topic Pills */}
      <TopicPills analysis={topic?.analysis} />
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
        <div className="mt-4 sm:mt-6">
          <TopicAnalysis analysis={topic.description} isLoading={isLoadingTopicDetails && !topic.description} />
        </div>
        {topic?.analysis?.discussionOverview ? (
          <div className="mt-4 sm:mt-6">
            <DiscussionOverview overview={topic.analysis.discussionOverview as any} />
          </div>
        ) : null}
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
            <div key={`likert-${selectedLikert ?? 'all'}`} className="animate-in fade-in-0 slide-in-from-top-2 duration-300 ease-out">
              {(selectedLikert === null
                ? statements
                : statements.filter(s => {
                    const sc = (s as any)?.sentiment?.score;
                    if (typeof sc !== 'number') return false;
                    const idx = sc <= 20 ? 0 : sc <= 40 ? 1 : sc <= 60 ? 2 : sc <= 80 ? 3 : 4;
                    return idx === selectedLikert;
                  })
              ).map(statement => <DebatePostCard key={statement.id} statement={statement} />)}
            </div>
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
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span>Result</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="Likert legend" className="text-white/70 hover:text-white">
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <div className="space-y-1">
                            <p>0–20 · Very Negative</p>
                            <p>21–40 · Negative</p>
                            <p>41–60 · Neutral</p>
                            <p>61–80 · Positive</p>
                            <p>81–100 · Very Positive</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-white/70" title={`Mean: ${Math.round(sentimentMean)}%`}>
                    {sentimentLabel(sentimentMean)}
                    <span className="text-white/40"> · {Math.round(sentimentMean)}%</span>
                  </p>
                </div>
              )}
              <LikertBar bins={sentimentBins} mean={sentimentMean} onSelect={setSelectedLikert} selectedGroup={selectedLikert} />
              {selectedLikert !== null && (
                <div className="flex justify-between items-center mt-2 text-[11px] text-white/70">
                  <span>Filtering by: {['Very Negative','Negative','Neutral','Positive','Very Positive'][selectedLikert]}</span>
                  <button className="underline hover:text-white" onClick={() => setSelectedLikert(null)}>Clear filter</button>
                </div>
              )}
            </div>
          )}

          <PostForm topic={topic} onStatementCreated={refreshData} />
        </div>
      </div>
    </div>
  );
}
