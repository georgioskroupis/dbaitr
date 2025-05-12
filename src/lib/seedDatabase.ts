
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

    // --- EXISTING TEST DATA (TIKTOK TOPIC) ---
    const testTopicIdTikTok = 'topic_tiktok';
    const statement1IdTikTok = 'statement1_tiktok';
    const statement2IdTikTok = 'statement2_tiktok';
    const question1IdTikTok = 'question1_tiktok';

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

    // STEP 2: Add TikTok topic manually
    const topicRefTikTok = doc(db, 'topics', testTopicIdTikTok);
    const topicTestDataTikTok: Omit<Topic, 'id'> = {
      title: "Should governments ban TikTok?",
      description: "A debate over digital sovereignty, data privacy, and youth influence.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-governments-ban-tiktok'
    };
    batch.set(topicRefTikTok, topicTestDataTikTok);

    // STEP 3: Add two statements to the TikTok topic
    const statement1RefTikTok = doc(db, 'topics', testTopicIdTikTok, 'statements', statement1IdTikTok);
    const statement1DataTikTok: Omit<Statement, 'id'> = {
      topicId: testTopicIdTikTok,
      content: "TikTok enables foreign governments to subtly influence public opinion.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement1RefTikTok, statement1DataTikTok);

    const statement2RefTikTok = doc(db, 'topics', testTopicIdTikTok, 'statements', statement2IdTikTok);
    const statement2DataTikTok: Omit<Statement, 'id'> = {
      topicId: testTopicIdTikTok,
      content: "Banning TikTok undermines digital freedom. Users should choose what apps to use.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.90,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement2RefTikTok, statement2DataTikTok);

    // STEP 4: Add a question under one of the TikTok statements
    const question1RefTikTok = doc(db, 'topics', testTopicIdTikTok, 'statements', statement1IdTikTok, 'questions', question1IdTikTok);
    const question1DataTikTok: Omit<Question, 'id'> = {
      topicId: testTopicIdTikTok,
      statementId: statement1IdTikTok,
      content: "What about similar practices by U.S. platforms?",
      askedBy: testUserId,
      createdAt: Timestamp.now(),
      answered: false
    };
    batch.set(question1RefTikTok, question1DataTikTok);


    // --- NEW TEST DATA ---

    // TOPIC 1: AI and Jobs
    const topicIdAIJobs = 'topic_ai_jobs';
    const statementAIJobsForId = 'stmt_ai_jobs_for';
    const statementAIJobsAgainstId = 'stmt_ai_jobs_against';
    const questionAIJobsId = 'q_ai_jobs_1';

    const topicRefAIJobs = doc(db, 'topics', topicIdAIJobs);
    const topicDataAIJobs: Omit<Topic, 'id'> = {
      title: "Should AI be allowed to replace human jobs?",
      description: "Examining the economic and societal impacts of AI replacing human labor in various sectors.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-ai-replace-human-jobs'
    };
    batch.set(topicRefAIJobs, topicDataAIJobs);

    const statementAIJobsForRef = doc(db, 'topics', topicIdAIJobs, 'statements', statementAIJobsForId);
    const statementAIJobsForData: Omit<Statement, 'id'> = {
      topicId: topicIdAIJobs,
      content: "Efficiency and consistency matter. AI in logistics and customer service has already proven its worth, streamlining operations and reducing errors.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.92,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementAIJobsForRef, statementAIJobsForData);

    const statementAIJobsAgainstRef = doc(db, 'topics', topicIdAIJobs, 'statements', statementAIJobsAgainstId);
    const statementAIJobsAgainstData: Omit<Statement, 'id'> = {
      topicId: topicIdAIJobs,
      content: "Replacing people with AI erodes dignity. Work isn't just economic — it's part of identity and community. We risk widespread social displacement.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.88,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementAIJobsAgainstRef, statementAIJobsAgainstData);

    const questionAIJobsRef = doc(db, 'topics', topicIdAIJobs, 'statements', statementAIJobsForId, 'questions', questionAIJobsId);
    const questionAIJobsData: Omit<Question, 'id'> = {
      topicId: topicIdAIJobs,
      statementId: statementAIJobsForId,
      content: "Do you have examples where AI improved job satisfaction overall, rather than just company profits?",
      askedBy: testUserId,
      createdAt: Timestamp.now(),
      answered: false,
    };
    batch.set(questionAIJobsRef, questionAIJobsData);


    // TOPIC 2: Eating Meat
    const topicIdEatingMeat = 'topic_eating_meat';
    const statementMeatForId = 'stmt_meat_for';
    const statementMeatAgainstId = 'stmt_meat_against';
    const questionMeatId = 'q_meat_1';

    const topicRefEatingMeat = doc(db, 'topics', topicIdEatingMeat);
    const topicDataEatingMeat: Omit<Topic, 'id'> = {
      title: "Is it ethical to eat meat in 2025?",
      description: "Debating the morality of meat consumption in an era of advanced food technology and heightened environmental awareness.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'is-it-ethical-to-eat-meat-2025'
    };
    batch.set(topicRefEatingMeat, topicDataEatingMeat);

    const statementMeatForRef = doc(db, 'topics', topicIdEatingMeat, 'statements', statementMeatForId);
    const statementMeatForData: Omit<Statement, 'id'> = {
      topicId: topicIdEatingMeat,
      content: "We’ve evolved to eat meat; it's a natural part of the human diet. Ethical farming and emerging lab-grown alternatives mitigate most concerns about animal welfare and environmental impact.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.79,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementMeatForRef, statementMeatForData);

    const statementMeatAgainstRef = doc(db, 'topics', topicIdEatingMeat, 'statements', statementMeatAgainstId);
    const statementMeatAgainstData: Omit<Statement, 'id'> = {
      topicId: topicIdEatingMeat,
      content: "With viable plant-based and cultivated meat alternatives increasingly available, the continued large-scale suffering of sentient animals for food is no longer ethically justifiable.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.95,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementMeatAgainstRef, statementMeatAgainstData);

    const questionMeatRef = doc(db, 'topics', topicIdEatingMeat, 'statements', statementMeatAgainstId, 'questions', questionMeatId);
    const questionMeatData: Omit<Question, 'id'> = {
      topicId: topicIdEatingMeat,
      statementId: statementMeatAgainstId,
      content: "What about cultures that rely on livestock for survival and have done so sustainably for centuries? Is a global moratorium on meat ethical for them?",
      askedBy: testUserId,
      createdAt: Timestamp.now(),
      answered: false,
    };
    batch.set(questionMeatRef, questionMeatData);

    // TOPIC 3: Social Media Censorship
    const topicIdSocialCensorship = 'topic_social_censorship';
    const statementSocialForId = 'stmt_social_for';
    const statementSocialAgainstId = 'stmt_social_against';
    const questionSocialId = 'q_social_1';

    const topicRefSocialCensorship = doc(db, 'topics', topicIdSocialCensorship);
    const topicDataSocialCensorship: Omit<Topic, 'id'> = {
      title: "Should social media platforms censor misinformation?",
      description: "Exploring the balance between free speech and the responsibility of platforms to curb the spread of harmful or false information.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-social-media-censor-misinformation'
    };
    batch.set(topicRefSocialCensorship, topicDataSocialCensorship);

    const statementSocialForRef = doc(db, 'topics', topicIdSocialCensorship, 'statements', statementSocialForId);
    const statementSocialForData: Omit<Statement, 'id'> = {
      topicId: topicIdSocialCensorship,
      content: "Unchecked misinformation can destabilize democracies and endanger public health. Social media platforms have a moral and ethical responsibility to actively curate and censor harmful content.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementSocialForRef, statementSocialForData);

    const statementSocialAgainstRef = doc(db, 'topics', topicIdSocialCensorship, 'statements', statementSocialAgainstId);
    const statementSocialAgainstData: Omit<Statement, 'id'> = {
      topicId: topicIdSocialCensorship,
      content: "Censorship, even with good intentions, is a slippery slope and more dangerous in the long run than falsehoods. The public should be empowered to discern truth, not have it dictated by platforms.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.91,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementSocialAgainstRef, statementSocialAgainstData);

    const questionSocialRef = doc(db, 'topics', topicIdSocialCensorship, 'statements', statementSocialForId, 'questions', questionSocialId);
    const questionSocialData: Omit<Question, 'id'> = {
      topicId: topicIdSocialCensorship,
      statementId: statementSocialForId,
      content: "How do we define 'misinformation' and 'harmful content' consistently and without inherent political or ideological bias, especially at a global scale?",
      askedBy: testUserId,
      createdAt: Timestamp.now(),
      answered: false,
    };
    batch.set(questionSocialRef, questionSocialData);

    console.log('⏳ Committing test data batch...');
    await batch.commit();
    console.log('✅ Test data batch committed.');
    
    return { success: true, message: '✅ Sample data including new topics successfully written to Firestore.' };
  } catch (error) {
    console.error('Error writing sample data:', error);
    let errorMessage = 'An unknown error occurred during seeding.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `❌ Error writing sample data: ${errorMessage}` };
  }
}

