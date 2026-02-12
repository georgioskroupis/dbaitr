#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relPath) {
  const abs = path.join(root, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function must(relPath, pattern, message) {
  const src = read(relPath);
  if (!pattern.test(src)) failures.push(`${relPath}: ${message}`);
}

function mustNot(relPath, pattern, message) {
  const src = read(relPath);
  if (pattern.test(src)) failures.push(`${relPath}: ${message}`);
}

// IDV: challenge endpoint issues one-time server-tracked challenges only.
must('src/app/api/idv/challenge/route.ts', /requireStatus\(\['Grace',\s*'Verified'\]\)/, 'challenge endpoint must be status-gated');
must('src/app/api/idv/challenge/route.ts', /challengeHash/, 'challenge endpoint must persist hashed challenge only');
must('src/app/api/idv/challenge/route.ts', /collection\('challenges'\)/, 'challenge endpoint must write challenge records server-side');

// IDV: /verify is the only approval authority and must stay proof-based (no image uploads).
must('src/app/api/idv/verify/route.ts', /await\s+req\.json\s*\(/, 'verify endpoint must accept JSON proof payloads');
mustNot('src/app/api/idv/verify/route.ts', /await\s+req\.formData\s*\(/, 'verify endpoint must not accept uploaded image captures');
must('src/app/api/idv/verify/route.ts', /verifySelfProof\s*\(/, 'verify endpoint must call provider proof verification');
must('src/app/api/idv/verify/route.ts', /hashNullifierForDedup\s*\(/, 'verify endpoint must hash nullifier for dedup');
must('src/app/api/idv/verify/route.ts', /await\s+setClaims\s*\(\s*uid\s*,\s*\{\s*status:\s*'Verified'\s*,\s*kycVerified:\s*true\s*\}\s*\)/s, 'verify endpoint must set verified claims only on server-approved flow');
must('src/app/api/idv/verify/route.ts', /duplicate_identity/, 'verify endpoint must reject dedup collisions');
mustNot('src/app/api/idv/verify/route.ts', /db\.collection\('idv_latest'\)/, 'must not persist idv_latest artifacts');
mustNot('src/app/api/idv/verify/route.ts', /db\.collection\('idv_attempts'\)/, 'must not persist idv_attempts artifacts');
mustNot('src/app/api/idv/verify/route.ts', /nullifier\s*:/, 'must not persist raw nullifier payloads');
mustNot('src/app/api/idv/verify/route.ts', /idv_verified\s*:\s*true/, 'must not persist legacy idv flags');

// IDV: /result is read-only status and must not elevate users.
must('src/app/api/idv/result/route.ts', /approved\s*=\s*!!ctx\?\.kycVerified/, 'result endpoint must mirror claims-based approval state');
mustNot('src/app/api/idv/result/route.ts', /setClaims\s*\(/, 'result endpoint must not set custom claims');
mustNot('src/app/api/idv/result/route.ts', /kycVerified\s*:\s*true/, 'result endpoint must not elevate KYC state');

// Profile bootstrap: fullName required and claims defaults must be server-owned.
must('src/app/api/users/bootstrap/route.ts', /error:\s*'full_name_required'/, 'must reject profile bootstrap without full name');
must('src/app/api/users/bootstrap/route.ts', /await\s+setClaims\s*\(/, 'must establish claims defaults server-side');

// Moderation reports: reporter identity must be auth-derived.
must('src/app/api/moderation/report/route.ts', /const\s+reporterUid\s*=\s*\(ctx\?\.uid\s+as\s+string\)\s*\|\|\s*null/, 'must derive reporter uid from auth context');
must('src/app/api/moderation/report/route.ts', /reporterId:\s*reporterUid/, 'must store auth-derived reporter uid');
mustNot('src/app/api/moderation/report/route.ts', /const\s*\{[^}]*reporterId[^}]*\}\s*=\s*body/s, 'must not accept reporterId from request body');

// Admin user actions: security-relevant actions must update claims.
must('src/app/api/admin/users/action/[uid]/route.ts', /claimUpdates\.status\s*=\s*'Suspended'/, 'suspend must update claims status');
must('src/app/api/admin/users/action/[uid]/route.ts', /claimUpdates\.status\s*=\s*'Banned'/, 'ban must update claims status');
must('src/app/api/admin/users/action/[uid]/route.ts', /claimUpdates\.status\s*=\s*cur\.kycVerified\s*\?\s*'Verified'\s*:\s*'Grace'/, 'reinstate must update claims status');
must('src/app/api/admin/users/action/[uid]/route.ts', /claimUpdates\.role\s*=\s*targetRole\s+as\s+Role/, 'changeRole must update claims role');
must('src/app/api/admin/users/action/[uid]/route.ts', /claimUpdates\.kycVerified\s*=\s*kyc/, 'kycOverride must update claims kycVerified');
must('src/app/api/admin/users/action/[uid]/route.ts', /await\s+setClaims\s*\(\s*uid\s*,\s*claimUpdates\s*\)/, 'must apply claim updates after actions');

// Diagnostics ingest routes: admin-only + explicit feature flag.
for (const relPath of [
  'src/app/api/live/[id]/ingest/route.ts',
  'src/app/api/live/[id]/ingest/ping/route.ts',
  'src/app/api/live/[id]/ingest/bare/route.ts',
  'src/app/api/live/[id]/ingest/min/route.ts',
  'src/app/api/live/[id]/ingest/import-test/route.ts',
]) {
  must(relPath, /INGEST_DIAGNOSTICS_ENABLED\s*===\s*'1'/, 'must require explicit diagnostics feature flag');
}
mustNot('src/app/api/live/[id]/ingest/route.ts', /INGEST_TEST_WIRE/, 'must not allow unauthenticated test wire bypasses');
must('src/app/api/live/[id]/ingest/ping/route.ts', /requireRole\('admin'\)/, 'must require admin role');
must('src/app/api/live/[id]/ingest/bare/route.ts', /requireRole\('admin'\)/, 'must require admin role');
must('src/app/api/live/[id]/ingest/min/route.ts', /requireRole\('admin'\)/, 'must require admin role');
must('src/app/api/live/[id]/ingest/import-test/route.ts', /requireRole\('admin'\)/, 'must require admin role');

if (failures.length > 0) {
  console.error('Security regression guard failures:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('OK: security regression guards passed.');
