
"use client";

import type { ThreadNode, UserProfile } from '@/types';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, CornerDownRight, Edit3, AlertCircle, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { ThreadPostForm } from './ThreadPostForm';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getAuthorStatusBadge } from '@/lib/react-utils';
import { logger } from '@/lib/logger';

interface ThreadItemProps {
  node: ThreadNode;
  statementAuthorId: string; 
  allNodes: ThreadNode[]; 
  level: number;
  onThreadUpdate: () => void; 
}

export function ThreadItem({ node, statementAuthorId, allNodes, level, onThreadUpdate }: ThreadItemProps) {
  const { user, kycVerified, loading: authLoading, isSuspended: currentUserIsSuspended } = useAuth();
  const { toast } = useToast();
  const [authorProfile, setAuthorProfile] = React.useState<UserProfile | null>(null);
  const [showReplyForm, setShowReplyForm] = React.useState(false);
  const [userQuestionCountOnStatement, setUserQuestionCountOnStatement] = React.useState(0);
  const [isLoadingQuestionCount, setIsLoadingQuestionCount] = React.useState(false);

  const children = allNodes.filter(n => n.parentId === node.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  const hasResponse = node.type === 'question' && children.some(childNode => childNode.type === 'response' && childNode.parentId === node.id);

  React.useEffect(() => {
    async function fetchAuthor() {
      try {
        if (node.createdBy) {
          const snap = await getDoc(doc(db, 'users', node.createdBy));
          if (snap.exists()) setAuthorProfile(snap.data() as any);
        }
      } catch {}
    }
    fetchAuthor();
  }, [node.createdBy]);

  React.useEffect(() => {
    async function fetchUserQuestionCount() {
        if (user && !authLoading) { 
            setIsLoadingQuestionCount(true);
            try {
                const q = query(
                  collection(db, 'topics', node.topicId, 'statements', node.statementId, 'threads'),
                  where('createdBy', '==', user.uid),
                  where('type', '==', 'question')
                );
                const snap = await getDocs(q);
                setUserQuestionCountOnStatement(snap.size);
            } catch (error) {
                logger.error("Error fetching user question count in ThreadItem for statement:", node.statementId, error);
            } finally {
                setIsLoadingQuestionCount(false);
            }
        } else if (!authLoading && !user) {
          setIsLoadingQuestionCount(false);
          setUserQuestionCountOnStatement(0);
        }
    }
    if (node.type === 'response' || node.type === 'question') {
       fetchUserQuestionCount();
    }
  }, [user, authLoading, node.statementId, node.topicId, node.type]);


  const timeAgo = node.createdAt ? formatDistanceToNow(new Date(node.createdAt), { addSuffix: true }) : '';
  const displayName = authorProfile?.fullName || 'User';
  const photoURL = authorProfile?.photoURL || undefined;
  const authorStatusBadge = getAuthorStatusBadge(authorProfile);


  const getInitials = (name?: string | null) => {
    if (!name) return <User className="h-4 w-4" />;
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const canAskFollowUpQuestion = user && !isLoadingQuestionCount && userQuestionCountOnStatement < 3 && !currentUserIsSuspended;
  const canReplyToQuestion = user && user.uid === statementAuthorId && !hasResponse && !currentUserIsSuspended;


  const handleFormSuccess = () => {
    setShowReplyForm(false);
    onThreadUpdate(); 
    if (user && (showReplyFormForTypeRef.current === 'question')) { 
        setIsLoadingQuestionCount(true);
        (async () => {
          const q = query(
            collection(db, 'topics', node.topicId, 'statements', node.statementId, 'threads'),
            where('createdBy', '==', user.uid),
            where('type', '==', 'question')
          );
          const snap = await getDocs(q);
          setUserQuestionCountOnStatement(snap.size);
        })()
            .finally(() => setIsLoadingQuestionCount(false));
    }
  };
  
  const showReplyFormForTypeRef = React.useRef<'question' | 'response' | null>(null);

  const toggleReplyForm = (type: 'question' | 'response') => {
    showReplyFormForTypeRef.current = type;
    setShowReplyForm(prev => !prev);
  }


  const cardBg = node.type === 'question' ? 'bg-black/30' : 'bg-black/20';
  const borderClass = level > 0 ? 'border-l-2 border-rose-500/30 pl-3' : '';

  return (
    <div className={`py-2 ${borderClass}`} style={{ marginLeft: `${level * 10}px` }}>
      <Card className={`shadow-sm ${cardBg} backdrop-blur-sm p-0 rounded-lg border border-white/10`}>
        <CardHeader className="flex flex-row items-start space-x-3 p-2.5 sm:p-3">
          <Avatar className="h-8 w-8 mt-1 border border-rose-500/30">
            <AvatarImage src={photoURL} alt={displayName} data-ai-hint="profile avatar" />
            <AvatarFallback className="text-xs bg-rose-500/10 text-rose-400 font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                   <p className="text-xs sm:text-sm font-semibold text-white">{displayName}</p>
                    {authorStatusBadge && (
                        <Badge variant={authorStatusBadge.variant as any} className={`text-[10px] sm:text-xs py-0 px-1 h-4 leading-tight ${authorStatusBadge.variant === 'destructive' ? 'bg-red-700/80 border-red-500/50 text-red-200' : 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'}`}>
                           {authorStatusBadge.icon && React.cloneElement(authorStatusBadge.icon, {className: "h-2.5 w-2.5 mr-0.5"})}
                           {authorStatusBadge.label}
                        </Badge>
                    )}
                </div>
                <p className="text-[10px] sm:text-xs text-white/50">{timeAgo}</p>
            </div>
             <p className={`text-[10px] sm:text-xs font-medium ${node.type === 'question' ? 'text-rose-400' : 'text-green-400'}`}>
                {node.type === 'question' ? 'Question' : 'Response'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-2.5 sm:p-3 pt-0">
          <p className="text-sm sm:text-base text-white/80 whitespace-pre-wrap">{node.content}</p>
        </CardContent>
        {!authLoading && user && kycVerified && !currentUserIsSuspended && (
            <CardFooter className="p-2.5 sm:p-3 pt-1 flex items-center justify-end gap-2">
                {node.type === 'response' && (
                    isLoadingQuestionCount ? (
                        <Loader2 className="h-3 w-3 animate-spin text-white/60" />
                    ) : (
                        <p className="text-[10px] sm:text-xs text-white/50">Questions asked: {userQuestionCountOnStatement}/3</p>
                    )
                )}
                {node.type === 'question' && canReplyToQuestion && (
                    <Button
                      size="sm"
                      onClick={() => toggleReplyForm('response')}
                      className="px-3 sm:px-4 py-1.5 rounded-md bg-rose-500/70 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-black/10 transition border border-rose-500/40 hover:border-rose-400"
                    >
                        <CornerDownRight className="h-3 w-3 mr-1" /> Reply
                    </Button>
                )}
                {node.type === 'response' && canAskFollowUpQuestion && (
                    <Button
                      size="sm"
                      onClick={() => toggleReplyForm('question')}
                      className="px-3 sm:px-4 py-1.5 rounded-md bg-rose-500/70 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-black/10 transition border border-rose-500/40 hover:border-rose-400"
                    >
                        <MessageSquare className="h-3 w-3 mr-1" /> Ask away
                    </Button>
                )}
                {node.type === 'response' && !isLoadingQuestionCount && userQuestionCountOnStatement >= 3 && (
                    <div className="flex items-center text-[10px] sm:text-xs text-white/50">
                        <AlertCircle className="h-3 w-3 mr-1 text-yellow-400" /> You've reached your question limit for this statement.
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
            statementAuthorId={statementAuthorId} 
            parentId={node.id} 
            type={showReplyFormForTypeRef.current} 
            onSuccess={handleFormSuccess}
            placeholderText={showReplyFormForTypeRef.current === 'response' ? 'Your response to this question...' : 'Every question sharpens the truth. Ask away.'}
            submitButtonText={showReplyFormForTypeRef.current === 'response' ? 'Post Response' : 'Ask away'}
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
