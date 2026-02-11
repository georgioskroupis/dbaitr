# **App Name**: ArguMate

## Core Features:

- KYC User Authentication: User authentication using Firebase Authentication. Includes flow for ID verification via upload to Firebase Storage, to ensure only verified users can participate in debates.
- AI Debate Topic Search: AI-powered semantic search to prevent duplicate debate topics using embeddings. Functioning as a tool to check similarity, and guiding the user towards creating novel topics.
- AI Topic Analysis: AI-generated neutral analysis displayed prominently on the topic page, providing a brief overview of the debate.
- AI Position Tally: AI classification of user posts as either "For" or "Against" the topic, with a live tally of positions to visualize opinion.
- Structured Debate Flow: Structured conversation flow with one main statement per user, and a single question-and-answer flow to maintain focus and clarity.

## Style Guidelines:

- Deep black or graphite background for an elegant dark theme.
- Soft red tones for accents, providing a visually striking contrast without being harsh on the eyes.
- Light gray/off-white text for readability against the dark background.
- Responsive and accessible design for optimal viewing and interaction across devices.
- Subtle animations for a polished user experience.
- Accent: Soft, muted red (#B33A3A) to highlight interactive elements without causing eye strain.
Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- App Check + Auth enforced on protected endpoints
- Server-only writes in privileged collections
- Build pipeline gated by lint + rules tests
Acceptance: Blueprint reflects current defaults
