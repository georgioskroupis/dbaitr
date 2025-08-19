{% include '../system-prompt.md' %}

Task: Refactor the target module(s) to improve structure and maintain behavior.

Focus
- Preserve behavior and public APIs.
- Maintain Next.js and Firebase boundaries (no client→server action imports).
- Keep utils TS-only and JSX helpers separated.
- Maintain logging via `logger` and TypeScript strictness.

Checklist
- Update imports to extensionless utils where needed.
- Ensure API route contracts remain stable.
- Add or adjust types; remove any obvious `any`.
- Update docs/tests minimally if behavior or paths change.

Acceptance Criteria
- Minimal patch; build/typecheck pass.
- No boundary violations introduced.
- Docs/scripts kept in sync.

