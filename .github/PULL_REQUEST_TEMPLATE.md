### Summary

Describe the change and why it’s needed.

### Checklist

- [ ] Build passes locally: `npm ci && npm run typecheck && npm run build`
- [ ] No client component imports server actions or `firebase-admin` (boundary check passes)
- [ ] Client calls server via API routes (e.g., `/api/search/suggest`), not server actions
- [ ] TypeScript types updated; no obvious `any` where avoidable
- [ ] Logging via `src/lib/logger.ts` (no scattered `console.log`)
- [ ] Firebase rules/indexes updated if data paths changed; docs updated
- [ ] `.env.example` updated if new env vars introduced
- [ ] System prompt invariants respected (see `docs/ai/system-prompt.md`)

### Testing / Verification

Include steps, screenshots, or notes to verify changes.

