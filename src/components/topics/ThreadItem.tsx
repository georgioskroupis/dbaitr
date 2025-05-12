
"use client";

import type { ThreadNode, UserProfile } from '@/types';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { getUserProfile, getUserQuestionCountForStatement } from '@/lib/firestoreActions';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, CornerDownRight, Edit3 } from 'lucide-react';
import { ThreadPostForm } from './ThreadPostForm';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ThreadItemProps {
  node: ThreadNode;
  statementAuthorId: string;
  allNodes: ThreadNode[]; // All nodes for the current statement, to find children
  level: number;
  onThreadUpdate: () => void; // To refresh the list after a new post
}

export function ThreadItem({ node, statementAuthorId, allNodes, level, onThreadUpdate }: ThreadItemProps) {
  const { user, kycVerified, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [showReplyForm, setShowReplyForm] = React.useState(false);
  const [userQuestionCount, setUserQuestionCount] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const children = allNodes.filter(n => n.parentId === node.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const hasResponse = node.type === 'question' && children.some(child => child.type === 'response');

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
        if (user && !authLoading) {
            setIsLoadingQuestionCount(true);
            try {
                const count = await getUserQuestionCountForStatement(user.uid, node.statementId, node.topicId);
                setUserQuestionCount(count);
            } catch (error) {
                console.error("Error fetching user question count in ThreadItem:", error);
            } finally {
                setIsLoadingQuestionCount(false);
            }
        }
    }
    fetchUserQuestionCount();
  }, [user, authLoading, node.statementId, node.topicId]);


  const timeAgo = node.createdAt ? formatDistanceToNow(new Date(node.createdAt), { addSuffix: true }) : '';
  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;

  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-4 w-4" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const canAskQuestion = user && kycVerified && !isLoadingQuestionCount && userQuestionCount < 3;
  const canReply = user && user.uid === statementAuthorId && kycVerified && !hasResponse;

  const handleFormSuccess = () => {
    setShowReplyForm(false);
    onThreadUpdate();
  };

  const cardBg = node.type === 'question' ? 'bg-card/70' : 'bg-secondary/30'; // Differentiate question and response
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
                {node.type === 'question' && canReply && (
                <Button variant="outline" size="sm" onClick={() => setShowReplyForm(!showReplyForm)}>
                    <CornerDownRight className="h-3 w-3 mr-1" /> Reply to Question
                </Button>
                )}
                {node.type === 'response' && canAskQuestion && (
                <Button variant="outline" size="sm" onClick={() => setShowReplyForm(!showReplyForm)}>
                    <MessageSquare className="h-3 w-3 mr-1" /> Ask Follow-up
                </Button>
                )}
          </CardFooter>
        )}
      </Card>

      {showReplyForm && user && (
        <div className="mt-1 pl-2">
          <ThreadPostForm
            topicId={node.topicId}
            statementId={node.statementId}
            statementAuthorId={statementAuthorId}
            parentId={node.id}
            type={node.type === 'question' ? 'response' : 'question'}
            onSuccess={handleFormSuccess}
            placeholderText={node.type === 'question' ? 'Your response to this question...' : 'Ask a follow-up question...'}
            submitButtonText={node.type === 'question' ? 'Post Response' : 'Ask Question'}
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
