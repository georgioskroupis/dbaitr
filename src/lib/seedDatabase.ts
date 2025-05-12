
'use server';

import { db } from '@/lib/firebase/config';
import type { UserProfile, Topic, Statement, Question } from '@/types';
import { doc, Timestamp, writeBatch, collection, getDocs } from 'firebase/firestore';

// This function seeds a specific set of test data as requested for a "strict Firestore write test".
export async function seedTestData(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if topics collection already has data
    const topicsSnapshot = await getDocs(collection(db, 'topics'));
    if (!topicsSnapshot.empty) {
      console.log('⚠️ Firestore already seeded with topics. Skipping auto-seed.');
      return { success: true, message: 'Firestore already contains topic data. Auto-seeding skipped.' };
    }
    console.log('ℹ️ No existing topics found. Proceeding with initial data seed.');

    const batch = writeBatch(db);

    const testUserId = 'user_test';
    const testTopicId = 'topic_tiktok';
    const statement1Id = 'statement1';
    const statement2Id = 'statement2';
    const question1Id = 'question1';

    // STEP 1: Add test user
    const userRef = doc(db, 'users', testUserId);
    const userTestData: UserProfile = {
      uid: testUserId,
      fullName: "Test User",
      email: "test@example.com",
      kycVerified: true,
      createdAt: Timestamp.now()
    };
    batch.set(userRef, userTestData);

    // STEP 2: Add topic manually
    const topicRef = doc(db, 'topics', testTopicId);
    const topicTestData: Omit<Topic, 'id'> = {
      title: "Should governments ban TikTok?",
      description: "A debate over digital sovereignty, data privacy, and youth influence.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-governments-ban-tiktok'
    };
    batch.set(topicRef, topicTestData);

    // STEP 3: Add two statements to the topic
    const statement1Ref = doc(db, 'topics', testTopicId, 'statements', statement1Id);
    const statement1Data: Omit<Statement, 'id'> = {
      topicId: testTopicId,
      content: "TikTok enables foreign governments to subtly influence public opinion.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement1Ref, statement1Data);

    const statement2Ref = doc(db, 'topics', testTopicId, 'statements', statement2Id);
    const statement2Data: Omit<Statement, 'id'> = {
      topicId: testTopicId,
      content: "Banning TikTok undermines digital freedom. Users should choose what apps to use.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.90,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement2Ref, statement2Data);

    // STEP 4: Add a question under one of the statements
    const question1Ref = doc(db, 'topics', testTopicId, 'statements', statement1Id, 'questions', question1Id);
    const question1Data: Omit<Question, 'id'> = {
      topicId: testTopicId,
      statementId: statement1Id,
      content: "What about similar practices by U.S. platforms?",
      askedBy: testUserId,
      createdAt: Timestamp.now(),
      answered: false
    };
    batch.set(question1Ref, question1Data);

    console.log('⏳ Committing test data batch...');
    await batch.commit();
    console.log('✅ Test data batch committed.');
    
    return { success: true, message: '✅ Sample data successfully written to Firestore.' };
  } catch (error) {
    console.error('Error writing sample data:', error);
    let errorMessage = 'An unknown error occurred during seeding.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `❌ Error writing sample data: ${errorMessage}` };
  }
}
