import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null; // Changed from displayName
  photoURL?: string | null;
  kycVerified: boolean; // Changed from isVerified
  // idDocumentUrl is removed as per new schema
  createdAt: Timestamp;
  updatedAt?: Timestamp; // Optional: for tracking updates
}

export interface Topic {
  id: string;
  title: string; // must be unique, AI-filtered
  description: string; // AI-generated summary. Initially can be user-provided or empty.
  createdBy: string; // User ID (reference to users/{userId})
  createdAt: Timestamp;
  scoreFor: number;
  scoreAgainst: number;
  scoreNeutral: number;
  slug?: string; // Optional: URL-friendly version of the title
}

export interface Statement { // Renamed from Post
  id: string;
  topicId: string; // Added to know which topic it belongs to when querying statements directly
  content: string;
  createdBy: string; // User ID (reference to users/{userId})
  createdAt: Timestamp;
  position: 'for' | 'against' | 'neutral' | 'pending'; // Determined by AI. 'pending' can be an initial state.
  lastEditedAt?: Timestamp;
  aiConfidence?: number; // Optional confidence score from AI classification
}

export interface Question {
  id:string;
  topicId: string; // To easily query all questions for a topic if needed
  statementId: string; // Parent statement
  content: string;
  askedBy: string; // User ID (reference to users/{userId})
  createdAt: Timestamp;
  answered: boolean;
  answer?: string;
  answeredAt?: Timestamp;
}
