
'use server';

import { db } from '@/lib/firebase/config';
import type { UserProfile, Topic, Statement, Question } from '@/types';
import { collection, doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

const userIds = {
  alice: 'seed_user_alice',
  bob: 'seed_user_bob',
  charlie: 'seed_user_charlie',
};

const topicIds = {
  remoteWork: 'seed_topic_remote_work',
  aiArt: 'seed_topic_ai_art',
  marsColonization: 'seed_topic_mars_colonization',
};

const statementIds = {
  remote_s1: 'seed_stmt_remote_01',
  remote_s2: 'seed_stmt_remote_02',
  aiArt_s1: 'seed_stmt_aiart_01',
  aiArt_s2: 'seed_stmt_aiart_02',
  mars_s1: 'seed_stmt_mars_01',
  mars_s2: 'seed_stmt_mars_02',
};

const questionIds = {
  remote_q1: 'seed_q_remote_01',
  aiArt_q1: 'seed_q_aiart_01',
  mars_q1: 'seed_q_mars_01',
};

export async function seedDatabase(): Promise<{ success: boolean; message: string }> {
  const batch = writeBatch(db);

  try {
    // 1. Create Users
    const usersData: UserProfile[] = [
      {
        uid: userIds.alice,
        fullName: 'Alice Wonderland',
        email: 'alice@example.com',
        kycVerified: true,
        photoURL: `https://picsum.photos/seed/${userIds.alice}/200`,
        createdAt: Timestamp.now(),
      },
      {
        uid: userIds.bob,
        fullName: 'Bob The Builder',
        email: 'bob@example.com',
        kycVerified: true,
        photoURL: `https://picsum.photos/seed/${userIds.bob}/200`,
        createdAt: Timestamp.now(),
      },
      {
        uid: userIds.charlie,
        fullName: 'Charlie Brown',
        email: 'charlie@example.com',
        kycVerified: true,
        photoURL: `https://picsum.photos/seed/${userIds.charlie}/200`,
        createdAt: Timestamp.now(),
      },
    ];

    usersData.forEach((user) => {
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, user);
    });

    // 2. Create Topics
    const topicsData: Topic[] = [
      {
        id: topicIds.remoteWork,
        title: 'The Future of Remote Work: A Permanent Shift or Passing Trend?',
        description:
          "The COVID-19 pandemic dramatically accelerated the adoption of remote work. This topic explores whether this shift is a permanent evolution in how we work, or if traditional office environments will make a significant comeback. Considerations include productivity, work-life balance, company culture, and technological infrastructure.",
        createdBy: userIds.alice,
        createdAt: Timestamp.now(),
        scoreFor: 1,
        scoreAgainst: 1,
        scoreNeutral: 0,
        slug: 'future-of-remote-work-permanent-shift-passing-trend',
      },
      {
        id: topicIds.aiArt,
        title: 'The Ethics of AI in Creative Arts: Innovation or Imitation?',
        description:
          "AI-powered tools are increasingly capable of generating sophisticated art, music, and literature. This debate delves into the ethical implications: Is AI a tool for human artists, a co-creator, or a replacement? We'll discuss originality, copyright, the value of human creativity, and the potential impact on creative industries.",
        createdBy: userIds.bob,
        createdAt: Timestamp.now(),
        scoreFor: 1,
        scoreAgainst: 1,
        scoreNeutral: 0,
        slug: 'ethics-of-ai-in-creative-arts-innovation-or-imitation',
      },
      {
        id: topicIds.marsColonization,
        title: 'Mars Colonization: A Necessary Step for Humanity or a Misguided Priority?',
        description:
          "The ambition to establish human colonies on Mars captures the imagination, promising a new frontier for exploration and a safeguard for humanity's future. However, it also raises questions about immense costs, technological challenges, ethical considerations of planetary protection, and whether resources should be prioritized for solving Earth's pressing problems.",
        createdBy: userIds.charlie,
        createdAt: Timestamp.now(),
        scoreFor: 1,
        scoreAgainst: 1,
        scoreNeutral: 0,
        slug: 'mars-colonization-necessary-step-misguided-priority',
      },
    ];

    topicsData.forEach((topic) => {
      const topicRef = doc(db, 'topics', topic.id);
      batch.set(topicRef, topic);
    });

    // 3. Create Statements
    const statementsData: Statement[] = [
      // Statements for Remote Work Topic
      {
        id: statementIds.remote_s1,
        topicId: topicIds.remoteWork,
        content:
          "Remote work is undeniably the future. It offers unparalleled flexibility, slashes commute times, and broadens talent pools for companies. The productivity gains from focused, uninterrupted work at home are substantial, and employees consistently report better work-life integration. Resistance to this shift often stems from outdated management philosophies rather than objective concerns.",
        createdBy: userIds.bob,
        createdAt: Timestamp.now(),
        position: 'for',
        aiConfidence: 0.92,
      },
      {
        id: statementIds.remote_s2,
        topicId: topicIds.remoteWork,
        content:
          "While remote work has its benefits, a complete shift away from the office is detrimental. Spontaneous collaboration, mentorship for junior staff, and the development of a strong company culture are severely hampered. Hybrid models might offer a compromise, but the value of in-person interaction for innovation and team cohesion cannot be fully replicated remotely.",
        createdBy: userIds.charlie,
        createdAt: Timestamp.now(),
        position: 'against',
        aiConfidence: 0.88,
      },
      // Statements for AI Art Topic
      {
        id: statementIds.aiArt_s1,
        topicId: topicIds.aiArt,
        content:
          "AI in art is an empowering evolution, not a threat. These tools democratize creation, allowing individuals without traditional artistic skills to bring their visions to life. The human element remains crucial in prompting, curating, and refining AI outputs. It's a new medium, much like photography was once viewed with suspicion by painters.",
        createdBy: userIds.charlie,
        createdAt: Timestamp.now(),
        position: 'for',
        aiConfidence: 0.95,
      },
      {
        id: statementIds.aiArt_s2,
        topicId: topicIds.aiArt,
        content:
          "The rise of AI-generated art raises serious concerns about originality and the devaluation of human skill. If art can be produced en masse by algorithms trained on existing human works, what becomes of the artist's unique voice and the laborious process of creation? We risk a future of derivative, soulless content.",
        createdBy: userIds.alice,
        createdAt: Timestamp.now(),
        position: 'against',
        aiConfidence: 0.90,
      },
      // Statements for Mars Colonization Topic
      {
        id: statementIds.mars_s1,
        topicId: topicIds.marsColonization,
        content:
          "Colonizing Mars is an imperative for the long-term survival and progress of humanity. It acts as a vital insurance policy against terrestrial catastrophes and will drive technological innovation at an unprecedented scale, benefiting life on Earth in the process. The spirit of exploration is fundamental to our nature.",
        createdBy: userIds.alice,
        createdAt: Timestamp.now(),
        position: 'for',
        aiConfidence: 0.85,
      },
      {
        id: statementIds.mars_s2,
        topicId: topicIds.marsColonization,
        content:
          "The astronomical cost and resources required for Mars colonization are unjustifiable when Earth faces so many critical challenges like climate change, poverty, and disease. Our priority must be to safeguard and improve our home planet before embarking on such an ambitious and speculative extraterrestrial venture. It's an escapist fantasy for the privileged.",
        createdBy: userIds.bob,
        createdAt: Timestamp.now(),
        position: 'against',
        aiConfidence: 0.91,
      },
    ];

    statementsData.forEach((statement) => {
      const statementRef = doc(db, 'topics', statement.topicId, 'statements', statement.id);
      batch.set(statementRef, statement);
    });

    // 4. Create Questions
    const questionsData: Question[] = [
      {
        id: questionIds.remote_q1,
        topicId: topicIds.remoteWork,
        statementId: statementIds.remote_s1, // Question for Bob's "for" statement on remote work
        content:
          "You mention broadened talent pools. How do companies effectively manage and integrate a globally distributed workforce to ensure fair opportunities and avoid creating a two-tier system between remote and in-office employees?",
        askedBy: userIds.alice,
        createdAt: Timestamp.now(),
        answered: false,
      },
      {
        id: questionIds.aiArt_q1,
        topicId: topicIds.aiArt,
        statementId: statementIds.aiArt_s2, // Question for Alice's "against" statement on AI art
        content:
          "If an AI model is trained exclusively on public domain art or with explicit consent from artists for their work to be included in training data, would that mitigate some of your ethical concerns regarding originality and devaluation?",
        askedBy: userIds.bob,
        createdAt: Timestamp.now(),
        answered: false,
      },
      {
        id: questionIds.mars_q1,
        topicId: topicIds.marsColonization,
        statementId: statementIds.mars_s1, // Question for Alice's "for" statement on Mars
        content:
          "Considering the extreme radiation, low gravity, and psychological challenges of long-duration space travel and habitat, what are the most critical technological breakthroughs still needed before a self-sustaining Mars colony becomes a realistic possibility, not just an outpost?",
        askedBy: userIds.charlie,
        createdAt: Timestamp.now(),
        answered: false,
      },
    ];

    questionsData.forEach((question) => {
      const questionRef = doc(db, 'topics', question.topicId, 'statements', question.statementId, 'questions', question.id);
      batch.set(questionRef, question);
    });

    await batch.commit();
    console.log('Database seeded successfully!');
    return { success: true, message: 'Database seeded successfully!' };
  } catch (error) {
    console.error('Error seeding database:', error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: `Error seeding database: ${errorMessage}` };
  }
}
