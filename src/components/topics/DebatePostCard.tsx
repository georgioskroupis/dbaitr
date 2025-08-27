
import type { Statement, ThreadNode } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, User, Info, MessageSquare, ShieldAlert, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import * as React from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, where, doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types';
import { ThreadList } from './ThreadList';
// Inline question composer replaces the old ThreadPostForm
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Separator } from '@/components/ui/separator';
import { getAuthorStatusBadge } from '@/lib/react-utils'; 
import { Thermometer } from '@/components/analytics/Thermometer';
import { cn } from '@/lib/utils';

import { ReportButton } from './ReportButton';
import { createThreadNode } from '@/lib/client/threads';

interface DebateStatementCardProps {
  statement: Statement;
}

export function DebatePostCard({ statement }: DebateStatementCardProps) {
  const { user, kycVerified, loading: authLoading, isSuspended: currentUserIsSuspended } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [threads, setThreads] = React.useState<ThreadNode[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [composerText, setComposerText] = React.useState('');
  const [composerFocused, setComposerFocused] = React.useState(false);
  const [isCollapsing, setIsCollapsing] = React.useState(false);
  const [isExpanding, setIsExpanding] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [userQuestionCountForThisStatement, setUserQuestionCountForThisStatement] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const fetchThreads = React.useCallback(async () => {
    if (!statement || !statement.id || !statement.topicId) {
      logger.warn("[DebatePostCard] Attempted to fetch threads with invalid statement data:", statement);
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }
    setIsLoadingThreads(true);
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
      const q = query(collection(db, 'topics', statement.topicId, 'statements', statement.id, 'threads'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const fetchedThreads = snap.docs.map(d => {
        const data: any = d.data() || {};
        if (data.createdAt) data.createdAt = toISO(data.createdAt);
        if (data.updatedAt) data.updatedAt = toISO(data.updatedAt);
        return { id: d.id, ...data } as ThreadNode;
      });
      setThreads(fetchedThreads);
    } catch (error) {
      logger.error("Error fetching threads for statement:", statement.id, error);
      toast({ title: "Error", description: "Could not load discussion threads.", variant: "destructive" });
      setThreads([]); 
    } finally {
      setIsLoadingThreads(false);
    }
  }, [statement, toast]); 

  React.useEffect(() => {
    if (statement && statement.id && statement.topicId) {
      fetchThreads();
    } else {
      setThreads([]);
      setIsLoadingThreads(false);
    }
  }, [statement, fetchThreads]);


  React.useEffect(() => {
    async function fetchAuthor() {
      try {
        if (statement.createdBy) {
          const snap = await getDoc(doc(db, 'users', statement.createdBy));
          if (snap.exists()) setAuthorProfile(snap.data() as any);
        }
      } catch {}
    }
    fetchAuthor();
  }, [statement.createdBy]);

   React.useEffect(() => {
    async function fetchUserQuestionCount() {
        if (user && !authLoading && statement && statement.id && statement.topicId) { 
            setIsLoadingQuestionCount(true);
            try {
                const q = query(
                  collection(db, 'topics', statement.topicId, 'statements', statement.id, 'threads'),
                  where('createdBy', '==', user.uid),
                  where('type', '==', 'question')
                );
                const snap = await getDocs(q);
                setUserQuestionCountForThisStatement(snap.size);
            } catch (error) {
                logger.error("Error fetching user question count in DebatePostCard:", error);
            } finally {
                setIsLoadingQuestionCount(false);
            }
        } else if (!authLoading && !user) { 
            setIsLoadingQuestionCount(false);
            setUserQuestionCountForThisStatement(0); 
        }
    }
    fetchUserQuestionCount();
  }, [user, authLoading, statement]); 


  const timeAgo = statement.createdAt ? formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true }) : '';
  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-5 w-5" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };
  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;
  const authorStatusBadge = getAuthorStatusBadge(authorProfile);

  let positionIcon;
  let positionBadgeColor;
  // Using text-white as default foreground for badges on dark theme
  switch (statement.position) {
    case 'for':
      positionIcon = <ThumbsUp className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-green-500 hover:bg-green-600 text-white';
      break;
    case 'against':
      positionIcon = <ThumbsDown className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-rose-500 hover:bg-rose-600 text-white';
      break;
    case 'neutral':
      positionIcon = <Info className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-gray-500 hover:bg-gray-600 text-white';
      break;
    default: // pending
      positionIcon = <AlertCircle className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-yellow-500 hover:bg-yellow-600 text-black';
  }

  // Thermometer label color based on sentiment score
  const sScore = (statement as any)?.sentiment?.score as number | undefined;
  const thermTextClass = (() => {
    if (typeof sScore !== 'number') return 'text-white/60';
    if (sScore <= 40) return 'text-rose-300';
    if (sScore <= 60) return 'text-slate-300';
    return 'text-emerald-300';
  })();

  // Claim type badge + source link if fact
  const claimBadge = (
    <Badge className="text-[10px] sm:text-xs bg-white/10 border border-white/20 text-white/80 capitalize">
      {(statement as any)?.claimType || 'opinion'}
    </Badge>
  );

  const canAskRootQuestion =
    user &&
    kycVerified &&
    !isLoadingQuestionCount &&
    userQuestionCountForThisStatement < 3 &&
    !currentUserIsSuspended &&
    user.uid !== statement.createdBy; // authors cannot ask questions on their own statements

  const handleRootQuestionSuccess = () => {
    fetchThreads(); 
    if (user && statement && statement.id && statement.topicId) {
      setIsLoadingQuestionCount(true);
      (async () => {
        const q = query(
          collection(db, 'topics', statement.topicId, 'statements', statement.id, 'threads'),
          where('createdBy', '==', user.uid),
          where('type', '==', 'question')
        );
        const snap = await getDocs(q);
        setUserQuestionCountForThisStatement(snap.size);
      })()
        .finally(() => setIsLoadingQuestionCount(false));
    }
  };

  // Auto-resize textarea
  const autoResize = () => {
    const el = composerRef.current;
    if (!el) return;
    // When expanded (focused or has text), grow to content
    if (composerFocused || composerText) {
      el.style.height = 'auto';
      el.style.height = Math.min(180, el.scrollHeight) + 'px';
    } else {
      // Collapsed: rely on CSS max-height for smoothness; avoid inline height changes
      el.style.height = 'auto';
    }
  };

  React.useEffect(() => { autoResize(); }, [composerText, composerFocused]);

  const submitQuestion = async () => {
    if (!user) return;
    const text = composerText.trim();
    if (text.length < 5) {
      toast({ title: 'Question too short', description: 'Please write a bit more (min 5 characters).', variant: 'destructive' });
      return;
    }
    try {
      await createThreadNode({
        topicId: statement.topicId,
        statementId: statement.id,
        statementAuthorId: statement.createdBy,
        parentId: null,
        content: text,
        createdBy: user.uid,
        type: 'question',
      });
      setComposerText('');
      setComposerFocused(false);
      handleRootQuestionSuccess();
      toast({ title: 'Question posted' });
    } catch (e: any) {
      logger.error('Inline question submit failed:', e);
      toast({ title: 'Failed to post question', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      // Allow Ctrl/Cmd+Enter as well
      e.preventDefault();
      submitQuestion();
    }
  };


  return (
    <Card className="mb-4 sm:mb-6 bg-black/40 backdrop-blur-md p-0 rounded-xl shadow-md border border-white/10">
      <CardHeader className="flex flex-row items-start space-x-3 p-3 sm:p-4">
        <Avatar className="h-10 w-10 border-2 border-rose-500/50">
           <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
           <AvatarFallback className="bg-rose-500/20 text-rose-400 font-semibold">
             {getInitials(displayName)}
           </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm sm:text-base font-semibold text-white">{displayName}</p>
            {authorStatusBadge && (
              <Badge variant={authorStatusBadge.variant as any} className={`text-xs ${authorStatusBadge.variant === 'destructive' ? 'bg-red-700/80 border-red-500/50 text-red-200' : 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'}`}>
                {React.cloneElement(authorStatusBadge.icon, { className: "h-3 w-3 mr-1"})}
                {authorStatusBadge.label}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-white/50">{timeAgo}</p>
        </div>
        {statement.position && (
          <Badge
            className={`ml-auto text-[10px] sm:text-xs ${positionBadgeColor} font-medium uppercase tracking-wider py-1 px-2`}
            style={{ letterSpacing: '0.5px' }}
          >
            {positionIcon}
            {statement.position}
          </Badge>
        )}
     </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="flex items-center gap-2 mb-1">
          {claimBadge}
          {(statement as any)?.claimType === 'fact' && (statement as any)?.sourceUrl && (
            <a href={(statement as any).sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-rose-300 underline hover:text-white/90">Source</a>
          )}
        </div>
        <p className="text-sm sm:text-base text-white/80 leading-relaxed whitespace-pre-wrap">{statement.content}</p>
        { (statement as any)?.sentiment?.score !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <Thermometer score={(statement as any).sentiment.score} />
            <span className={cn('text-xs sm:text-sm', thermTextClass)} title={`Score: ${(statement as any).sentiment.score}%`}>
              {(statement as any).sentiment.label}
            </span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-3 sm:p-4 pt-2 flex-col items-start">
        {!authLoading && user && (
          <div className="mb-2 w-full flex items-center">
            {isLoadingQuestionCount ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            ) : (
              <p className="text-xs text-white/50">
                Questions asked for this statement: {userQuestionCountForThisStatement}/3
              </p>
            )}
          </div>
        )}
        {!authLoading && user && !isLoadingQuestionCount && userQuestionCountForThisStatement >= 3 && (
          <div className="mb-2 flex items-center text-xs text-white/50">
            <AlertCircle className="h-4 w-4 mr-1 text-yellow-400" /> You've reached your question limit for this statement.
          </div>
        )}
        {!authLoading && user && kycVerified && !currentUserIsSuspended && canAskRootQuestion && (
          <div
            className={cn(
              'w-full mb-3 relative border border-white/10 rounded-lg bg-white/5 transition-all duration-200 ease-in-out overflow-hidden',
              composerFocused || composerText
                ? 'p-2 min-h-[88px]'
                : cn('p-1 min-h-[28px] flex', isCollapsing ? 'items-start' : 'items-center')
            )}
            onTransitionEnd={(e) => {
              if (e.currentTarget !== e.target) return;
              if (!composerFocused && !composerText) setIsCollapsing(false);
              if (composerFocused || composerText) setIsExpanding(false);
            }}
          >
            <textarea
              ref={composerRef}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={onComposerKeyDown}
              onFocus={() => {
                setComposerFocused(true);
                setIsExpanding(true);
                autoResize();
              }}
              onBlur={() => {
                setComposerFocused(false);
                if (!composerText) {
                  setIsCollapsing(true);
                }
                // ensure smooth collapse on next frame
                requestAnimationFrame(() => autoResize());
              }}
              rows={1}
              placeholder="Ask a question..."
              className={cn(
                'w-full resize-none bg-transparent outline-none text-sm text-white placeholder-white/50 leading-6 h-auto overflow-hidden transition-all duration-200 ease-in-out',
                composerFocused || composerText ? 'max-h-[180px]' : 'max-h-6',
                ''
              )}
            />
            {(composerFocused || composerText) && (
              <div className={cn(
                'pointer-events-none absolute left-2 bottom-1 text-[10px] text-white/40 transition-opacity duration-200',
                isExpanding ? 'opacity-0' : 'opacity-100'
              )}
              >
                Press Enter to send · Shift+Enter for newline
              </div>
            )}
          </div>
        )}

        <div className="w-full flex items-center justify-between">
          {threads.length > 0 || isLoadingThreads ? <Separator className="my-2 bg-white/10 flex-1" /> : <span />}
          <ReportButton topicId={statement.topicId} statementId={statement.id} className="ml-2" />
        </div>
        
        <ThreadList 
            threads={threads} 
            statementId={statement.id}
            topicId={statement.topicId}
            statementAuthorId={statement.createdBy} 
            isLoading={isLoadingThreads}
            onThreadUpdate={fetchThreads}
        />
      </CardFooter>
    </Card>
  );
}
