"use client";
import type { Topic } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, Users, CheckCircle, HelpCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import * as React from 'react';
// Avoid server action imports in client component; fetch profile directly via client Firestore
import type { UserProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { getAuthorStatusBadge } from '@/lib/react-utils'; 
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SentimentDensity } from '@/components/analytics/SentimentDensity';
import { bucketLabel } from '@/lib/sentiment';

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const [creatorProfile, setCreatorProfile] = React.useState<UserProfile | null>(null);
  const [userStats, setUserStats] = React.useState<{ hasStatement: boolean; userQ: number; distinctStatements: number } | null>(null);
  const { user } = useAuth();

  React.useEffect(() => {
    async function fetchCreator() {
      try {
        if (topic.createdBy) {
          const ref = doc(db, 'users', topic.createdBy);
          const snap = await getDoc(ref);
          if (snap.exists()) setCreatorProfile(snap.data() as any);
        }
      } catch {}
    }
    fetchCreator();
  }, [topic.createdBy]);

  React.useEffect(() => {
    // User-specific badges for this topic
    let cancelled = false;
    async function run() {
      try {
        const { collection, getDocs, query, where, collectionGroup, limit } = await import('firebase/firestore');
        const uid = user?.uid;
        if (!uid) { setUserStats({ hasStatement: false, userQ: 0, distinctStatements: 0 }); return; }
        const stSnap = await getDocs(query(collection(require('@/lib/firebase').db, 'topics', topic.id, 'statements'), where('createdBy', '==', uid), limit(1)));
        const hasStatement = !stSnap.empty;
        try {
          // Preferred: collection group query (requires composite index)
          const qSnap = await getDocs(query(collectionGroup(require('@/lib/firebase').db, 'threads'), where('topicId', '==', topic.id), where('type', '==', 'question'), where('createdBy', '==', uid)));
          const userQ = qSnap.size;
          const distinct = new Set<string>();
          qSnap.docs.forEach(d => { const data: any = d.data() || {}; if (data.statementId) distinct.add(data.statementId); });
          if (!cancelled) setUserStats({ hasStatement, userQ, distinctStatements: distinct.size });
        } catch {
          // Fallback without composite index: iterate statements and count user's questions per statement
          const { collection, getDocs, query, where } = await import('firebase/firestore');
          const stList = await getDocs(collection(require('@/lib/firebase').db, 'topics', topic.id, 'statements'));
          let userQ = 0;
          const distinct = new Set<string>();
          for (const s of stList.docs) {
            const sid = s.id;
            // Single-field filter by createdBy; filter type in memory to avoid composite index
            const qs = await getDocs(query(collection(require('@/lib/firebase').db, 'topics', topic.id, 'statements', sid, 'threads'), where('createdBy', '==', uid)));
            const arr = qs.docs.map(d => d.data() as any).filter(d => d?.type === 'question');
            if (arr.length > 0) distinct.add(sid);
            userQ += arr.length;
          }
          if (!cancelled) setUserStats({ hasStatement, userQ, distinctStatements: distinct.size });
        }
      } catch {
        if (!cancelled) setUserStats({ hasStatement: false, userQ: 0, distinctStatements: 0 });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [topic.id, user?.uid]);

  const formattedDate = topic.createdAt ? format(new Date(topic.createdAt), 'MM/dd/yyyy') : 'N/A';
  const creatorNameDisplay = creatorProfile?.fullName || 'Anonymous';
  const totalStatements = (topic.scoreFor || 0) + (topic.scoreAgainst || 0) + (topic.scoreNeutral || 0);
  const creatorStatusBadge = getAuthorStatusBadge(creatorProfile);
  const [sentimentBins, setSentimentBins] = React.useState<number[] | null>(null);
  const [sentimentMean, setSentimentMean] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchAgg() {
      try {
        const ref = doc(db, 'topics', topic.id, 'aggregations', 'sentiment');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const d = snap.data() as any;
        if (cancelled) return;
        if (Array.isArray(d.sentimentDist) && d.sentimentDist.length === 101) {
          setSentimentBins(d.sentimentDist as number[]);
        }
        if (typeof d.mean === 'number') setSentimentMean(d.mean as number);
      } catch {}
    }
    fetchAgg();
    return () => { cancelled = true; };
  }, [topic.id]);


  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-2xl hover:border-rose-500/50 bg-black/40 backdrop-blur-md rounded-xl shadow-md border border-white/10">
      <CardHeader className="p-4">
        <CardTitle className="text-lg sm:text-xl font-semibold line-clamp-2 text-white hover:text-rose-400 transition-colors">
          <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
        </CardTitle>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-white/50">
          <span>Created by {creatorNameDisplay}</span>
          {creatorStatusBadge && (
            <Badge variant={creatorStatusBadge.variant as any} className={`text-xs py-0.5 px-1.5 ${creatorStatusBadge.variant === 'destructive' ? 'bg-red-700/80 border-red-500/50 text-red-200' : 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'}`}>
              {creatorStatusBadge.icon && React.cloneElement(creatorStatusBadge.icon, {className: "h-3 w-3 mr-1"})}
              {creatorStatusBadge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      {topic.description && (
        <CardContent className="flex-grow p-4 pt-0">
          <p className="text-sm sm:text-base text-white/80 line-clamp-3">{topic.description}</p>
        </CardContent>
      )}
      <CardFooter className="flex flex-col items-start gap-3 p-4 pt-4 border-t border-white/10">
        {userStats && (
          <div className="flex items-center gap-2 text-xs sm:text-sm w-full">
            <Badge variant={userStats.hasStatement ? 'default' : 'secondary'} className={userStats.hasStatement ? 'bg-green-600 text-white' : 'bg-white/10 text-white/70'}>
              {userStats.hasStatement ? (<><CheckCircle className="h-3.5 w-3.5 mr-1" /> You posted</>) : (<><HelpCircle className="h-3.5 w-3.5 mr-1" /> No statement</>)}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80 bg-white/5">
              Q: {userStats.userQ} on {userStats.distinctStatements} stmt
            </Badge>
          </div>
        )}
        <div className="flex justify-between w-full items-center text-xs sm:text-sm text-white/50">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{totalStatements} statements</span>
          </div>
        </div>
        {sentimentBins && (
          <div className="w-full mt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs sm:text-sm text-white">Result</span>
              {typeof sentimentMean === 'number' && (
                <Badge variant="outline" className="text-[10px] sm:text-xs border-white/20 text-white/80 bg-white/5">
                  {bucketLabel(Math.round(sentimentMean))}
                </Badge>
              )}
            </div>
            <SentimentDensity bins={sentimentBins} mean={sentimentMean} height={48} />
          </div>
        )}
        <Button asChild className="w-full mt-2 px-4 sm:px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition" size="sm">
          <Link href={`/topics/${topic.id}`}>View Debate</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
