
"use server";

import { auth, db } from '@/lib/firebase';
import type { Topic, Statement, UserProfile, Question, ThreadNode } from '@/types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, updateDoc, Timestamp, limit, orderBy, runTransaction, FieldValue, increment } from 'firebase/firestore'; 
import { revalidatePath } from 'next/cache';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';
import { logger } from '@/lib/logger';

// Helper to convert Firestore data with Timestamps to data with ISO strings
const convertTimestampsToISO = (timestampFields: string[], data: Record<string, any>): Record<string, any> => {
  const convertedData = { ...data };
  timestampFields.forEach(field => {
    if (data[field] && data[field] instanceof Timestamp) {
      convertedData[field] = (data[field] as Timestamp).toDate().toISOString();
    } else if (data[field] && typeof data[field] === 'object' && 'seconds' in data[field] && 'nanoseconds' in data[field]) {
      // Handle cases where Timestamp might be serialized from server components or other contexts
      convertedData[field] = new Timestamp(data[field].seconds, data[field].nanoseconds).toDate().toISOString();
    }
  });
  return convertedData;
};


export async function createUserProfile(
  userId: string, 
  email: string | null, 
  fullNameFromAuth: string | null, // This is displayName from Firebase Auth User
  providerIdFromAuth?: string // e.g., 'password', 'google.com'
): Promise<UserProfile | null> {
  const userProfileRef = doc(db, "users", userId);

  try {
    const docSnap = await getDoc(userProfileRef);

    let provider: UserProfile['provider'] = 'unknown';
    if (providerIdFromAuth) {
        if (providerIdFromAuth === 'password') {
            provider = 'password';
        } else if (providerIdFromAuth.includes('google.com')) { // google.com
            provider = 'google';
        } else if (providerIdFromAuth.includes('apple.com')) { // apple.com
            provider = 'apple';
        }
    }
    
    const fullNameToSet = fullNameFromAuth || email?.split('@')[0] || 'Anonymous User';

    if (!docSnap.exists()) {
      const userProfileData: Omit<UserProfile, 'createdAt' | 'updatedAt' | 'id' | 'registeredAt'> & { createdAt: FieldValue, registeredAt: FieldValue, updatedAt?: FieldValue } = {
        uid: userId,
        email: email || '', 
        fullName: fullNameToSet,
        kycVerified: false,
        createdAt: serverTimestamp(), 
        registeredAt: serverTimestamp(), // Add registeredAt for new users
        provider: provider,
      };
      await setDoc(userProfileRef, userProfileData);
      logger.debug(`[firestoreActions] User profile CREATED for UID: ${userId} with provider: ${provider}`);
      // Return a representation matching UserProfile type, actual timestamp will be on server
      return {
        ...userProfileData,
        createdAt: new Date().toISOString(), // Approximate for immediate use
        registeredAt: new Date().toISOString(), // Approximate for immediate use
      } as UserProfile;
    } else {
      // Profile exists, optionally update if provider changed or if there's new info
      logger.debug(`[firestoreActions] User profile already exists for UID: ${userId}. Ensuring provider and registeredAt are up-to-date.`);
      const existingData = docSnap.data() as UserProfile;
      type ProfileDocUpdates = Omit<Partial<UserProfile>, 'registeredAt' | 'updatedAt'> & {
        updatedAt?: FieldValue;
        registeredAt?: FieldValue;
      };
      const docUpdates: ProfileDocUpdates = {};
      if (existingData.provider !== provider && provider !== 'unknown') {
        docUpdates.provider = provider;
      }
      if (!existingData.fullName && fullNameToSet !== 'Anonymous User') {
        docUpdates.fullName = fullNameToSet;
      }
      // If registeredAt is missing (for older users), set it on the document with a server timestamp.
      const willSetRegisteredAt = !existingData.registeredAt;
      if (willSetRegisteredAt) {
        docUpdates.registeredAt = serverTimestamp();
      }

      if (Object.keys(docUpdates).length > 0) {
        docUpdates.updatedAt = serverTimestamp();
        await setDoc(userProfileRef, docUpdates, { merge: true });
         logger.debug(`[firestoreActions] User profile UPDATED for UID: ${userId} with changes:`, docUpdates);
         return {
          ...existingData,
          ...docUpdates,
          createdAt: existingData.createdAt, 
          updatedAt: new Date().toISOString(), 
          registeredAt: willSetRegisteredAt ? new Date().toISOString() : existingData.registeredAt,
        } as UserProfile;
      }
      return convertTimestampsToISO(['createdAt', 'updatedAt', 'registeredAt'], existingData) as UserProfile;
    }
  } catch (error) {
    logger.error(`[firestoreActions] Error in createUserProfile for UID ${userId}:`, error);
    throw new Error(`Failed to create or check user profile: ${(error as Error).message}`);
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userProfileRef = doc(db, "users", userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return convertTimestampsToISO(['createdAt', 'updatedAt', 'registeredAt'], data) as UserProfile;
  }
  return null;
}

export async function updateUserVerificationStatus(userId: string, idDocumentUrl: string): Promise<void> {
  const userProfileRef = doc(db, "users", userId);
  await updateDoc(userProfileRef, {
    kycVerified: true,
    idDocumentUrl: idDocumentUrl, 
    updatedAt: serverTimestamp(),
  });
  revalidatePath('/(app)/verify-identity');
  revalidatePath('/(app)/dashboard');
  revalidatePath('/');
}


export async function createTopic(title: string, initialDescription: string | undefined, userId: string): Promise<Topic> {
  // Enforce weekly topic creation quotas based on subscription tier
  const userProfile = await getUserProfile(userId);
  const isPlus = (userProfile as any)?.subscription === 'plus';
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const topicsCollection = collection(db, "topics");
  const qCount = query(topicsCollection, where('createdBy', '==', userId), where('createdAt', '>=', Timestamp.fromDate(weekAgo)));
  const countSnap = await getDocs(qCount);
  const limitPerWeek = isPlus ? 5 : 1;
  if (countSnap.size >= limitPerWeek) {
    throw new Error(isPlus ? 'Topic limit reached for this week (dbaitr+ limit).' : 'Topic limit reached for this week. Upgrade to dbaitr+ for higher limits.');
  }
  const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

  const newTopicServerData = { 
    title,
    description: initialDescription || '',
    createdBy: userId,
    createdAt: serverTimestamp(), 
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
    slug: slug,
  };
  const newTopicRef = await addDoc(topicsCollection, newTopicServerData);

  revalidatePath('/(app)/dashboard');
  revalidatePath('/(app)/topics/new');
  revalidatePath('/');

  return {
    id: newTopicRef.id,
    title,
    description: initialDescription || '',
    createdBy: userId,
    createdAt: new Date().toISOString(), 
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
    slug: slug,
  } as Topic;
}

export async function createStatement(topicId: string, userId: string, content: string, userName?: string, userPhotoURL?: string): Promise<Statement> {
  // Enforce weekly statement quotas based on subscription tier
  const profile = await getUserProfile(userId);
  const isPlus = (profile as any)?.subscription === 'plus';
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const statementsCollection = collection(db, "topics", topicId, "statements");
  const qCount = query(statementsCollection, where('createdBy', '==', userId), where('createdAt', '>=', Timestamp.fromDate(weekAgo)));
  const countSnap = await getDocs(qCount);
  const limitPerWeek = isPlus ? 20 : 3;
  if (countSnap.size >= limitPerWeek) {
    throw new Error(isPlus ? 'Statement limit reached for this week (dbaitr+ limit).' : 'Statement limit reached for this week. Upgrade to dbaitr+ for higher limits.');
  }
  // Enforce single statement per user per topic
  const dupQ = query(statementsCollection, where('createdBy', '==', userId), limit(1));
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    throw new Error('You have already posted a statement for this topic.');
  }
  logger.debug("[createStatement] Called with:", { topicId, userId, content });

  const topicRef = doc(db, "topics", topicId);
  
  const topicSnap = await getDoc(topicRef);
  if (!topicSnap.exists()) {
    throw new Error("Topic not found, cannot classify statement.");
  }
  const topicDataForClassification = topicSnap.data();
  if (!topicDataForClassification || !topicDataForClassification.title) {
    throw new Error("Topic data is invalid, cannot retrieve title for classification.");
  }
  logger.debug("[createStatement] Calling classifyPostPosition with:", {
      topicTitle: topicDataForClassification.title,
      post: content,
    });

  let classificationResult;
  try {
    classificationResult = await classifyPostPosition({ topic: topicDataForClassification.title, post: content });
    logger.debug("[createStatement] Classification result:", classificationResult);
  } catch (err) {
    logger.error("[createStatement] AI classification failed:", err);
    throw new Error("AI classification failed. Cannot continue creating statement.");
  }
  
  const position = classificationResult.position;
  const aiConfidence = classificationResult.confidence;

  if (!['for', 'against', 'neutral'].includes(position)) {
    logger.error("[createStatement] Invalid position returned by AI:", position);
    throw new Error("Invalid classification result. Statement creation aborted.");
  }

  // statementsCollection already defined for checks above
  let newStatementRefId: string | null = null;

  await runTransaction(db, async (transaction) => {
    const currentTopicDoc = await transaction.get(topicRef);
    if (!currentTopicDoc.exists()) {
      throw new Error("Topic does not exist inside transaction!");
    }

    const topicScoreUpdateData: { [key: string]: ReturnType<typeof increment> } = {};
    if (position === 'for') {
      topicScoreUpdateData.scoreFor = increment(1);
    } else if (position === 'against') {
      topicScoreUpdateData.scoreAgainst = increment(1);
    } else if (position === 'neutral') {
      topicScoreUpdateData.scoreNeutral = increment(1);
    } else {
      logger.warn(`createStatement: Unhandled position '${position}' for score update. Scores will not be incremented for this statement.`);
    }
    
    if (Object.keys(topicScoreUpdateData).length > 0) {
        transaction.update(topicRef, topicScoreUpdateData);
    }

    const statementServerData = {
      topicId,
      createdBy: userId, 
      content,
      position,
      aiConfidence,
      createdAt: serverTimestamp(),
      lastEditedAt: serverTimestamp(),
    };
    
    const tempStatementRef = doc(statementsCollection); 
    newStatementRefId = tempStatementRef.id;
    transaction.set(tempStatementRef, statementServerData); 
  });

  revalidatePath(`/(app)/topics/${topicId}`);
  revalidatePath('/(app)/dashboard');

  if (!newStatementRefId) {
    throw new Error("Failed to create statement reference within transaction.");
  }
  logger.debug("[createStatement] Statement successfully created with ID:", newStatementRefId);

  const result: Statement = {
    id: newStatementRefId,
    topicId,
    content,
    createdBy: userId,
    position,
    aiConfidence,
    createdAt: new Date().toISOString(), 
    lastEditedAt: new Date().toISOString(), 
  } as Statement;
  // Fire-and-forget sentiment enrichment (non-blocking) for initial statements only
  try {
    void fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sentiment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'statement', topicId, statementId: newStatementRefId, text: content }) });
  } catch {}
  return result;
}

export async function getTopics(): Promise<Topic[]> {
  const topicsCollection = collection(db, "topics");
  const q = query(topicsCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...convertTimestampsToISO(['createdAt'], data),
    } as Topic;
  });
}

export async function getTopicById(topicId: string): Promise<Topic | null> {
  const topicRef = doc(db, "topics", topicId);
  const docSnap = await getDoc(topicRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...convertTimestampsToISO(['createdAt'], data),
    } as Topic;
  }
  return null;
}

export async function getTopicByTitle(title: string): Promise<Topic | null> {
  const topicsCollection = collection(db, "topics");
  const q = query(topicsCollection, where("title", "==", title), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...convertTimestampsToISO(['createdAt'], data),
    } as Topic;
  }
  return null;
}

export async function getStatementsForTopic(topicId: string): Promise<Statement[]> {
  const statementsCollection = collection(db, "topics", topicId, "statements");
  const q = query(statementsCollection, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => {
    const data = docSnapshot.data();
    // Safely convert nested sentiment.updatedAt if present (Firestore Timestamp -> ISO)
    if (data && typeof data === 'object' && data.sentiment && data.sentiment.updatedAt) {
      const u = (data.sentiment as any).updatedAt as any;
      try {
        if (u instanceof Timestamp) {
          (data.sentiment as any).updatedAt = (u as Timestamp).toDate().toISOString();
        } else if (u && typeof u === 'object' && 'seconds' in u && 'nanoseconds' in u) {
          (data.sentiment as any).updatedAt = new Timestamp(u.seconds, u.nanoseconds).toDate().toISOString();
        } else if (u instanceof Date) {
          (data.sentiment as any).updatedAt = u.toISOString();
        }
      } catch {}
    }
    return {
      id: docSnapshot.id,
      ...convertTimestampsToISO(['createdAt', 'lastEditedAt'], data),
    } as Statement;
  });
}

export async function checkIfUserHasPostedStatement(userId: string, topicId: string): Promise<boolean> {
  const statementsCollection = collection(db, "topics", topicId, "statements");
  const q = query(
    statementsCollection,
    where("createdBy", "==", userId),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

export async function getAllTopicTitles(): Promise<string[]> {
  const topicsCollection = collection(db, "topics");
  const q = query(topicsCollection, orderBy("createdAt", "desc"), limit(500)); 
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => (doc.data() as Topic).title);
}

export async function updateTopicDescriptionWithAISummary(topicId: string, summary: string): Promise<void> {
  const topicRef = doc(db, "topics", topicId);
  await updateDoc(topicRef, {
    description: summary,
    updatedAt: serverTimestamp(), 
  });
  revalidatePath(`/(app)/topics/${topicId}`);
}


export async function updateStatementPosition(
  topicId: string,
  statementId: string,
  newPosition: 'for' | 'against' | 'neutral',
  oldPosition?: 'for' | 'against' | 'neutral' | 'pending'
): Promise<void> {
  const topicRef = doc(db, "topics", topicId);
  const statementRef = doc(db, "topics", topicId, "statements", statementId);

  await runTransaction(db, async (transaction) => {
    const topicDoc = await transaction.get(topicRef);
    const statementDoc = await transaction.get(statementRef);

    if (!topicDoc.exists() || !statementDoc.exists()) {
      throw "Topic or Statement does not exist!";
    }

    const statementData = statementDoc.data();

    const actualOldPosition = oldPosition || statementData.position as 'for' | 'against' | 'neutral' | 'pending';

    if (actualOldPosition === newPosition && statementData.position !== 'pending') { 
      transaction.update(statementRef, { lastEditedAt: serverTimestamp() }); 
      return;
    }

    const scoresUpdate: { [key: string]: ReturnType<typeof increment> } = {};

    if (actualOldPosition !== 'pending') { 
        if (actualOldPosition === 'for') scoresUpdate.scoreFor = increment(-1); 
        else if (actualOldPosition === 'against') scoresUpdate.scoreAgainst = increment(-1);
        else if (actualOldPosition === 'neutral') scoresUpdate.scoreNeutral = increment(-1);
    }

    if (newPosition === 'for') scoresUpdate.scoreFor = increment(1);
    else if (newPosition === 'against') scoresUpdate.scoreAgainst = increment(1);
    else if (newPosition === 'neutral') scoresUpdate.scoreNeutral = increment(1);
    
    transaction.update(topicRef, scoresUpdate);
    transaction.update(statementRef, { position: newPosition, lastEditedAt: serverTimestamp() });
  });

  revalidatePath(`/(app)/topics/${topicId}`);
}


// New ThreadNode System
export async function createThreadNode(data: {
  topicId: string;
  statementId: string;
  statementAuthorId: string; 
  parentId: string | null; 
  content: string;
  createdBy: string; 
  type: 'question' | 'response';
}): Promise<ThreadNode> {
  const { topicId, statementId, statementAuthorId, parentId, content, createdBy, type } = data;
  const threadsCollection = collection(db, "topics", topicId, "statements", statementId, "threads");

  if (type === 'question') {
    const userQuestionCount = await getUserQuestionCountForStatement(createdBy, statementId, topicId);
    if (userQuestionCount >= 3) {
      throw new Error("User has reached the maximum of 3 questions for this statement's thread.");
    }
  }
  
  if (type === 'response') {
    if (createdBy !== statementAuthorId) {
      throw new Error("Only the statement author can respond to questions in this thread.");
    }
    if (!parentId) { 
        throw new Error("Responses must have a parent question node.");
    }
    const q = query(threadsCollection, 
        where("parentId", "==", parentId), 
        where("type", "==", "response"),
        where("createdBy", "==", statementAuthorId) 
    );
    const existingResponsesSnapshot = await getDocs(q);
    if (!existingResponsesSnapshot.empty) {
        throw new Error("This question has already been answered by the statement author.");
    }
  }


  const newThreadNodeServerData = {
    topicId,
    statementId,
    parentId,
    content,
    createdBy,
    type,
    createdAt: serverTimestamp(),
  };

  const newThreadNodeRef = await addDoc(threadsCollection, newThreadNodeServerData);
  revalidatePath(`/(app)/topics/${topicId}`); 

  const result: ThreadNode = {
    id: newThreadNodeRef.id,
    topicId,
    statementId,
    parentId,
    content,
    createdBy,
    type,
    createdAt: new Date().toISOString(), 
  } as ThreadNode;
  return result;
}

export async function getThreadsForStatement(topicId: string, statementId: string): Promise<ThreadNode[]> {
  const threadsCollection = collection(db, "topics", topicId, "statements", statementId, "threads");
  const q = query(threadsCollection, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      ...convertTimestampsToISO(['createdAt'], data),
    } as ThreadNode;
  });
}

export async function getUserQuestionCountForStatement(userId: string, statementId: string, topicId: string): Promise<number> {
    const threadsCollection = collection(db, "topics", topicId, "statements", statementId, "threads");
    const q = query(threadsCollection, 
        where("createdBy", "==", userId), 
        where("type", "==", "question")
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// Deprecated - remove or refactor if this specific old schema is ever needed.
// Old Question/Answer System - to be deprecated or refactored for new ThreadNode system
export async function createQuestion(topicId: string, statementId: string, content: string, askedBy: string): Promise<Question> {
  logger.warn("DEPRECATED: createQuestion is called. Use createThreadNode instead.");
  const threadNode = await createThreadNode({
    topicId,
    statementId,
    statementAuthorId: '', 
    parentId: null,
    content,
    createdBy: askedBy,
    type: 'question',
  });
  return {
    id: threadNode.id,
    topicId: threadNode.topicId,
    statementId: threadNode.statementId,
    content: threadNode.content,
    askedBy: threadNode.createdBy,
    createdAt: threadNode.createdAt,
    answered: false, 
  } as Question;
}

export async function getQuestionsForStatement(topicId: string, statementId: string): Promise<Question[]> {
  logger.warn("DEPRECATED: getQuestionsForStatement is called. Use getThreadsForStatement instead and filter for type 'question'.");
  const threads = await getThreadsForStatement(topicId, statementId);
  return threads
    .filter(node => node.type === 'question' && !node.parentId) 
    .map(node => ({
      id: node.id,
      topicId: node.topicId,
      statementId: node.statementId,
      content: node.content,
      askedBy: node.createdBy,
      createdAt: node.createdAt,
      answered: threads.some(reply => reply.parentId === node.id && reply.type === 'response'),
    } as Question));
}

export async function answerQuestion(topicId: string, statementId: string, questionId: string, answer: string): Promise<void> {
  logger.warn("DEPRECATED: answerQuestion is called. Use createThreadNode (type: 'response') instead.");
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated to answer question.");
  
  throw new Error("answerQuestion is deprecated. Use createThreadNode with type 'response'. Ensure statementAuthorId is correctly passed.");
}
