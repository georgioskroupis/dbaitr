
"use server";

import { auth, db } from '@/lib/firebase/config';
import type { Topic, Statement, UserProfile, Question, ThreadNode } from '@/types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, updateDoc, Timestamp, limit, orderBy, runTransaction, FieldValue, increment } from 'firebase/firestore'; 
import { revalidatePath } from 'next/cache';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

// Helper to convert Firestore data with Timestamps to data with ISO strings
const convertTimestampsToISO = (timestampFields: string[], data: Record<string, any>): Record<string, any> => {
  const convertedData = { ...data };
  timestampFields.forEach(field => {
    if (data[field] && data[field] instanceof Timestamp) {
      convertedData[field] = (data[field] as Timestamp).toDate().toISOString();
    } else if (data[field] && typeof data[field] === 'object' && 'seconds' in data[field] && 'nanoseconds' in data[field]) {
      convertedData[field] = new Timestamp(data[field].seconds, data[field].nanoseconds).toDate().toISOString();
    }
  });
  return convertedData;
};


export async function createUserProfile(
  userId: string, 
  email: string | null, 
  fullNameFromAuth: string | null,
  providerIdFromAuth: string | undefined
): Promise<UserProfile | null> {
  const userProfileRef = doc(db, "users", userId);

  try {
    const docSnap = await getDoc(userProfileRef);

    if (!docSnap.exists()) {
      let provider: UserProfile['provider'] = 'unknown';
      if (providerIdFromAuth === 'password') {
        provider = 'password';
      } else if (providerIdFromAuth === 'google.com') {
        provider = 'google';
      } else if (providerIdFromAuth === 'apple.com') {
        provider = 'apple';
      }

      const fullNameToSet = fullNameFromAuth || email?.split('@')[0] || 'Anonymous User';

      const userProfileData = {
        uid: userId,
        email: email || '', // Ensure email is not null
        fullName: fullNameToSet,
        kycVerified: false,
        createdAt: serverTimestamp(), // Use serverTimestamp for consistency
        provider: provider,
      };
      await setDoc(userProfileRef, userProfileData);
      console.log(`[firestoreActions] User profile created for UID: ${userId} with provider: ${provider}`);
      // For returning, we need to simulate the serverTimestamp outcome for createdAt
      // This is tricky without re-fetching, but for client-side use, an immediate ISO string is okay.
      // The AuthContext will re-fetch and get the actual server-generated timestamp.
      return {
        ...userProfileData,
        createdAt: new Date().toISOString(), // Approximation
      } as UserProfile;
    } else {
      console.log(`[firestoreActions] User profile already exists for UID: ${userId}. No action taken.`);
      // Optionally, update the existing profile with new provider info if it changed, using setDoc with merge:true
      // For now, just return existing data or null if no update is intended
      const existingData = docSnap.data();
      return convertTimestampsToISO(['createdAt', 'updatedAt'], existingData) as UserProfile;
    }
  } catch (error) {
    console.error(`[firestoreActions] Error in createUserProfile for UID ${userId}:`, error);
    // It's important to re-throw or handle this error appropriately so callers are aware.
    // For now, re-throwing to ensure visibility.
    throw new Error(`Failed to create or check user profile: ${(error as Error).message}`);
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userProfileRef = doc(db, "users", userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return convertTimestampsToISO(['createdAt', 'updatedAt'], data) as UserProfile;
  }
  return null;
}

export async function updateUserVerificationStatus(userId: string, idDocumentUrl: string): Promise<void> {
  const userProfileRef = doc(db, "users", userId);
  await updateDoc(userProfileRef, {
    kycVerified: true,
    updatedAt: serverTimestamp(),
  });
  revalidatePath('/(app)/verify-identity');
  revalidatePath('/(app)/dashboard');
  revalidatePath('/');
}


export async function createTopic(title: string, initialDescription: string | undefined, userId: string): Promise<Topic> {
  const topicsCollection = collection(db, "topics");
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
  console.log("[createStatement] Called with:", { topicId, userId, content });

  const topicRef = doc(db, "topics", topicId);
  
  const topicSnap = await getDoc(topicRef);
  if (!topicSnap.exists()) {
    throw new Error("Topic not found, cannot classify statement.");
  }
  const topicDataForClassification = topicSnap.data();
  if (!topicDataForClassification || !topicDataForClassification.title) {
    throw new Error("Topic data is invalid, cannot retrieve title for classification.");
  }

  console.log("[createStatement] Calling classifyPostPosition with:", {
    topicTitle: topicDataForClassification.title,
    post: content,
  });

  let classificationResult;
  try {
    classificationResult = await classifyPostPosition({ topic: topicDataForClassification.title, post: content });
    console.log("[createStatement] Classification result:", classificationResult);
  } catch (err) {
    console.error("[createStatement] AI classification failed:", err);
    throw new Error("AI classification failed. Cannot continue creating statement.");
  }
  
  const position = classificationResult.position;
  const aiConfidence = classificationResult.confidence;

  if (!['for', 'against', 'neutral'].includes(position)) {
    console.error("[createStatement] Invalid position returned by AI:", position);
    throw new Error("Invalid classification result. Statement creation aborted.");
  }

  const statementsCollection = collection(db, "topics", topicId, "statements");
  let newStatementRefId: string | null = null;

  await runTransaction(db, async (transaction) => {
    const currentTopicDoc = await transaction.get(topicRef);
    if (!currentTopicDoc.exists()) {
      throw new Error("Topic does not exist inside transaction!");
    }

    const topicScoreUpdateData: { [key: string]: FieldValue | ReturnType<typeof increment> } = {};
    if (position === 'for') {
      topicScoreUpdateData.scoreFor = increment(1);
    } else if (position === 'against') {
      topicScoreUpdateData.scoreAgainst = increment(1);
    } else if (position === 'neutral') {
      topicScoreUpdateData.scoreNeutral = increment(1);
    } else {
      console.warn(`createStatement: Unhandled position '${position}' for score update. Scores will not be incremented for this statement.`);
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
  
  console.log("[createStatement] Statement successfully created with ID:", newStatementRefId);

  return {
    id: newStatementRefId,
    topicId,
    content,
    createdBy: userId,
    position,
    aiConfidence,
    createdAt: new Date().toISOString(), 
    lastEditedAt: new Date().toISOString(), 
  };
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

    const topicData = topicDoc.data();
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
    const q = query(threadsCollection, where("parentId", "==", parentId), where("type", "==", "response"));
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

  return {
    id: newThreadNodeRef.id,
    topicId,
    statementId,
    parentId,
    content,
    createdBy,
    type,
    createdAt: new Date().toISOString(), 
  } as ThreadNode;
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
        where("statementId", "==", statementId), 
        where("topicId", "==", topicId),       
        where("type", "==", "question")
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// Deprecated - remove or refactor if this specific old schema is ever needed.
// Old Question/Answer System - to be deprecated or refactored for new ThreadNode system
export async function createQuestion(topicId: string, statementId: string, content: string, askedBy: string): Promise<Question> {
  console.warn("DEPRECATED: createQuestion is called. Use createThreadNode instead.");
  const questionsCollection = collection(db, "topics", topicId, "statements", statementId, "questions");
  const newQuestionServerData = {
    topicId,
    statementId,
    content,
    askedBy,
    createdAt: serverTimestamp(),
    answered: false,
  };
  const newQuestionRef = await addDoc(questionsCollection, newQuestionServerData);
  revalidatePath(`/(app)/topics/${topicId}`);

  return {
    id: newQuestionRef.id,
    topicId,
    statementId,
    content,
    askedBy,
    createdAt: new Date().toISOString(), // Approximation
    answered: false,
  } as Question;
}

export async function getQuestionsForStatement(topicId: string, statementId: string): Promise<Question[]> {
  console.warn("DEPRECATED: getQuestionsForStatement is called. Use getThreadsForStatement instead.");
  const questionsCollection = collection(db, "topics", topicId, "statements", statementId, "questions");
  const q = query(questionsCollection, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      ...convertTimestampsToISO(['createdAt', 'answeredAt'], data),
    } as Question;
  });
}

export async function answerQuestion(topicId: string, statementId: string, questionId: string, answer: string): Promise<void> {
  console.warn("DEPRECATED: answerQuestion is called. Use createThreadNode (type: 'response') instead.");
  const questionRef = doc(db, "topics", topicId, "statements", statementId, "questions", questionId);
  await updateDoc(questionRef, {
    answer: answer,
    answered: true,
    answeredAt: serverTimestamp(),
  });
  revalidatePath(`/(app)/topics/${topicId}`);
}
// End Old Question/Answer System

    


