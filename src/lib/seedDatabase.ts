'use server';

import { db } from '@/lib/firebase/config';
import type { UserProfile, Topic, Statement, Question, ThreadNode } from '@/types'; // Added ThreadNode
import { doc, Timestamp, writeBatch, collection, getDocs, getDoc } from 'firebase/firestore';
import { createThreadNode } from './firestoreActions'; // Import createThreadNode

// This function seeds a specific set of test data as requested for a "strict Firestore write test".
// The old seedTestData function is kept for reference or potential future use but is no longer the primary export.
async function oldSeedTestData(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if topics collection already has data
    const topicsSnapshot = await getDocs(collection(db, 'topics'));
    // More specific check: if any of the *specific old topics* exist
    const oldTopicIds = ['topic_tiktok', 'topic_ai_jobs', 'topic_eating_meat', 'topic_social_censorship'];
    const existingOldTopicIds = topicsSnapshot.docs.map(doc => doc.id);
    const someOldTopicsExist = oldTopicIds.some(id => existingOldTopicIds.includes(id));


    if (someOldTopicsExist && !topicsSnapshot.empty) {
      console.log('⚠️ Firestore already contains some old topic data. Auto-seeding skipped (oldSeedTestData).');
      return { success: true, message: 'Firestore already contains some old topic data. Auto-seeding skipped (oldSeedTestData).' };
    }
    console.log('ℹ️ No existing old topics found. Proceeding with initial data seed (oldSeedTestData).');

    const batch = writeBatch(db);
    const testUserId = 'user_test_old_seed'; // Use a different user ID to avoid conflicts if both seeds run

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

    // STEP 2: Add TikTok topic manually
    const testTopicIdTikTok = 'topic_tiktok';
    const topicRefTikTok = doc(db, 'topics', testTopicIdTikTok);
    const topicTestDataTikTok: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
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
    
    const statement1IdTikTok = 'statement1_tiktok';
    const statement2IdTikTok = 'statement2_tiktok';
    // const question1IdTikTok = 'question1_tiktok'; // No longer used for direct doc ID

    const statement1RefTikTok = doc(db, 'topics', testTopicIdTikTok, 'statements', statement1IdTikTok);
    const statement1DataTikTok: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: testTopicIdTikTok,
      content: "TikTok enables foreign governments to subtly influence public opinion.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement1RefTikTok, statement1DataTikTok);

    const statement2RefTikTok = doc(db, 'topics', testTopicIdTikTok, 'statements', statement2IdTikTok);
    const statement2DataTikTok: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: testTopicIdTikTok,
      content: "Banning TikTok undermines digital freedom. Users should choose what apps to use.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.90,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statement2RefTikTok, statement2DataTikTok);

    // TOPIC 1: AI and Jobs
    const topicIdAIJobs = 'topic_ai_jobs';
    const statementAIJobsForId = 'stmt_ai_jobs_for';
    const statementAIJobsAgainstId = 'stmt_ai_jobs_against';
    // const questionAIJobsId = 'q_ai_jobs_1'; // No longer used

    const topicRefAIJobs = doc(db, 'topics', topicIdAIJobs);
    const topicDataAIJobs: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
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
    const statementAIJobsForData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdAIJobs,
      content: "Efficiency and consistency matter. AI in logistics and customer service has already proven its worth, streamlining operations and reducing errors.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.92,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementAIJobsForRef, statementAIJobsForData);

    const statementAIJobsAgainstRef = doc(db, 'topics', topicIdAIJobs, 'statements', statementAIJobsAgainstId);
    const statementAIJobsAgainstData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdAIJobs,
      content: "Replacing people with AI erodes dignity. Work isn't just economic — it's part of identity and community. We risk widespread social displacement.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.88,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementAIJobsAgainstRef, statementAIJobsAgainstData);

    // TOPIC 2: Eating Meat
    const topicIdEatingMeat = 'topic_eating_meat';
    const statementMeatForOldId = 'stmt_meat_for_old'; // Renamed to avoid collision if both seeds run
    const statementMeatAgainstOldId = 'stmt_meat_against_old'; // Renamed
    // const questionMeatId = 'q_meat_1'; // No longer used

    const topicRefEatingMeat = doc(db, 'topics', topicIdEatingMeat);
    const topicDataEatingMeat: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Is it ethical to eat meat in 2025 (Old Seed)?",
      description: "Debating the morality of meat consumption in an era of advanced food technology and heightened environmental awareness.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'is-it-ethical-to-eat-meat-2025-old'
    };
    batch.set(topicRefEatingMeat, topicDataEatingMeat);

    const statementMeatForRef = doc(db, 'topics', topicIdEatingMeat, 'statements', statementMeatForOldId);
    const statementMeatForData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdEatingMeat,
      content: "We’ve evolved to eat meat; it's a natural part of the human diet. Ethical farming and emerging lab-grown alternatives mitigate most concerns about animal welfare and environmental impact.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.79,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementMeatForRef, statementMeatForData);

    const statementMeatAgainstRef = doc(db, 'topics', topicIdEatingMeat, 'statements', statementMeatAgainstOldId);
    const statementMeatAgainstData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdEatingMeat,
      content: "With viable plant-based and cultivated meat alternatives increasingly available, the continued large-scale suffering of sentient animals for food is no longer ethically justifiable.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.95,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementMeatAgainstRef, statementMeatAgainstData);


    // TOPIC 3: Social Media Censorship
    const topicIdSocialCensorship = 'topic_social_censorship';
    const statementSocialForOldId = 'stmt_social_for_old'; // Renamed
    const statementSocialAgainstOldId = 'stmt_social_against_old'; // Renamed
    // const questionSocialId = 'q_social_1'; // No longer used

    const topicRefSocialCensorship = doc(db, 'topics', topicIdSocialCensorship);
    const topicDataSocialCensorship: Omit<Topic, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      title: "Should social media platforms censor misinformation (Old Seed)?",
      description: "Exploring the balance between free speech and the responsibility of platforms to curb the spread of harmful or false information.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-social-media-censor-misinformation-old'
    };
    batch.set(topicRefSocialCensorship, topicDataSocialCensorship);

    const statementSocialForRef = doc(db, 'topics', topicIdSocialCensorship, 'statements', statementSocialForOldId);
    const statementSocialForData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdSocialCensorship,
      content: "Unchecked misinformation can destabilize democracies and endanger public health. Social media platforms have a moral and ethical responsibility to actively curate and censor harmful content.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementSocialForRef, statementSocialForData);

    const statementSocialAgainstRef = doc(db, 'topics', topicIdSocialCensorship, 'statements', statementSocialAgainstOldId);
    const statementSocialAgainstData: Omit<Statement, 'id' | 'createdAt' | 'lastEditedAt'> & { createdAt: Timestamp, lastEditedAt: Timestamp } = {
      topicId: topicIdSocialCensorship,
      content: "Censorship, even with good intentions, is a slippery slope and more dangerous in the long run than falsehoods. The public should be empowered to discern truth, not have it dictated by platforms.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.91,
      lastEditedAt: Timestamp.now(),
    };
    batch.set(statementSocialAgainstRef, statementSocialAgainstData);

    console.log('⏳ Committing test data batch (oldSeedTestData for users, topics, statements)...');
    await batch.commit();
    console.log('✅ Test data batch committed (oldSeedTestData for users, topics, statements).');

    // Seed questions using createThreadNode
    console.log('⏳ Seeding questions via createThreadNode (oldSeedTestData)...');
    await createThreadNode({
      topicId: testTopicIdTikTok, statementId: statement1IdTikTok, statementAuthorId: testUserId,
      parentId: null, content: "What about similar practices by U.S. platforms?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicIdAIJobs, statementId: statementAIJobsForId, statementAuthorId: testUserId,
      parentId: null, content: "Do you have examples where AI improved job satisfaction overall, rather than just company profits?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicIdEatingMeat, statementId: statementMeatAgainstOldId, statementAuthorId: testUserId,
      parentId: null, content: "What about cultures that rely on livestock for survival and have done so sustainably for centuries? Is a global moratorium on meat ethical for them?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
      topicId: topicIdSocialCensorship, statementId: statementSocialForOldId, statementAuthorId: testUserId,
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
    
    const requiredTopicIds = ['topic_ai_regulation', 'topic_remote_work', 'topic_crypto_banking', 'topic_meat_ban'];
    const existingTopicIds = topicsSnapshot.docs.map(doc => doc.id);
    const allNewTopicsExist = requiredTopicIds.every(id => existingTopicIds.includes(id));

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

    // Topic 1: AI Regulation
    const topicAiRegId = 'topic_ai_regulation';
    const topicAiRegRef = doc(db, 'topics', topicAiRegId);
    batch.set(topicAiRegRef, {
      title: "Should AI be regulated globally?",
      description: "A critical examination of the need for international AI governance to mitigate risks while fostering innovation.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'should-ai-be-regulated-globally'
    });

    const stmtAiRegForId = 'stmt_aireg_for';
    const stmtAiRegAgainstId = 'stmt_aireg_against';
    // const qAiRegId = 'q_aireg_1'; // No longer used for direct doc ID

    batch.set(doc(db, 'topics', topicAiRegId, 'statements', stmtAiRegForId), {
      topicId: topicAiRegId,
      content: "Without unified regulation, AI development will spiral out of ethical control. We need robust, globally-coordinated guardrails immediately to prevent dystopian outcomes and ensure AI serves humanity, not the other way around. The potential for misuse in autonomous weaponry alone demands a global consensus.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.88,
      lastEditedAt: Timestamp.now()
    });
    batch.set(doc(db, 'topics', topicAiRegId, 'statements', stmtAiRegAgainstId), {
      topicId: topicAiRegId,
      content: "Global AI regulation? Seriously? That just sounds like a one-way ticket to bureaucratic hell, strangling the very innovation we need. Let the market and developers figure it out; heavy-handed global rules will only benefit lumbering giants and crush startups.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.91,
      lastEditedAt: Timestamp.now()
    });

    // Topic 2: Remote Work
    const topicRemoteWorkId = 'topic_remote_work';
    const topicRemoteWorkRef = doc(db, 'topics', topicRemoteWorkId);
    batch.set(topicRemoteWorkRef, {
      title: "Is remote work here to stay?",
      description: "Exploring the long-term viability and societal impact of remote work post-pandemic, balancing flexibility with productivity.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0,
      slug: 'is-remote-work-here-to-stay'
    });

    const stmtRemoteForId = 'stmt_remote_for';
    const stmtRemoteAgainstId = 'stmt_remote_against';
    // const qRemoteId = 'q_remote_1'; // No longer used

    batch.set(doc(db, 'topics', topicRemoteWorkId, 'statements', stmtRemoteForId), {
      topicId: topicRemoteWorkId,
      content: "Remote work unequivocally empowers employees by offering unparalleled flexibility, significantly reduces commuter emissions aiding our planet, and fosters a demonstrably better work-life balance. The data from numerous studies supports this shift as a net positive for both individuals and organizations.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.93,
      lastEditedAt: Timestamp.now()
    });
    batch.set(doc(db, 'topics', topicRemoteWorkId, 'statements', stmtRemoteAgainstId), {
      topicId: topicRemoteWorkId,
      content: "This whole remote work thing is just killing office culture! We're losing that spark, that random chat by the water cooler that leads to genius. Humans thrive on connection, real, face-to-face connection, not just staring at screens in lonely rooms. It's just not the same.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.85,
      lastEditedAt: Timestamp.now()
    });

    // Topic 3: Crypto vs Traditional Banking
    const topicCryptoId = 'topic_crypto_banking';
    const topicCryptoRef = doc(db, 'topics', topicCryptoId);
    batch.set(topicCryptoRef, {
      title: "Should cryptocurrencies replace traditional banking?",
      description: "A deep dive into whether decentralized cryptocurrencies offer a viable, secure, and equitable alternative to the established traditional banking system.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0, 
      slug: 'should-crypto-replace-banking'
    });

    const stmtCryptoForId = 'stmt_crypto_for';
    const stmtCryptoAgainstId = 'stmt_crypto_against';
    // const qCryptoId = 'q_crypto_1'; // No longer used

    batch.set(doc(db, 'topics', topicCryptoId, 'statements', stmtCryptoForId), {
      topicId: topicCryptoId,
      content: "Damn right crypto should replace banks! They've been rigging the game for centuries, printing money outta thin air and screwing the little guy. Crypto gives power back to the people, where it belongs. It's our only shot at financial freedom from these dinosaurs.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.78,
      lastEditedAt: Timestamp.now()
    });
    batch.set(doc(db, 'topics', topicCryptoId, 'statements', stmtCryptoAgainstId), {
      topicId: topicCryptoId,
      content: "The assertion that cryptocurrencies are prepared to supplant traditional banking systems is demonstrably flawed. The inherent volatility, pervasive instances of fraud, and a stark lack of robust consumer protection mechanisms render them currently unfit for such a critical societal role. A pragmatic analysis reveals significant systemic risks.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.94,
      lastEditedAt: Timestamp.now()
    });

    // Topic 4: Meat Consumption Ban
    const topicMeatBanId = 'topic_meat_ban';
    const topicMeatBanRef = doc(db, 'topics', topicMeatBanId);
    batch.set(topicMeatBanRef, {
      title: "Should meat consumption be banned to fight climate change?",
      description: "Assessing the controversial proposal of banning meat consumption as a drastic measure to combat climate change, versus promoting sustainable alternatives.",
      createdBy: testUserId,
      createdAt: Timestamp.now(),
      scoreFor: 1,
      scoreAgainst: 1,
      scoreNeutral: 0, 
      slug: 'should-meat-consumption-be-banned'
    });

    const stmtMeatForBanId = 'stmt_meat_for_ban';
    const stmtMeatAgainstBanId = 'stmt_meat_against_ban';
    // const qMeatId = 'q_meat_ban_1'; // No longer used

    batch.set(doc(db, 'topics', topicMeatBanId, 'statements', stmtMeatForBanId), {
      topicId: topicMeatBanId,
      content: "The science is undeniable: raising livestock is a monumental contributor to greenhouse gas emissions and deforestation. For the sake of our planet's future, it is imperative that we evolve our diets and transition away from meat consumption. It's not just a choice, it's a responsibility.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "for",
      aiConfidence: 0.90,
      lastEditedAt: Timestamp.now()
    });
    batch.set(doc(db, 'topics', topicMeatBanId, 'statements', stmtMeatAgainstBanId), {
      topicId: topicMeatBanId,
      content: "Ban meat? That's just another example of out-of-touch elites trying to impose their worldview on everyone else. My culture, my traditions, they're built around meat. Not everyone can, or frankly wants to, go vegan. This isn't about climate, it's about control and disrespecting heritage.",
      createdBy: testUserId, // Statement author
      createdAt: Timestamp.now(),
      position: "against",
      aiConfidence: 0.87,
      lastEditedAt: Timestamp.now()
    });
    
    console.log('⏳ Committing multi-topic test data batch (users, topics, statements)...');
    await batch.commit();
    console.log('✅ Multi-topic test data batch committed (users, topics, statements).');

    // Seed questions using createThreadNode
    console.log('⏳ Seeding questions for multi-topic data via createThreadNode...');
    await createThreadNode({
        topicId: topicAiRegId, statementId: stmtAiRegForId, statementAuthorId: testUserId,
        parentId: null, content: "How would such global enforcement realistically work across diverse sovereign nations with competing interests and varying technological capacities?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
        topicId: topicRemoteWorkId, statementId: stmtRemoteForId, statementAuthorId: testUserId,
        parentId: null, content: "While individual benefits are clear, what about the potential for a 'hybrid-halftime' scenario where companies mandate some office days, effectively diluting the full advantages of remote work?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
        topicId: topicCryptoId, statementId: stmtCryptoForId, statementAuthorId: testUserId,
        parentId: null, content: "Considering the current regulatory vacuum and the technical literacy required, what specific, actionable safeguards would need to be universally adopted for crypto to function reliably and protect consumers at a global scale?", createdBy: testUserId, type: 'question'
    });
    await createThreadNode({
        topicId: topicMeatBanId, statementId: stmtMeatForBanId, statementAuthorId: testUserId,
        parentId: null, content: "Instead of an outright ban, which could face immense cultural and economic resistance, couldn't we achieve similar environmental benefits by heavily promoting and subsidizing plant-based diets and sustainable agriculture, making them more accessible and appealing?", createdBy: testUserId, type: 'question'
    });
    console.log('✅ Questions for multi-topic data seeded via createThreadNode.');
    
    return { success: true, message: '✅ New multi-topic sample data successfully written to Firestore.' };

  } catch (error) {
    console.error('Error writing multi-topic sample data:', error);
    let errorMessage = 'An unknown error occurred during multi-topic seeding.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `❌ Error writing multi-topic sample data: ${errorMessage}` };
  }
}
