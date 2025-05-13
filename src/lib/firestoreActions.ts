
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
      const userProfileData: Omit<UserProfile, 'createdAt' | 'updatedAt' | 'id'> & { createdAt: FieldValue, updatedAt?: FieldValue } = {
        uid: userId,
        email: email || '', 
        fullName: fullNameToSet,
        kycVerified: false,
        createdAt: serverTimestamp(), 
        provider: provider,
      };
      await setDoc(userProfileRef, userProfileData);
      console.log(`[firestoreActions] User profile CREATED for UID: ${userId} with provider: ${provider}`);
      // Return a representation matching UserProfile type, actual timestamp will be on server
      return {
        ...userProfileData,
        createdAt: new Date().toISOString(), // Approximate for immediate use
      } as UserProfile;
    } else {
      // Profile exists, optionally update if provider changed or if there's new info
      // For now, just log and return existing. If merge logic is needed, it can be added here.
      console.log(`[firestoreActions] User profile already exists for UID: ${userId}. Ensuring provider is up-to-date.`);
      // Update if provider is different or not set, or if fullName is missing and now available
      const existingData = docSnap.data() as UserProfile;
      const updates: Partial<UserProfile> & {updatedAt?: FieldValue} = {};
      if (existingData.provider !== provider && provider !== 'unknown') {
        updates.provider = provider;
      }
      if (!existingData.fullName && fullNameToSet !== 'Anonymous User') {
        updates.fullName = fullNameToSet;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp();
        await setDoc(userProfileRef, updates, { merge: true });
        console.log(`[firestoreActions] User profile UPDATED for UID: ${userId} with changes:`, updates);
         return {
          ...existingData,
          ...updates,
          createdAt: existingData.createdAt, // Keep original createdAt
          updatedAt: new Date().toISOString(), // Approximate
        } as UserProfile;
      }
      return convertTimestampsToISO(['createdAt', 'updatedAt'], existingData) as UserProfile;
    }
  } catch (error) {
    console.error(`[firestoreActions] Error in createUserProfile for UID ${userId}:`, error);
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
    idDocumentUrl: idDocumentUrl, // Storing the URL for reference, might be useful
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
  const q = query(topicsCollection, orderBy("createdAt", "desc"), limit(500)); // Consider if limit is appropriate for all use cases
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => (doc.data() as Topic).title);
}

export async function updateTopicDescriptionWithAISummary(topicId: string, summary: string): Promise<void> {
  const topicRef = doc(db, "topics", topicId);
  await updateDoc(topicRef, {
    description: summary,
    updatedAt: serverTimestamp(), // Add updatedAt timestamp
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

    // const topicData = topicDoc.data(); // Not strictly needed here
    const statementData = statementDoc.data();

    const actualOldPosition = oldPosition || statementData.position as 'for' | 'against' | 'neutral' | 'pending';

    // If position isn't changing and it's not just a pending->finalized update
    if (actualOldPosition === newPosition && statementData.position !== 'pending') { 
      transaction.update(statementRef, { lastEditedAt: serverTimestamp() }); 
      return;
    }

    const scoresUpdate: { [key: string]: ReturnType<typeof increment> } = {};

    // Decrement old score if it was not 'pending'
    if (actualOldPosition !== 'pending') { 
        if (actualOldPosition === 'for') scoresUpdate.scoreFor = increment(-1); 
        else if (actualOldPosition === 'against') scoresUpdate.scoreAgainst = increment(-1);
        else if (actualOldPosition === 'neutral') scoresUpdate.scoreNeutral = increment(-1);
    }

    // Increment new score
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

  // Enforce business logic for questions
  if (type === 'question') {
    const userQuestionCount = await getUserQuestionCountForStatement(createdBy, statementId, topicId);
    if (userQuestionCount >= 3) {
      throw new Error("User has reached the maximum of 3 questions for this statement's thread.");
    }
  }
  
  // Enforce business logic for responses
  if (type === 'response') {
    if (createdBy !== statementAuthorId) {
      throw new Error("Only the statement author can respond to questions in this thread.");
    }
    if (!parentId) { // Responses must reply to a question (which is a ThreadNode itself)
        throw new Error("Responses must have a parent question node.");
    }
    // Check if the parent question (identified by parentId) already has a response by this author.
    // A question node should only have one direct child of type 'response' from the statementAuthorId.
    const q = query(threadsCollection, 
        where("parentId", "==", parentId), 
        where("type", "==", "response"),
        where("createdBy", "==", statementAuthorId) // Ensure we are checking for this author's response
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

  return {
    id: newThreadNodeRef.id,
    topicId,
    statementId,
    parentId,
    content,
    createdBy,
    type,
    createdAt: new Date().toISOString(), // Approximation for immediate use
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
        // statementId and topicId are implicitly part of the collection path,
        // but adding them to where clause can be useful if structure changes or for clarity.
        // However, Firestore doesn't query across subcollections by default this way.
        // The path itself ensures statementId and topicId are correct.
        where("type", "==", "question")
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
}

// Deprecated - remove or refactor if this specific old schema is ever needed.
// Old Question/Answer System - to be deprecated or refactored for new ThreadNode system
export async function createQuestion(topicId: string, statementId: string, content: string, askedBy: string): Promise<Question> {
  console.warn("DEPRECATED: createQuestion is called. Use createThreadNode instead.");
  // This function will now essentially call createThreadNode
  const threadNode = await createThreadNode({
    topicId,
    statementId,
    statementAuthorId: '', // This info might not be readily available here; might need to fetch statement
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
    answered: false, // This concept needs to map to ThreadNode structure (e.g. has a child response)
  } as Question;
}

export async function getQuestionsForStatement(topicId: string, statementId: string): Promise<Question[]> {
  console.warn("DEPRECATED: getQuestionsForStatement is called. Use getThreadsForStatement instead and filter for type 'question'.");
  const threads = await getThreadsForStatement(topicId, statementId);
  return threads
    .filter(node => node.type === 'question' && !node.parentId) // Only root questions
    .map(node => ({
      id: node.id,
      topicId: node.topicId,
      statementId: node.statementId,
      content: node.content,
      askedBy: node.createdBy,
      createdAt: node.createdAt,
      answered: threads.some(reply => reply.parentId === node.id && reply.type === 'response'),
      // answer and answeredAt would need to be derived from child 'response' nodes
    } as Question));
}

export async function answerQuestion(topicId: string, statementId: string, questionId: string, answer: string): Promise<void> {
  console.warn("DEPRECATED: answerQuestion is called. Use createThreadNode (type: 'response') instead.");
  // This requires knowing the statementAuthorId. Assuming the currently authenticated user is the statement author.
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated to answer question.");
  
  // Need to fetch the statement to get its author, or pass statementAuthorId
  // For simplicity, this deprecated function might become non-functional or require statementAuthorId
  // const statementDoc = await getDoc(doc(db, "topics", topicId, "statements", statementId));
  // if (!statementDoc.exists()) throw new Error("Statement not found.");
  // const statementAuthorId = statementDoc.data().createdBy;
  
  // This is a simplified version, proper implementation requires statementAuthorId
  // await createThreadNode({
  //   topicId,
  //   statementId,
  //   statementAuthorId: currentUser.uid, // This assumes current user IS statement author
  //   parentId: questionId, // questionId is the ID of the parent ThreadNode of type 'question'
  //   content: answer,
  //   createdBy: currentUser.uid,
  //   type: 'response',
  // });
  throw new Error("answerQuestion is deprecated. Use createThreadNode with type 'response'. Ensure statementAuthorId is correctly passed.");
}
// End Old Question/Answer System

    



