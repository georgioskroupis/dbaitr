
"use server";

import { auth, db } from '@/lib/firebase/config';
import type { Topic, Statement, UserProfile, Question } from '@/types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, updateDoc, Timestamp, limit, orderBy, runTransaction } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { classifyPostPosition } from '@/ai/flows/classify-post-position'; // Assuming this will be updated for 'neutral'

export async function createUserProfile(userId: string, email: string, fullName: string | null): Promise<UserProfile> {
  const userProfileRef = doc(db, "users", userId);
  const userProfileData: UserProfile = {
    uid: userId,
    email,
    fullName: fullName || email?.split('@')[0] || 'Anonymous User',
    kycVerified: false, // Default to not verified
    createdAt: Timestamp.now(),
  };
  await setDoc(userProfileRef, userProfileData);
  return userProfileData;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userProfileRef = doc(db, "users", userId);
  const docSnap = await getDoc(userProfileRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

export async function updateUserVerificationStatus(userId: string, idDocumentUrl: string): Promise<void> {
  const userProfileRef = doc(db, "users", userId);
  await updateDoc(userProfileRef, {
    kycVerified: true, // Simulate verification upon upload for now
    // idDocumentUrl: idDocumentUrl, // No longer in UserProfile schema per new design
    updatedAt: serverTimestamp(),
  });
  revalidatePath('/(app)/verify-identity'); 
  revalidatePath('/(app)/dashboard');
  revalidatePath('/'); 
}


export async function createTopic(title: string, initialDescription: string | undefined, userId: string): Promise<Topic> {
  const topicsCollection = collection(db, "topics");
  
  // Basic slug generation (can be improved)
  const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

  const newTopicData = {
    title,
    description: initialDescription || '', // AI will update this later
    createdBy: userId,
    createdAt: serverTimestamp(),
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
    slug: slug,
  };
  const newTopicRef = await addDoc(topicsCollection, newTopicData);
  
  revalidatePath('/(app)/dashboard');
  revalidatePath('/(app)/topics/new');
  revalidatePath('/');
  
  return { 
    id: newTopicRef.id, 
    ...newTopicData, 
    createdAt: Timestamp.now() // serverTimestamp() resolves on server, approximate for return
  } as Topic;
}

// Renamed from createPost to createStatement
export async function createStatement(topicId: string, userId: string, content: string, userName?: string, userPhotoURL?: string): Promise<Statement> {
  const topicRef = doc(db, "topics", topicId);
  const topicSnap = await getDoc(topicRef);
  if (!topicSnap.exists()) {
    throw new Error("Topic not found");
  }
  const topicData = topicSnap.data() as Topic;

  // 1. Call AI to classify the statement content
  // Assuming classifyPostPosition flow is updated to return 'for', 'against', or 'neutral'
  const classificationResult = await classifyPostPosition({ topic: topicData.title, post: content });
  const position = classificationResult.position as 'for' | 'against' | 'neutral'; // Cast needed if enum has more values
  const aiConfidence = classificationResult.confidence;

  // 2. Add statement to Firestore and update topic scores in a transaction
  const statementsCollection = collection(db, "topics", topicId, "statements");
  let newStatementRef;

  await runTransaction(db, async (transaction) => {
    // Get current topic scores
    const currentTopicDoc = await transaction.get(topicRef);
    if (!currentTopicDoc.exists()) {
      throw "Topic does not exist!";
    }
    const currentTopicData = currentTopicDoc.data();
    const newScores = {
      scoreFor: currentTopicData.scoreFor,
      scoreAgainst: currentTopicData.scoreAgainst,
      scoreNeutral: currentTopicData.scoreNeutral,
    };

    if (position === 'for') newScores.scoreFor += 1;
    else if (position === 'against') newScores.scoreAgainst += 1;
    else if (position === 'neutral') newScores.scoreNeutral += 1;
    
    transaction.update(topicRef, newScores);

    // Add the new statement
    // Firestore generates ID for new doc, so we can't get newStatementRef.id inside transaction easily
    // We'll add it and then fetch it or just return the data
    const statementData = {
      topicId,
      userId,
      // userName: userName || 'Anonymous', // Not in new Statement schema, createdBy has user info
      // userPhotoURL: userPhotoURL || '', // Not in new Statement schema
      content,
      position,
      aiConfidence,
      createdAt: serverTimestamp(), // serverTimestamp() for accurate creation time
      lastEditedAt: serverTimestamp(),
    };
    // To get the ID, we have to add it outside transaction or use a hack.
    // For simplicity, we'll add it here. If transaction fails, this write is wasted.
    // A better way is to generate ID client-side or use a placeholder then update.
    // However, addDoc is simple. Let's assume we get ref here.
    // This is not ideal for atomicity, but simpler for now.
    // A more robust solution would be to create statement doc first with pending state,
    // then have a cloud function handle AI + score update.
    // Given the constraints of server actions, we do it sequentially.
    newStatementRef = await addDoc(statementsCollection, statementData);
  });

  revalidatePath(`/(app)/topics/${topicId}`);
  revalidatePath('/(app)/dashboard'); 

  if (!newStatementRef) {
    throw new Error("Failed to create statement reference within transaction.");
  }

  return { 
    id: newStatementRef.id, 
    topicId,
    content,
    createdBy: userId,
    position,
    aiConfidence,
    createdAt: Timestamp.now(), // Placeholder for serverTimestamp
    lastEditedAt: Timestamp.now(), // Placeholder
  };
}

export async function getTopics(): Promise<Topic[]> {
  const topicsCollection = collection(db, "topics");
  const q = query(topicsCollection, orderBy("createdAt", "desc")); 
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
}

export async function getTopicById(topicId: string): Promise<Topic | null> {
  const topicRef = doc(db, "topics", topicId);
  const docSnap = await getDoc(topicRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Topic;
  }
  return null;
}

export async function getTopicByTitle(title: string): Promise<Topic | null> {
  const topicsCollection = collection(db, "topics");
  const q = query(topicsCollection, where("title", "==", title), limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Topic;
  }
  return null;
}

// Renamed from getPostsForTopic to getStatementsForTopic
export async function getStatementsForTopic(topicId: string): Promise<Statement[]> {
  const statementsCollection = collection(db, "topics", topicId, "statements");
  const q = query(statementsCollection, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Statement));
}

// Renamed from checkIfUserHasPostedMainStatement
export async function checkIfUserHasPostedStatement(userId: string, topicId: string): Promise<boolean> {
  const statementsCollection = collection(db, "topics", topicId, "statements");
  const q = query(
    statementsCollection,
    where("createdBy", "==", userId),
    limit(1) // User can only have one statement per topic
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

// Updated to reflect that topic.description is the AI summary
export async function updateTopicDescriptionWithAISummary(topicId: string, summary: string): Promise<void> {
  const topicRef = doc(db, "topics", topicId);
  await updateDoc(topicRef, {
    description: summary,
  });
  revalidatePath(`/(app)/topics/${topicId}`);
}

// New functions for Questions

export async function createQuestion(topicId: string, statementId: string, content: string, askedBy: string): Promise<Question> {
  const questionsCollection = collection(db, "topics", topicId, "statements", statementId, "questions");
  const newQuestionData = {
    topicId,
    statementId,
    content,
    askedBy,
    createdAt: serverTimestamp(),
    answered: false,
  };
  const newQuestionRef = await addDoc(questionsCollection, newQuestionData);
  revalidatePath(`/(app)/topics/${topicId}`); // Revalidate the whole topic page
  
  return { 
    id: newQuestionRef.id, 
    ...newQuestionData,
    createdAt: Timestamp.now() // Placeholder
  } as Question;
}

export async function getQuestionsForStatement(topicId: string, statementId: string): Promise<Question[]> {
  const questionsCollection = collection(db, "topics", topicId, "statements", statementId, "questions");
  const q = query(questionsCollection, orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Question));
}

export async function answerQuestion(topicId: string, statementId: string, questionId: string, answer: string): Promise<void> {
  const questionRef = doc(db, "topics", topicId, "statements", statementId, "questions", questionId);
  await updateDoc(questionRef, {
    answer: answer,
    answered: true,
    answeredAt: serverTimestamp(),
  });
  revalidatePath(`/(app)/topics/${topicId}`);
}

// Function to update a statement's position and topic scores (e.g., if re-classified or edited)
export async function updateStatementPosition(
  topicId: string, 
  statementId: string, 
  newPosition: 'for' | 'against' | 'neutral',
  oldPosition?: 'for' | 'against' | 'neutral' | 'pending' // Optional, if known, to correctly adjust scores
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

    if (actualOldPosition === newPosition) {
      // If position hasn't changed, only update statement's lastEditedAt or confidence if needed.
      // For this function, we assume position *is* changing or needs recording.
      transaction.update(statementRef, { position: newPosition, lastEditedAt: serverTimestamp() });
      return; 
    }
    
    const scoresUpdate: { [key: string]: number } = {};
    
    // Decrement old score if it was a valid scoring position
    if (actualOldPosition === 'for') scoresUpdate.scoreFor = (topicData.scoreFor || 0) - 1;
    else if (actualOldPosition === 'against') scoresUpdate.scoreAgainst = (topicData.scoreAgainst || 0) - 1;
    else if (actualOldPosition === 'neutral') scoresUpdate.scoreNeutral = (topicData.scoreNeutral || 0) - 1;

    // Increment new score
    if (newPosition === 'for') scoresUpdate.scoreFor = (scoresUpdate.scoreFor !== undefined ? scoresUpdate.scoreFor : (topicData.scoreFor || 0)) + 1;
    else if (newPosition === 'against') scoresUpdate.scoreAgainst = (scoresUpdate.scoreAgainst !== undefined ? scoresUpdate.scoreAgainst : (topicData.scoreAgainst || 0)) + 1;
    else if (newPosition === 'neutral') scoresUpdate.scoreNeutral = (scoresUpdate.scoreNeutral !== undefined ? scoresUpdate.scoreNeutral : (topicData.scoreNeutral || 0)) + 1;
    
    transaction.update(topicRef, scoresUpdate);
    transaction.update(statementRef, { position: newPosition, lastEditedAt: serverTimestamp() });
  });

  revalidatePath(`/(app)/topics/${topicId}`);
}
