{% include '../system-prompt.md' %}

Task: Perform a deep, hands-on code review for the current branch/PR.

Focus
- Follow the repo system prompt invariants.
- Verify boundaries (no client→server action imports, no firebase-admin in client).
- Confirm TypeScript types, logging via logger, and utils/hooks patterns.
- Ensure API routes serve client needs and are properly typed.
- Check Firebase init, rules, indexes, and env usage.

Checklist
- Build: typecheck, lint (if configured), build must pass.
- Boundaries: client imports, server-only modules.
- DX: `.env.example` updated if env use changed.
- Security: rules match data paths; no secrets in code.
- Docs: update README or deploy docs if behavior changed.

Acceptance Criteria
- Provide a succinct findings list and required changes.
- If changes are needed, produce minimal diffs.
- Confirm final build passes.

