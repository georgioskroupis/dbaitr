"use server";

import { auth, db } from '@/lib/firebase/config';
import type { Topic, Statement, UserProfile, Question, ThreadNode } from '@/types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, updateDoc, Timestamp, limit, orderBy, runTransaction, FieldValue } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

// Helper to convert Firestore data with Timestamps to data with ISO strings
const convertTimestampsToISO = (timestampFields: string[], data: Record<string, any>): Record<string, any> => {
  const convertedData = { ...data };
  timestampFields.forEach(field => {
    if (data[field] && data[field] instanceof Timestamp) {
      convertedData[field] = (data[field] as Timestamp).toDate().toISOString();
    } else if (data[field] && typeof data[field] === 'object' && 'seconds' in data[field] && 'nanoseconds' in data[field]) {
      // Handle cases where it might already be partially serialized by Next.js internal mechanisms (less likely for this error but good to be aware)
      convertedData[field] = new Timestamp(data[field].seconds, data[field].nanoseconds).toDate().toISOString();
    }
  });
  return convertedData;
};


export async function createUserProfile(userId: string, email: string, fullName: string | null): Promise<UserProfile> {
  const userProfileRef = doc(db, "users", userId);
  const userProfileData = { // Firestore Timestamps are fine for writing
    uid: userId,
    email,
    fullName: fullName || email?.split('@')[0] || 'Anonymous User',
    kycVerified: false,
    createdAt: Timestamp.now(),
  };
  await setDoc(userProfileRef, userProfileData);
  // For the returned object, ensure it matches client-side type
  return {
    ...userProfileData,
    createdAt: userProfileData.createdAt.toDate().toISOString(),
  } as UserProfile;
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

  const newTopicServerData = { // Data for Firestore
    title,
    description: initialDescription || '',
    createdBy: userId,
    createdAt: serverTimestamp(), // FieldValue for server
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
    slug: slug,
  };
  const newTopicRef = await addDoc(topicsCollection, newTopicServerData);

  revalidatePath('/(app)/dashboard');
  revalidatePath('/(app)/topics/new');
  revalidatePath('/');

  // For the returned object, create an approximation that matches client-side type
  return {
    id: newTopicRef.id,
    title,
    description: initialDescription || '',
    createdBy: userId,
    createdAt: new Date().toISOString(), // Approximation for immediate client use
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
    slug: slug,
  } as Topic;
}

export async function createStatement(topicId: string, userId: string, content: string, userName?: string, userPhotoURL?: string): Promise<Statement> {
  const topicRef = doc(db, "topics", topicId);
  
  // Get topic title for AI classification (outside transaction for external call)
  const topicSnap = await getDoc(topicRef);
  if (!topicSnap.exists()) {
    throw new Error("Topic not found, cannot classify statement.");
  }
  const topicDataForClassification = topicSnap.data();
  if (!topicDataForClassification || !topicDataForClassification.title) {
    throw new Error("Topic data is invalid, cannot retrieve title for classification.");
  }

  const classificationResult = await classifyPostPosition({ topic: topicDataForClassification.title, post: content });
  const position = classificationResult.position as 'for' | 'against' | 'neutral';
  const aiConfidence = classificationResult.confidence;

  const statementsCollection = collection(db, "topics", topicId, "statements");
  let newStatementRefId: string | null = null;

  await runTransaction(db, async (transaction) => {
    const currentTopicDoc = await transaction.get(topicRef);
    if (!currentTopicDoc.exists()) {
      throw new Error("Topic does not exist inside transaction!");
    }

    // Prepare the update object for topic scores using FieldValue.increment
    const topicScoreUpdateData: { [key: string]: FieldValue } = {};
    if (position === 'for') {
      topicScoreUpdateData.scoreFor = FieldValue.increment(1);
    } else if (position === 'against') {
      topicScoreUpdateData.scoreAgainst = FieldValue.increment(1);
    } else if (position === 'neutral') {
      topicScoreUpdateData.scoreNeutral = FieldValue.increment(1);
    } else {
      // This case should ideally not happen if AI classification is robust
      // and returns one of 'for', 'against', 'neutral'.
      console.warn(`createStatement: Unhandled position '${position}' for score update. Scores will not be incremented for this statement.`);
    }
    
    // Update topic scores if a valid position was determined
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
    
    const tempStatementRef = doc(statementsCollection); // Create a new doc ref for statement to get its ID
    newStatementRefId = tempStatementRef.id;
    transaction.set(tempStatementRef, statementServerData); // Set the statement data
  });

  revalidatePath(`/(app)/topics/${topicId}`);
  revalidatePath('/(app)/dashboard');

  if (!newStatementRefId) {
    throw new Error("Failed to create statement reference within transaction.");
  }

  // For the returned object, create an approximation that matches client-side type
  return {
    id: newStatementRefId,
    topicId,
    content,
    createdBy: userId,
    position,
    aiConfidence,
    createdAt: new Date().toISOString(), // Approximation
    lastEditedAt: new Date().toISOString(), // Approximation
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

    if (actualOldPosition === newPosition && statementData.position !== 'pending') { // also check if it's not a pending to classified change
      transaction.update(statementRef, { lastEditedAt: serverTimestamp() }); // Just update edit time if position is same and not pending
      return;
    }

    const scoresUpdate: { [key: string]: FieldValue | number } = {};

    if (actualOldPosition !== 'pending') { // Only decrement if it was a scoring position
        if (actualOldPosition === 'for') scoresUpdate.scoreFor = FieldValue.increment(-1); // Use increment for decrement
        else if (actualOldPosition === 'against') scoresUpdate.scoreAgainst = FieldValue.increment(-1);
        else if (actualOldPosition === 'neutral') scoresUpdate.scoreNeutral = FieldValue.increment(-1);
    }


    if (newPosition === 'for') scoresUpdate.scoreFor = FieldValue.increment(1);
    else if (newPosition === 'against') scoresUpdate.scoreAgainst = FieldValue.increment(1);
    else if (newPosition === 'neutral') scoresUpdate.scoreNeutral = FieldValue.increment(1);
    
    transaction.update(topicRef, scoresUpdate);
    transaction.update(statementRef, { position: newPosition, lastEditedAt: serverTimestamp() });
  });

  revalidatePath(`/(app)/topics/${topicId}`);
}


// New ThreadNode System
export async function createThreadNode(data: {
  topicId: string;
  statementId: string;
  statementAuthorId: string; // Author of the root statement
  parentId: string | null; // ID of parent ThreadNode, or null if root question for statement
  content: string;
  createdBy: string; // UID of user creating this node
  type: 'question' | 'response';
}): Promise<ThreadNode> {
  const { topicId, statementId, statementAuthorId, parentId, content, createdBy, type } = data;
  const threadsCollection = collection(db, "topics", topicId, "statements", statementId, "threads");

  // Constraint 1: User question limit (3 per statement thread for questions of type 'question').
  if (type === 'question') {
    const userQuestionCount = await getUserQuestionCountForStatement(createdBy, statementId, topicId);
    if (userQuestionCount >= 3) {
      throw new Error("User has reached the maximum of 3 questions for this statement's thread.");
    }
  }
  
  // Constraint 2: Only statement author can create ThreadNode of type 'response'.
  if (type === 'response') {
    if (createdBy !== statementAuthorId) {
      throw new Error("Only the statement author can respond to questions in this thread.");
    }
    // Constraint 3: A ThreadNode of type: 'question' can only have one direct child ThreadNode of type: 'response'.
    // This means if parentId is a question, check if it already has a response.
    if (!parentId) { // Should not happen for a response, but defensive check
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

    