'use server';

import { db } from '@/lib/firebase/config';
import type { UserProfile, Topic, Statement, Question, ThreadNode } from '@/types'; // Added ThreadNode
import { doc, Timestamp, writeBatch, collection, getDocs, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { createThreadNode } from './firestoreActions'; // Import createThreadNode

// This function seeds a specific set of test data as requested for a "strict Firestore write test".
// The old seedTestData function is kept for reference or potential future use but is no longer the primary export.
async function oldSeedTestData(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if topics collection already has data
    const topicsSnapshot = await getDocs(collection(db, 'topics'));
    const oldTopicHardcodedIds = ['topic_tiktok', 'topic_ai_jobs', 'topic_eating_meat', 'topic_social_censorship'];
    const existingTopicIdsFromDB = topicsSnapshot.docs.map(doc => doc.id);
    const someOldTopicsExist = oldTopicHardcodedIds.some(id => existingTopicIdsFromDB.includes(id));


    if (someOldTopicsExist && !topicsSnapshot.empty) {
      console.log('⚠️ Firestore already contains some old topic data. Auto-seeding skipped (oldSeedTestData).');
      return { success: true, message: 'Firestore already contains some old topic data. Auto-seeding skipped (oldSeedTestData).' };
    }
    console.log('ℹ️ No existing old topics found. Proceeding with initial data seed (oldSeedTestData).');

    const batch = writeBatch(db);
    const testUserId = 'user_test_old_seed'; 

    // STEP 1: Add test user
    const userRef = doc(db, 'users', testUserId);
    const userTestData: UserProfile = {
      uid: testUserId,
      fullName: "Test User (Old Seed)",
      email: "test-old@example.com",
      kycVerified: true,
      createdAt: Timestamp.now().toDate().toISOString()
    };
    batch.set(userRef, userTestData);

    // STEP 2: Add Topics to Batch
    const topicTikTokHardcodedId = 'topic_tiktok';
    const topicRefTikTok = doc(db, 'topics', topicTikTokHardcodedId);
    const topicTestDataTikTok: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Should governments ban TikTok?",
      description: "A debate over digital sovereignty, data privacy, and youth influence.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 0, // Will be updated by statements
      scoreAgainst: 0,
      scoreNeutral: 0,
      slug: 'should-governments-ban-tiktok'
    };
    batch.set(topicRefTikTok, topicTestDataTikTok);
    
    const topicAIJobsHardcodedId = 'topic_ai_jobs';
    const topicRefAIJobs = doc(db, 'topics', topicAIJobsHardcodedId);
    const topicDataAIJobs: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Should AI be allowed to replace human jobs?",
      description: "Examining the economic and societal impacts of AI replacing human labor in various sectors.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 0, scoreAgainst: 0, scoreNeutral: 0,
      slug: 'should-ai-replace-human-jobs'
    };
    batch.set(topicRefAIJobs, topicDataAIJobs);

    const topicEatingMeatHardcodedId = 'topic_eating_meat';
    const topicRefEatingMeat = doc(db, 'topics', topicEatingMeatHardcodedId);
    const topicDataEatingMeat: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Is it ethical to eat meat in 2025 (Old Seed)?",
      description: "Debating the morality of meat consumption in an era of advanced food technology and heightened environmental awareness.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 0, scoreAgainst: 0, scoreNeutral: 0,
      slug: 'is-it-ethical-to-eat-meat-2025-old'
    };
    batch.set(topicRefEatingMeat, topicDataEatingMeat);

    const topicSocialCensorshipHardcodedId = 'topic_social_censorship';
    const topicRefSocialCensorship = doc(db, 'topics', topicSocialCensorshipHardcodedId);
    const topicDataSocialCensorship: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Should social media platforms censor misinformation (Old Seed)?",
      description: "Exploring the balance between free speech and the responsibility of platforms to curb the spread of harmful or false information.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 0, scoreAgainst: 0, scoreNeutral: 0,
      slug: 'should-social-media-censor-misinformation-old'
    };
    batch.set(topicRefSocialCensorship, topicDataSocialCensorship);

    console.log('⏳ Committing test data batch (oldSeedTestData for users, topics)...');
    await batch.commit();
    console.log('✅ Test data batch committed (oldSeedTestData for users, topics).');

    // STEP 3: Add Statements sequentially and get their IDs
    let statement1IdTikTokDyn: string, statementAIJobsForIdDyn: string, statementMeatAgainstOldIdDyn: string, statementSocialForOldIdDyn: string;

    // For TikTok Topic
    const statement1DataTikTok = {
      topicId: topicTikTokHardcodedId, content: "TikTok enables foreign governments to subtly influence public opinion.", createdBy: testUserId, createdAt: Timestamp.now(), position: "for" as const, aiConfidence: 0.85, lastEditedAt: Timestamp.now(),
    };
    const statement1RefTikTok = await addDoc(collection(db, 'topics', topicTikTokHardcodedId, 'statements'), statement1DataTikTok);
    statement1IdTikTokDyn = statement1RefTikTok.id;
    await addDoc(collection(db, 'topics', topicTikTokHardcodedId, 'statements'), {
      topicId: topicTikTokHardcodedId, content: "Banning TikTok undermines digital freedom. Users should choose what apps to use.", createdBy: testUserId, createdAt: Timestamp.now(), position: "against" as const, aiConfidence: 0.90, lastEditedAt: Timestamp.now(),
    });
    
    // For AI Jobs Topic
    const statementAIJobsForData = {
      topicId: topicAIJobsHardcodedId, content: "Efficiency and consistency matter. AI in logistics and customer service has already proven its worth, streamlining operations and reducing errors.", createdBy: testUserId, createdAt: Timestamp.now(), position: "for" as const, aiConfidence: 0.92, lastEditedAt: Timestamp.now(),
    };
    const statementAIJobsForRef = await addDoc(collection(db, 'topics', topicAIJobsHardcodedId, 'statements'), statementAIJobsForData);
    statementAIJobsForIdDyn = statementAIJobsForRef.id;
    await addDoc(collection(db, 'topics', topicAIJobsHardcodedId, 'statements'), {
      topicId: topicAIJobsHardcodedId, content: "Replacing people with AI erodes dignity. Work isn't just economic — it's part of identity and community. We risk widespread social displacement.", createdBy: testUserId, createdAt: Timestamp.now(), position: "against" as const, aiConfidence: 0.88, lastEditedAt: Timestamp.now(),
    });

    // For Eating Meat Topic
    await addDoc(collection(db, 'topics', topicEatingMeatHardcodedId, 'statements'), {
      topicId: topicEatingMeatHardcodedId, content: "We’ve evolved to eat meat; it's a natural part of the human diet. Ethical farming and emerging lab-grown alternatives mitigate most concerns about animal welfare and environmental impact.", createdBy: testUserId, createdAt: Timestamp.now(), position: "for" as const, aiConfidence: 0.79, lastEditedAt: Timestamp.now(),
    });
    const statementMeatAgainstData = {
      topicId: topicEatingMeatHardcodedId, content: "With viable plant-based and cultivated meat alternatives increasingly available, the continued large-scale suffering of sentient animals for food is no longer ethically justifiable.", createdBy: testUserId, createdAt: Timestamp.now(), position: "against" as const, aiConfidence: 0.95, lastEditedAt: Timestamp.now(),
    };
    const statementMeatAgainstRef = await addDoc(collection(db, 'topics', topicEatingMeatHardcodedId, 'statements'), statementMeatAgainstData);
    statementMeatAgainstOldIdDyn = statementMeatAgainstRef.id;

    // For Social Censorship Topic
    const statementSocialForData = {
      topicId: topicSocialCensorshipHardcodedId, content: "Unchecked misinformation can destabilize democracies and endanger public health. Social media platforms have a moral and ethical responsibility to actively curate and censor harmful content.", createdBy: testUserId, createdAt: Timestamp.now(), position: "for" as const, aiConfidence: 0.85, lastEditedAt: Timestamp.now(),
    };
    const statementSocialForRef = await addDoc(collection(db, 'topics', topicSocialCensorshipHardcodedId, 'statements'), statementSocialForData);
    statementSocialForOldIdDyn = statementSocialForRef.id;
    await addDoc(collection(db, 'topics', topicSocialCensorshipHardcodedId, 'statements'), {
      topicId: topicSocialCensorshipHardcodedId, content: "Censorship, even with good intentions, is a slippery slope and more dangerous in the long run than falsehoods. The public should be empowered to discern truth, not have it dictated by platforms.", createdBy: testUserId, createdAt: Timestamp.now(), position: "against" as const, aiConfidence: 0.91, lastEditedAt: Timestamp.now(),
    });
    console.log('✅ Statements seeded sequentially with dynamic IDs (oldSeedTestData).');


    // Seed questions using createThreadNode with dynamic statement IDs
    console.log('⏳ Seeding questions via createThreadNode (oldSeedTestData)...');
    await createThreadNode({
      topicId: topicTikTokHardcodedId, statementId: statement1IdTikTokDyn, statementAuthorId: testUserId,
      parentId: null, content: "What about similar practices by U.S. platforms?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicAIJobsHardcodedId, statementId: statementAIJobsForIdDyn, statementAuthorId: testUserId,
      parentId: null, content: "Do you have examples where AI improved job satisfaction overall, rather than just company profits?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicEatingMeatHardcodedId, statementId: statementMeatAgainstOldIdDyn, statementAuthorId: testUserId,
      parentId: null, content: "What about cultures that rely on livestock for survival and have done so sustainably for centuries? Is a global moratorium on meat ethical for them?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicSocialCensorshipHardcodedId, statementId: statementSocialForOldIdDyn, statementAuthorId: testUserId,
      parentId: null, content: "How do we define 'misinformation' and 'harmful content' consistently and without inherent political or ideological bias, especially at a global scale?", createdBy: testUserId, type: 'question'
    });
    console.log('✅ Questions seeded via createThreadNode (oldSeedTestData).');
    
    return { success: true, message: '✅ Sample data including new topics successfully written to Firestore (oldSeedTestData).' };
  } catch (error) {
    console.error('Error writing sample data (oldSeedTestData):', error);
    let errorMessage = 'An unknown error occurred during seeding (oldSeedTestData).';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `❌ Error writing sample data: ${errorMessage} (oldSeedTestData)` };
  }
}

export async function seedMultiTopicTestData(): Promise<{ success: boolean; message: string }> {
  try {
    const topicsCollectionRef = collection(db, 'topics');
    const topicsSnapshot = await getDocs(topicsCollectionRef);
    
    const requiredTopicHardcodedIds = ['topic_ai_regulation', 'topic_remote_work', 'topic_crypto_banking', 'topic_meat_ban'];
    const existingTopicIdsFromDB = topicsSnapshot.docs.map(doc => doc.id);
    const allNewTopicsExist = requiredTopicHardcodedIds.every(id => existingTopicIdsFromDB.includes(id));

    if (allNewTopicsExist && !topicsSnapshot.empty) {
      console.log('✅ Firestore already contains the new multi-topic dataset. Auto-seeding skipped.');
      return { success: true, message: 'Firestore already contains the new multi-topic dataset. Auto-seeding skipped.' };
    }
    console.log('ℹ️ Not all required topics found or topics collection was empty. Proceeding with multi-topic data seed.');

    const batch = writeBatch(db);
    const testUserId = 'user_test'; 

    const userRef = doc(db, 'users', testUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      const userTestData: UserProfile = {
        uid: testUserId,
        fullName: "Test User Prime", 
        email: "test@example.com",
        kycVerified: true,
        createdAt: Timestamp.now().toDate().toISOString()
      };
      batch.set(userRef, userTestData);
    }

    // Topics Data
    const topicsToSeed = [
      { id: 'topic_ai_regulation', title: "Should AI be regulated globally?", description: "A critical examination of the need for international AI governance to mitigate risks while fostering innovation.", slug: 'should-ai-be-regulated-globally' },
      { id: 'topic_remote_work', title: "Is remote work here to stay?", description: "Exploring the long-term viability and societal impact of remote work post-pandemic, balancing flexibility with productivity.", slug: 'is-remote-work-here-to-stay' },
      { id: 'topic_crypto_banking', title: "Should cryptocurrencies replace traditional banking?", description: "A deep dive into whether decentralized cryptocurrencies offer a viable, secure, and equitable alternative to the established traditional banking system.", slug: 'should-crypto-replace-banking' },
      { id: 'topic_meat_ban', title: "Should meat consumption be banned to fight climate change?", description: "Assessing the controversial proposal of banning meat consumption as a drastic measure to combat climate change, versus promoting sustainable alternatives.", slug: 'should-meat-consumption-be-banned' },
    ];

    for (const topic of topicsToSeed) {
      if (!existingTopicIdsFromDB.includes(topic.id)) {
        const topicRef = doc(db, 'topics', topic.id);
        batch.set(topicRef, {
          title: topic.title,
          description: topic.description,
          createdBy: testUserId,
          createdAt: Timestamp.now(),
          scoreFor: 0, scoreAgainst: 0, scoreNeutral: 0, // Scores start at 0
          slug: topic.slug
        });
      }
    }
    
    console.log('⏳ Committing multi-topic test data batch (users, topics)...');
    await batch.commit();
    console.log('✅ Multi-topic test data batch committed (users, topics).');

    // Statements and Questions Data (to be created sequentially after topics)
    const statementsAndQuestions = [
      { // AI Regulation
        topicId: 'topic_ai_regulation',
        statements: [
          { content: "Without unified regulation, AI development will spiral out of ethical control. We need robust, globally-coordinated guardrails immediately to prevent dystopian outcomes and ensure AI serves humanity, not the other way around. The potential for misuse in autonomous weaponry alone demands a global consensus.", position: "for" as const, aiConfidence: 0.88, question: "How would such global enforcement realistically work across diverse sovereign nations with competing interests and varying technological capacities?" },
          { content: "Global AI regulation? Seriously? That just sounds like a one-way ticket to bureaucratic hell, strangling the very innovation we need. Let the market and developers figure it out; heavy-handed global rules will only benefit lumbering giants and crush startups.", position: "against" as const, aiConfidence: 0.91 }
        ]
      },
      { // Remote Work
        topicId: 'topic_remote_work',
        statements: [
          { content: "Remote work unequivocally empowers employees by offering unparalleled flexibility, significantly reduces commuter emissions aiding our planet, and fosters a demonstrably better work-life balance. The data from numerous studies supports this shift as a net positive for both individuals and organizations.", position: "for" as const, aiConfidence: 0.93, question: "While individual benefits are clear, what about the potential for a 'hybrid-halftime' scenario where companies mandate some office days, effectively diluting the full advantages of remote work?" },
          { content: "This whole remote work thing is just killing office culture! We're losing that spark, that random chat by the water cooler that leads to genius. Humans thrive on connection, real, face-to-face connection, not just staring at screens in lonely rooms. It's just not the same.", position: "against" as const, aiConfidence: 0.85 }
        ]
      },
      { // Crypto Banking
        topicId: 'topic_crypto_banking',
        statements: [
          { content: "Damn right crypto should replace banks! They've been rigging the game for centuries, printing money outta thin air and screwing the little guy. Crypto gives power back to the people, where it belongs. It's our only shot at financial freedom from these dinosaurs.", position: "for" as const, aiConfidence: 0.78, question: "Considering the current regulatory vacuum and the technical literacy required, what specific, actionable safeguards would need to be universally adopted for crypto to function reliably and protect consumers at a global scale?" },
          { content: "The assertion that cryptocurrencies are prepared to supplant traditional banking systems is demonstrably flawed. The inherent volatility, pervasive instances of fraud, and a stark lack of robust consumer protection mechanisms render them currently unfit for such a critical societal role. A pragmatic analysis reveals significant systemic risks.", position: "against" as const, aiConfidence: 0.94 }
        ]
      },
      { // Meat Ban
        topicId: 'topic_meat_ban',
        statements: [
          { content: "The science is undeniable: raising livestock is a monumental contributor to greenhouse gas emissions and deforestation. For the sake of our planet's future, it is imperative that we evolve our diets and transition away from meat consumption. It's not just a choice, it's a responsibility.", position: "for" as const, aiConfidence: 0.90, question: "Instead of an outright ban, which could face immense cultural and economic resistance, couldn't we achieve similar environmental benefits by heavily promoting and subsidizing plant-based diets and sustainable agriculture, making them more accessible and appealing?" },
          { content: "Ban meat? That's just another example of out-of-touch elites trying to impose their worldview on everyone else. My culture, my traditions, they're built around meat. Not everyone can, or frankly wants to, go vegan. This isn't about climate, it's about control and disrespecting heritage.", position: "against" as const, aiConfidence: 0.87 }
        ]
      }
    ];

    console.log('⏳ Seeding statements and questions sequentially for multi-topic data...');
    for (const topicData of statementsAndQuestions) {
      for (const stmt of topicData.statements) {
        const statementData = {
          topicId: topicData.topicId,
          content: stmt.content,
          createdBy: testUserId,
          createdAt: Timestamp.now(), // Using Timestamp.now() as per existing structure
          position: stmt.position,
          aiConfidence: stmt.aiConfidence,
          lastEditedAt: Timestamp.now()
        };
        const statementRef = await addDoc(collection(db, 'topics', topicData.topicId, 'statements'), statementData);
        const dynamicStatementId = statementRef.id;
        console.log(`📝 Statement created with ID: ${dynamicStatementId} for topic ${topicData.topicId}`);

        if (stmt.question) {
          await createThreadNode({
            topicId: topicData.topicId,
            statementId: dynamicStatementId, // Use the dynamic ID here
            statementAuthorId: testUserId, 
            parentId: null,
            content: stmt.question,
            createdBy: testUserId,
            type: 'question'
          });
          console.log(`❓ Question seeded for statement ID: ${dynamicStatementId}`);
        }
      }
    }
    console.log('✅ Statements and questions for multi-topic data seeded sequentially.');
    
    return { success: true, message: '✅ New multi-topic sample data successfully written/verified in Firestore.' };

  } catch (error) {
    console.error('Error writing multi-topic sample data:', error);
    let errorMessage = 'An unknown error occurred during multi-topic seeding.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `❌ Error writing multi-topic sample data: ${errorMessage}` };
  }
}