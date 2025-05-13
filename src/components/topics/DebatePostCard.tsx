
import type { Statement, ThreadNode } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, User, Info, MessageSquare, ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import * as React from 'react';
import { getUserProfile, getThreadsForStatement, getUserQuestionCountForStatement } from '@/lib/firestoreActions';
import type { UserProfile } from '@/types';
import { ThreadList } from './ThreadList';
import { ThreadPostForm } from './ThreadPostForm';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { getAuthorStatusBadge } from '@/lib/utils'; 

interface DebateStatementCardProps {
  statement: Statement;
}

export function DebatePostCard({ statement }: DebateStatementCardProps) {
  const { user, kycVerified, loading: authLoading, isSuspended: currentUserIsSuspended } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [threads, setThreads] = React.useState<ThreadNode[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [showRootQuestionForm, setShowRootQuestionForm] = React.useState(false);
  const [userQuestionCountForThisStatement, setUserQuestionCountForThisStatement] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const fetchThreads = React.useCallback(async () => {
    if (!statement || !statement.id || !statement.topicId) {
      console.warn("[DebatePostCard] Attempted to fetch threads with invalid statement data:", statement);
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }
    setIsLoadingThreads(true);
    try {
      const fetchedThreads = await getThreadsForStatement(statement.topicId, statement.id);
      setThreads(fetchedThreads);
    } catch (error) {
      console.error("Error fetching threads for statement:", statement.id, error);
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
      if (statement.createdBy) {
        const profile = await getUserProfile(statement.createdBy);
        setAuthorProfile(profile);
      }
    }
    fetchAuthor();
  }, [statement.createdBy]);

   React.useEffect(() => {
    async function fetchUserQuestionCount() {
        if (user && !authLoading && statement && statement.id && statement.topicId) { 
            setIsLoadingQuestionCount(true);
            try {
                const count = await getUserQuestionCountForStatement(user.uid, statement.id, statement.topicId);
                setUserQuestionCountForThisStatement(count);
            } catch (error) {
                console.error("Error fetching user question count in DebatePostCard:", error);
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

  const canAskRootQuestion = user && kycVerified && !isLoadingQuestionCount && userQuestionCountForThisStatement < 3 && !currentUserIsSuspended;

  const handleRootQuestionSuccess = () => {
    setShowRootQuestionForm(false);
    fetchThreads(); 
    if (user && statement && statement.id && statement.topicId) {
      setIsLoadingQuestionCount(true);
      getUserQuestionCountForStatement(user.uid, statement.id, statement.topicId)
        .then(count => setUserQuestionCountForThisStatement(count))
        .finally(() => setIsLoadingQuestionCount(false));
    }
  };


  return (
    <Card className="mb-6 bg-black/40 backdrop-blur-md p-0 rounded-xl shadow-md border border-white/10">
      <CardHeader className="flex flex-row items-start space-x-3 p-4">
        <Avatar className="h-10 w-10 border-2 border-rose-500/50">
           <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
           <AvatarFallback className="bg-rose-500/20 text-rose-400 font-semibold">
             {getInitials(displayName)}
           </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{displayName}</p>
            {authorStatusBadge && (
              <Badge variant={authorStatusBadge.variant as any} className={`text-xs ${authorStatusBadge.variant === 'destructive' ? 'bg-red-700/80 border-red-500/50 text-red-200' : 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'}`}>
                {React.cloneElement(authorStatusBadge.icon, { className: "h-3 w-3 mr-1"})}
                {authorStatusBadge.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-white/50">{timeAgo}</p>
        </div>
        {statement.position && (
          <Badge
            className={`ml-auto text-xs ${positionBadgeColor} font-medium uppercase tracking-wider py-1 px-2`}
            style={{ letterSpacing: '0.5px' }}
          >
            {positionIcon}
            {statement.position}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{statement.content}</p>
        {statement.aiConfidence !== undefined && statement.position !== 'pending' && (
           <p className="text-xs text-white/50 mt-2">AI Confidence: {(statement.aiConfidence * 100).toFixed(0)}%</p>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-2 flex-col items-start">
        {!authLoading && user && kycVerified && !currentUserIsSuspended && canAskRootQuestion && (
          <Button 
            variant="outline"
            size="sm" 
            onClick={() => setShowRootQuestionForm(!showRootQuestionForm)}
            className="mb-3 w-full sm:w-auto px-5 py-2 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-black/20 transition border-rose-500/50 hover:border-rose-400"
            disabled={isLoadingQuestionCount}
          >
            <MessageSquare className="h-4 w-4 mr-2" /> 
            {showRootQuestionForm ? 'Cancel Question' : 'Ask a Question on this Statement'}
          </Button>
        )}
        {showRootQuestionForm && user && statement && statement.id && statement.topicId && ( 
          <div className="w-full mb-2">
            <ThreadPostForm
              topicId={statement.topicId}
              statementId={statement.id}
              statementAuthorId={statement.createdBy} 
              parentId={null} 
              type="question"
              onSuccess={handleRootQuestionSuccess}
            />
          </div>
        )}

        {threads.length > 0 || isLoadingThreads ? <Separator className="my-2 bg-white/10" /> : null}
        
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
