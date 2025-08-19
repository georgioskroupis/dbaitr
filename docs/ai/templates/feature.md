{% include '../system-prompt.md' %}

Task: Implement a new feature end-to-end.

Process
- Specify: brief spec and acceptance criteria.
- Design: API surfaces, components, data model impacts (rules/indexes if needed).
- Implement: smallest changes first; keep code consistent with repo patterns.
- Verify: typecheck/build; add tests if infra exists; update docs.

Repo-Specific Checklists
- Boundaries: client uses API routes; no server actions in client.
- Firebase: if data paths or access patterns change, update rules/indexes and docs.
- Types/Logging: strict types; use `logger`.
- DX: update `.env.example` if new env required.

Acceptance Criteria
- Feature works per spec; build passes.
- No boundary violations or secrets in code.
- Docs updated (README/README-DEPLOY or feature docs) and minimal tests if applicable.

