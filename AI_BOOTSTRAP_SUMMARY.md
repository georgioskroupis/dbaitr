# AI Bootstrap Summary

## Files Created/Modified
- docs/ai/system-prompt.md
- docs/ai/templates/{code-review.md, refactor.md, feature.md}
- scripts/ai/codex-run.mjs (AI runner)
- scripts/checks/no-server-actions-in-client.mjs (boundary check)
- package.json scripts: ai, ai:review, ai:refactor, check:boundaries
- .github/workflows/ci.yml (advisory AI review + boundary checks)
- .github/PULL_REQUEST_TEMPLATE.md
- CONTRIBUTING.md
- .vscode/{extensions.json, settings.json}
- README-DEPLOY.md (AI assistant section)

## Running the AI Runner
- Ad-hoc: `npm run ai -- "Your prompt here"`
- Templates: `npm run ai:review` or `npm run ai:refactor`
- Sessions are stored under `.ai/sessions/<name>.json`. Reset with `--session <name> --reset`.
- Requires `OPENAI_API_KEY` for real calls; otherwise dry-run prints composed prompts.

## New CI/Husky Behavior
- CI now runs boundary checks (`npm run check:boundaries`).
- CI runs advisory AI review and uploads `AI_REVIEW.txt` as an artifact (dry-run if no key).
- Pre-commit hooks (optional) can be added to run `npm run typecheck` and boundary checks.

## Verify
1) Install: `npm ci`
2) Lint (if configured): `npm run lint || true`
3) Typecheck: `npm run typecheck`
4) Build: `npm run build`

If you have `OPENAI_API_KEY` locally:
- `npm run ai -- "Summarize our system prompt in 5 bullets."`
- `npm run ai:review`

Outputs can be saved under `.ai/examples/` as needed.

