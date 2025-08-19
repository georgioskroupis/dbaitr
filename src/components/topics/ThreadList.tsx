
"use client";

import type { ThreadNode } from '@/types';
import { ThreadItem } from './ThreadItem';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';

interface ThreadListProps {
  threads: ThreadNode[];
  statementId: string;
  topicId: string;
  statementAuthorId: string;
  isLoading: boolean;
  onThreadUpdate: () => void;
}

export function ThreadList({ threads, statementId, topicId, statementAuthorId, isLoading, onThreadUpdate }: ThreadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2].map(i => (
          <div key={i} className="p-3 border rounded-md">
            <div className="flex items-center space-x-2 mb-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  // Build a tree structure for rendering, or handle flat list rendering in ThreadItem with levels
  // For simplicity, we'll pass all nodes and let ThreadItem figure out its children
  // Root nodes are those with parentId === null or undefined (or missing)
  const rootNodes = threads.filter(node => !node.parentId).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Log received threads and identified root nodes for debugging
  logger.debug(`[ThreadList] For statement ${statementId} - Received ${threads.length} total threads. Identified ${rootNodes.length} root nodes. Threads:`, JSON.parse(JSON.stringify(threads)));


  if (threads.length === 0) {
    return <p className="text-sm sm:text-base text-muted-foreground mt-4 text-center py-4">No questions or responses yet for this statement.</p>;
  }
  
  // If threads are present but no root nodes are found (e.g. all have parentId),
  // the map below will render nothing. This is correct behavior if there are no root questions.
  // The message "No questions or responses yet..." only appears if the entire threads array is empty.
  // If the message is shown, it means `DebatePostCard`'s `threads` state is empty.

  return (
    <div className="mt-4 space-y-1">
      {rootNodes.map(node => (
        <ThreadItem
          key={node.id}
          node={node}
          statementAuthorId={statementAuthorId}
          allNodes={threads}
          level={0}
          onThreadUpdate={onThreadUpdate}
        />
      ))}
    </div>
  );
}
