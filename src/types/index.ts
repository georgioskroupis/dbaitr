
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Keep for server-side operations if needed

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  photoURL?: string | null;
  kycVerified: boolean;
  createdAt: string; // Changed from Timestamp
  updatedAt?: string; // Changed from Timestamp
  provider?: 'password' | 'google' | 'apple' | 'unknown'; // Added provider
  registeredAt: string; // ISOString timestamp, added for KYC grace period
  // Optional role flags used in admin UI and rules
  isAdmin?: boolean;
  isModerator?: boolean;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  createdBy: string; // User ID (reference to users/{userId})
  createdAt: string; // Changed from Timestamp
  scoreFor: number;
  scoreAgainst: number;
  scoreNeutral: number;
  slug?: string;
}

export interface Statement {
  id: string;
  topicId: string;
  content: string;
  createdBy: string; // User ID (reference to users/{userId})
  createdAt: string; // Changed from Timestamp
  position: 'for' | 'against' | 'neutral' | 'pending';
  claimType: 'opinion' | 'experience' | 'fact';
  sourceUrl?: string; // required when claimType is 'fact'
  lastEditedAt?: string; // Changed from Timestamp
  aiConfidence?: number;
}

export interface Question {
  id:string;
  topicId: string;
  statementId: string;
  content: string;
  askedBy: string; // User ID (reference to users/{userId})
  createdAt: string; // Changed from Timestamp
  answered: boolean;
  answer?: string;
  answeredAt?: string; // Changed from Timestamp
}

export interface ThreadNode {
  id: string;
  parentId: string | null; // ID of the parent ThreadNode, or null if root question for statement
  statementId: string; // ID of the root statement this thread belongs to
  topicId: string;
  content: string;
  createdBy: string; // User ID of the author of this node
  createdAt: string; // ISOString timestamp
  type: 'question' | 'response';
}
