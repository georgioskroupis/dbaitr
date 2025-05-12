
import type { Statement, ThreadNode } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, ThumbsDown, User, Info, MessageSquare } from 'lucide-react';
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

interface DebateStatementCardProps {
  statement: Statement;
}

export function DebatePostCard({ statement }: DebateStatementCardProps) {
  const { user, kycVerified, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [threads, setThreads] = React.useState<ThreadNode[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [showRootQuestionForm, setShowRootQuestionForm] = React.useState(false);
  const [userQuestionCountForThisStatement, setUserQuestionCountForThisStatement] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const fetchThreads = React.useCallback(async () => {
    // Guard against fetching with invalid statement data
    if (!statement || !statement.id || !statement.topicId) {
      console.warn("[DebatePostCard] Attempted to fetch threads with invalid statement data:", statement);
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }
    setIsLoadingThreads(true);
    try {
      const fetchedThreads = await getThreadsForStatement(statement.topicId, statement.id);
      console.log(`[DebatePostCard] Fetched ${fetchedThreads.length} threads for statement ${statement.id}:`, fetchedThreads);
      setThreads(fetchedThreads);
    } catch (error) {
      console.error("Error fetching threads for statement:", statement.id, error);
      toast({ title: "Error", description: "Could not load discussion threads.", variant: "destructive" });
      setThreads([]); // Ensure threads are empty on error
    } finally {
      setIsLoadingThreads(false);
    }
  }, [statement, toast]); // Depend on the whole statement object and toast

  React.useEffect(() => {
    // This effect will run when the component mounts or when `fetchThreads` or `statement` changes.
    // `fetchThreads` changes if `statement` (the object) changes.
    if (statement && statement.id && statement.topicId) {
      fetchThreads();
    } else {
      // If statement data is not valid (e.g. still loading higher up), clear threads and stop loading.
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
        if (user && !authLoading && statement && statement.id && statement.topicId) { // Ensure user and statement details are loaded
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
  }, [user, authLoading, statement]); // Depend on statement object


  const timeAgo = statement.createdAt ? formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true }) : '';
  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-5 w-5" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };
  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;

  let positionIcon;
  let positionBadgeColor;
  switch (statement.position) {
    case 'for':
      positionIcon = <ThumbsUp className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]';
      break;
    case 'against':
      positionIcon = <ThumbsDown className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-[hsl(var(--destructive-foreground))]';
      break;
    case 'neutral':
      positionIcon = <Info className="h-3 w-3 mr-1" />;
      positionBadgeColor = 'bg-muted hover:bg-muted/90 text-muted-foreground border border-border';
      break;
    default:
      positionIcon = null;
      positionBadgeColor = 'bg-yellow-500 hover:bg-yellow-600 text-black';
  }

  const canAskRootQuestion = user && kycVerified && !isLoadingQuestionCount && userQuestionCountForThisStatement < 3;

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
    <Card className="mb-6 bg-card/80 shadow-lg">
      <CardHeader className="flex flex-row items-center space-x-3 p-4">
        <Avatar className="h-10 w-10">
           <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
           <AvatarFallback className="bg-primary/20 text-primary font-semibold">
             {getInitials(displayName)}
           </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {statement.position && statement.position !== 'pending' && (
          <Badge
            className={`ml-auto text-xs ${positionBadgeColor} font-medium uppercase tracking-wider`}
            style={{ letterSpacing: '0.5px' }}
          >
            {positionIcon}
            {statement.position}
          </Badge>
        )}
         {statement.position === 'pending' && (
          <Badge className="ml-auto text-xs bg-yellow-500 text-black font-medium uppercase tracking-wider">
            Pending AI
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{statement.content}</p>
        {statement.aiConfidence !== undefined && statement.position !== 'pending' && (
           <p className="text-xs text-muted-foreground mt-2">AI Confidence: {(statement.aiConfidence * 100).toFixed(0)}%</p>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-2 flex-col items-start">
        {!authLoading && user && kycVerified && canAskRootQuestion && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowRootQuestionForm(!showRootQuestionForm)}
            className="mb-3 w-full sm:w-auto"
            disabled={isLoadingQuestionCount}
          >
            <MessageSquare className="h-4 w-4 mr-2" /> 
            {showRootQuestionForm ? 'Cancel Question' : 'Ask a Question on this Statement'}
          </Button>
        )}
        {showRootQuestionForm && user && statement && statement.id && statement.topicId && ( // Ensure statement details are available
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

        {threads.length > 0 || isLoadingThreads ? <Separator className="my-2" /> : null}
        
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
