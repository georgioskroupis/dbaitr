
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
  analysis?: {
    version?: {
      model?: string;
      prompt?: string;
      updatedAt?: string;
    };
    discussionOverview?: unknown;
    categories?: {
      tone?: AnalysisCategory;
      style?: AnalysisCategory;
      outcome?: AnalysisCategory;
      substance?: AnalysisCategory;
      engagement?: AnalysisCategory;
      argumentation?: AnalysisCategory;
    };
  };
  analysis_flat?: {
    tone?: 'heated' | 'calm';
    style?: 'structured' | 'informal';
    outcome?: 'controversial' | 'consensus';
    substance?: 'evidence' | 'opinion';
    engagement?: 'active' | 'dormant';
    argumentation?: 'solid' | 'weak';
    updatedAt?: string;
  };
}

export interface AnalysisCategory {
  value?: string; // enum per-category (lowercase)
  confidence?: number; // 0..1
  trend24h?: number; // delta toward current label
  updatedAt?: string; // ISO
  rationaleShort?: string; // moderator-only
  override?: boolean; // if set, frozen by moderator
  note?: string; // optional override reason
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
  aiAssisted?: boolean;
  aiAssistProb?: number; // 0..1 detection probability
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
  aiAssisted?: boolean;
  aiAssistProb?: number;
}
