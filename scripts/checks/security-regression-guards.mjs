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

// IDV: /result must not elevate users or mutate claims.
must('src/app/api/idv/result/route.ts', /source:\s*'client_ack'/, 'must persist client ack audit records');
must('src/app/api/idv/result/route.ts', /approved:\s*!!latest\?\.approved/, 'must mirror only server-stored latest decision');
mustNot('src/app/api/idv/result/route.ts', /setClaims\s*\(/, 'must not set custom claims');
mustNot('src/app/api/idv/result/route.ts', /kycVerified\s*:\s*true/, 'must not elevate KYC state');
mustNot('src/app/api/idv/result/route.ts', /idv_verified\s*:\s*true/, 'must not mark idv_verified directly');
mustNot('src/app/api/idv/result/route.ts', /status\s*:\s*['"]verified['"]/i, 'must not force verified status');

// IDV: /verify is the only approval authority.
must('src/app/api/idv/verify/route.ts', /await\s+req\.formData\s*\(/, 'must use uploaded artifacts for server verification');
must('src/app/api/idv/verify/route.ts', /await\s+setClaims\s*\(\s*uid\s*,\s*\{\s*status:\s*'Verified'\s*,\s*kycVerified:\s*true\s*\}\s*\)/s, 'must set verified claims only on server-approved flow');
must('src/app/api/idv/verify/route.ts', /db\.collection\('idv_latest'\)\.doc\(uid\)\.set\(/, 'must persist latest server decision');
must('src/app/api/idv/verify/route.ts', /db\.collection\('idv_attempts'\)\.doc\(\)/, 'must create idv attempt docs');
must('src/app/api/idv/verify/route.ts', /await\s+attemptRef\.set\(/, 'must persist decision attempts');
mustNot('src/app/api/idv/verify/route.ts', /const\s*\{[^}]*approved[^}]*\}\s*=\s*await\s+req\.json\s*\(/s, 'must not trust client-posted approved flags');

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
