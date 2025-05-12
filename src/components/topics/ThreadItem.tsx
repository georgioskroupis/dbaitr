
"use client";

import type { ThreadNode, UserProfile } from '@/types';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { getUserProfile, getUserQuestionCountForStatement } from '@/lib/firestoreActions';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, CornerDownRight, Edit3, AlertCircle } from 'lucide-react';
import { ThreadPostForm } from './ThreadPostForm';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ThreadItemProps {
  node: ThreadNode;
  statementAuthorId: string; // UID of the author of the root statement
  allNodes: ThreadNode[]; 
  level: number;
  onThreadUpdate: () => void; 
}

export function ThreadItem({ node, statementAuthorId, allNodes, level, onThreadUpdate }: ThreadItemProps) {
  const { user, kycVerified, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [showReplyForm, setShowReplyForm] = React.useState(false);
  const [userQuestionCountOnStatement, setUserQuestionCountOnStatement] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const children = allNodes.filter(n => n.parentId === node.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // A question has a response if one of its direct children is of type 'response'
  const hasResponse = node.type === 'question' && children.some(childNode => childNode.type === 'response' && childNode.parentId === node.id);

  React.useEffect(() => {
    async function fetchAuthor() {
      if (node.createdBy) {
        const profile = await getUserProfile(node.createdBy);
        setAuthorProfile(profile);
      }
    }
    fetchAuthor();
  }, [node.createdBy]);

  React.useEffect(() => {
    async function fetchUserQuestionCount() {
        if (user && !authLoading) { // Only fetch if user is loaded
            setIsLoadingQuestionCount(true);
            try {
                // This count is for the entire statement's thread, for *this* user
                const count = await getUserQuestionCountForStatement(user.uid, node.statementId, node.topicId);
                setUserQuestionCountOnStatement(count);
            } catch (error) {
                console.error("Error fetching user question count in ThreadItem for statement:", node.statementId, error);
                // Handle error, maybe toast
            } finally {
                setIsLoadingQuestionCount(false);
            }
        } else if (!authLoading && !user) {
          setIsLoadingQuestionCount(false);
          setUserQuestionCountOnStatement(0);
        }
    }
    // Fetch count if user is attempting to ask a question OR if it's a question node to determine reply eligibility
    if (node.type === 'response' || node.type === 'question') {
       fetchUserQuestionCount();
    }
  }, [user, authLoading, node.statementId, node.topicId, node.type]);


  const timeAgo = node.createdAt ? formatDistanceToNow(new Date(node.createdAt), { addSuffix: true }) : '';
  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;

  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-4 w-4" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  // User can ask a follow-up question if logged in, KYC verified, and under question limit for this statement's thread
  const canAskFollowUpQuestion = user && kycVerified && !isLoadingQuestionCount && userQuestionCountOnStatement < 3;
  // Statement author can reply to a question if logged in, KYC verified, and the question doesn't already have a response
  const canReplyToQuestion = user && kycVerified && user.uid === statementAuthorId && !hasResponse;


  const handleFormSuccess = () => {
    setShowReplyForm(false);
    onThreadUpdate(); // Refresh the entire thread list from DebatePostCard
    // Re-fetch user question count if a question was posted
    if (user && (showReplyFormForTypeRef.current === 'question')) { // Check the type for which the form was shown
        setIsLoadingQuestionCount(true);
        getUserQuestionCountForStatement(user.uid, node.statementId, node.topicId)
            .then(count => setUserQuestionCountOnStatement(count))
            .finally(() => setIsLoadingQuestionCount(false));
    }
  };
  
  // Ref to store the type of form that was opened
  const showReplyFormForTypeRef = React.useRef<'question' | 'response' | null>(null);

  const toggleReplyForm = (type: 'question' | 'response') => {
    showReplyFormForTypeRef.current = type;
    setShowReplyForm(prev => !prev);
  }


  const cardBg = node.type === 'question' ? 'bg-card/70' : 'bg-secondary/30';
  const borderClass = level > 0 ? 'border-l-2 border-primary/30 pl-3' : '';

  return (
    <div className={`py-2 ${borderClass}`} style={{ marginLeft: `${level * 10}px` }}>
      <Card className={`shadow-sm ${cardBg}`}>
        <CardHeader className="flex flex-row items-start space-x-3 p-3">
          <Avatar className="h-8 w-8 mt-1">
            <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
            <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
             <p className={`text-xs font-medium ${node.type === 'question' ? 'text-primary' : 'text-green-500'}`}>
                {node.type === 'question' ? 'Question' : 'Response'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{node.content}</p>
        </CardContent>
        {!authLoading && user && kycVerified && (
            <CardFooter className="p-3 pt-1 flex justify-end">
                {node.type === 'question' && canReplyToQuestion && (
                    <Button variant="outline" size="sm" onClick={() => toggleReplyForm('response')}>
                        <CornerDownRight className="h-3 w-3 mr-1" /> Reply to Question
                    </Button>
                )}
                {node.type === 'response' && canAskFollowUpQuestion && (
                    <Button variant="outline" size="sm" onClick={() => toggleReplyForm('question')}>
                        <MessageSquare className="h-3 w-3 mr-1" /> Ask Follow-up
                    </Button>
                )}
                 {node.type === 'response' && !isLoadingQuestionCount && userQuestionCountOnStatement >= 3 && (
                    <div className="flex items-center text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" /> You've reached your question limit for this statement.
                    </div>
                )}
          </CardFooter>
        )}
      </Card>

      {showReplyForm && user && showReplyFormForTypeRef.current && (
        <div className="mt-1 pl-2">
          <ThreadPostForm
            topicId={node.topicId}
            statementId={node.statementId}
            statementAuthorId={statementAuthorId} // Needed for permission checks if type='response'
            parentId={node.id} // The current node is the parent for the new post
            type={showReplyFormForTypeRef.current} // Type of node being created
            onSuccess={handleFormSuccess}
            placeholderText={showReplyFormForTypeRef.current === 'response' ? 'Your response to this question...' : 'Ask a follow-up question...'}
            submitButtonText={showReplyFormForTypeRef.current === 'response' ? 'Post Response' : 'Ask Question'}
          />
        </div>
      )}

      {children.length > 0 && (
        <div className={`mt-1 ${children.length > 0 && level === 0 ? 'ml-2' : ''}`}>
          {children.map(childNode => (
            <ThreadItem
              key={childNode.id}
              node={childNode}
              statementAuthorId={statementAuthorId}
              allNodes={allNodes}
              level={level + 1}
              onThreadUpdate={onThreadUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
