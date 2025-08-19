# Seeding Data

Run the seeder to populate Firestore with demo data.

- Command: `npm run dev:seed`

## Credentials Resolution
The script initializes Firebase Admin using the following order:
- `FIREBASE_SERVICE_ACCOUNT`: Inline JSON in `.env.local`.
- Fallback file: `.secrets/serviceAccount.json` (not committed).

Both forms should represent the same Service Account JSON. If using the env var, ensure the `private_key` contains escaped newlines (`\n`).

### Example `.env.local`
```
# Full JSON string on one line. Note the escaped newlines in private_key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"YOUR_PROJECT","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}
```

### Using the file instead
- Place your Service Account JSON at: `.secrets/serviceAccount.json`.
- No changes to `.env.local` are required if the file exists.

### Converting a file to an env var
If you prefer the env var, you can turn the file into a compact JSON string with escaped newlines:
```
# macOS/Linux
jq -c . < ./.secrets/serviceAccount.json
```
Copy the output into `FIREBASE_SERVICE_ACCOUNT=` in `.env.local`.

## Troubleshooting
- Error: `Unterminated string in JSON` — Your env var likely contains raw newlines in `private_key`. Fix by escaping to `\n`, use the `jq -c` step above, or remove the env var and rely on `.secrets/serviceAccount.json`.
- Error: `FIREBASE_SERVICE_ACCOUNT not configured` — Ensure either the env var is present and valid JSON, or the fallback file exists.

## Notes
- The seeder uses Firebase Admin SDK v12 (ESM): `firebase-admin/app` and `firebase-admin/firestore`.
- `.secrets/` is intended for local-only secrets; ensure it is ignored by Git.
