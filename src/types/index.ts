import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isVerified: boolean;
  idDocumentUrl?: string;
  createdAt: Timestamp;
}

export interface Topic {
  id: string;
  title: string;
  description?: string; // Optional brief description by creator
  aiAnalysis?: string; // AI-generated neutral analysis
  createdBy: string; // User ID
  creatorName?: string; // User display name
  createdAt: Timestamp;
  tags?: string[];
}

export interface Post {
  id: string;
  topicId: string;
  userId: string;
  userName?: string; // User display name
  userPhotoURL?: string;
  content: string;
  position?: 'For' | 'Against' | null; // AI classified
  positionConfidence?: number;
  createdAt: Timestamp;
  isMainStatement?: boolean; // True if it's the user's main statement for the topic
  parentId?: string | null; // For Q&A flow, references parent post/question
}
