
"use server";

import { auth, db } from '@/lib/firebase/config';
import type { Topic, Post, UserProfile } from '@/types';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, updateDoc, Timestamp, limit, orderBy } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

export async function createUserProfile(userId: string, email: string, displayName: string | null): Promise<UserProfile> {
  const userProfileRef = doc(db, "users", userId);
  const userProfile: UserProfile = {
    uid: userId,
    email,
    displayName: displayName || email?.split('@')[0] || 'Anonymous User',
    isVerified: false, // Default to not verified
    createdAt: Timestamp.now(),
  };
  await setDoc(userProfileRef, userProfile);
  return userProfile;
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
    isVerified: true, // Simulate verification upon upload for now
    idDocumentUrl: idDocumentUrl,
    updatedAt: serverTimestamp(),
  });
  revalidatePath('/(app)/verify-identity'); 
  revalidatePath('/(app)/dashboard');
  revalidatePath('/'); // Revalidate homepage as well, auth state might change display
}


export async function createTopic(title: string, description: string | undefined, userId: string, creatorName: string | undefined, aiAnalysis?: string): Promise<Topic> {
  const topicsCollection = collection(db, "topics");
  const newTopicRef = await addDoc(topicsCollection, {
    title,
    description: description || '',
    aiAnalysis: aiAnalysis || '',
    createdBy: userId,
    creatorName: creatorName || 'Anonymous',
    createdAt: serverTimestamp(),
    tags: title.toLowerCase().split(/\s+/).filter(tag => tag.length > 2 && tag.length < 20).slice(0,5), // Basic tagging
    participantCount: 0,
    postCount: 0,
  });
  revalidatePath('/(app)/dashboard');
  revalidatePath('/(app)/topics/new');
  revalidatePath('/');
  return { id: newTopicRef.id, title, createdBy: userId, createdAt: Timestamp.now(), aiAnalysis };
}

export async function createPost(topicId: string, userId: string, userName: string | undefined, userPhotoURL: string | undefined, content: string, position?: 'For' | 'Against' | null, positionConfidence?: number): Promise<Post> {
  const postsCollection = collection(db, "posts");
  const newPostRef = await addDoc(postsCollection, {
    topicId,
    userId,
    userName: userName || 'Anonymous',
    userPhotoURL: userPhotoURL || '',
    content,
    position: position || null,
    positionConfidence: positionConfidence || null,
    createdAt: serverTimestamp(),
    isMainStatement: true, 
  });

  // Increment postCount on the topic
  const topicRef = doc(db, "topics", topicId);
  const topicSnap = await getDoc(topicRef);
  if (topicSnap.exists()) {
    const currentPostCount = topicSnap.data().postCount || 0;
    await updateDoc(topicRef, {
      postCount: currentPostCount + 1,
    });
  }

  revalidatePath(`/(app)/topics/${topicId}`);
  revalidatePath('/(app)/dashboard'); // To update topic card stats potentially
  return { id: newPostRef.id, topicId, userId, content, createdAt: Timestamp.now(), isMainStatement: true };
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

export async function getPostsForTopic(topicId: string): Promise<Post[]> {
  const postsCollection = collection(db, "posts");
  const q = query(postsCollection, where("topicId", "==", topicId), orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
}

export async function checkIfUserHasPostedMainStatement(userId: string, topicId: string): Promise<boolean> {
  const postsCollection = collection(db, "posts");
  const q = query(
    postsCollection,
    where("userId", "==", userId),
    where("topicId", "==", topicId),
    where("isMainStatement", "==", true), // This might be redundant if all posts are main for now
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

export async function getAllTopicTitles(): Promise<string[]> {
  const topicsCollection = collection(db, "topics");
  // Consider limiting the number of titles fetched if the collection grows very large.
  // For now, fetching all is fine for a smaller set of topics.
  const q = query(topicsCollection, orderBy("createdAt", "desc"), limit(500)); // Fetch recent 500
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => (doc.data() as Topic).title);
}

export async function updateTopicWithAnalysis(topicId: string, analysis: string): Promise<void> {
  const topicRef = doc(db, "topics", topicId);
  await updateDoc(topicRef, {
    aiAnalysis: analysis,
  });
  revalidatePath(`/(app)/topics/${topicId}`);
}
