#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredPaths = [
  'apps/mobile/package.json',
  'apps/mobile/.env.example',
  'apps/mobile/app/auth.tsx',
  'apps/mobile/app/index.tsx',
  'apps/mobile/app/verify.tsx',
  'apps/mobile/src/auth/AuthProvider.tsx',
  'apps/mobile/src/http/apiFetch.ts',
  'apps/mobile/src/firebase/native.ts',
  'packages/shared/package.json',
  'packages/shared/src/index.ts',
  'packages/shared/src/auth.ts',
  'packages/shared/src/idv.ts',
  'docs/mobile-architecture.md',
  'docs/mobile-auth-appcheck.md',
];

const missing = requiredPaths.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length > 0) {
  console.error('Monorepo foundation check failed. Missing files:');
  for (const rel of missing) console.error(` - ${rel}`);
  process.exit(1);
}

const sharedPkgPath = path.join(root, 'packages/shared/package.json');
const sharedPkg = JSON.parse(fs.readFileSync(sharedPkgPath, 'utf8'));
if (sharedPkg.name !== '@dbaitr/shared') {
  console.error('Monorepo foundation check failed: packages/shared/package.json name must be @dbaitr/shared');
  process.exit(1);
}

const mobilePkgPath = path.join(root, 'apps/mobile/package.json');
const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'));
if (mobilePkg.name !== '@dbaitr/mobile') {
  console.error('Monorepo foundation check failed: apps/mobile/package.json name must be @dbaitr/mobile');
  process.exit(1);
}

const deps = mobilePkg.dependencies || {};
if (deps['@dbaitr/shared'] !== 'file:../../packages/shared') {
  console.error('Monorepo foundation check failed: mobile app must consume @dbaitr/shared via local file dependency');
  process.exit(1);
}
if (!deps.expo || !deps['expo-router'] || !deps['react-native']) {
  console.error('Monorepo foundation check failed: mobile package must declare expo, expo-router, and react-native');
  process.exit(1);
}
if (!deps['@react-native-firebase/app'] || !deps['@react-native-firebase/auth'] || !deps['@react-native-firebase/app-check']) {
  console.error('Monorepo foundation check failed: mobile package must declare @react-native-firebase/app, /auth, and /app-check');
  process.exit(1);
}

const appJsonPath = path.join(root, 'apps/mobile/app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
if (String(appJson?.expo?.scheme || '') !== 'dbaitr') {
  console.error('Monorepo foundation check failed: apps/mobile/app.json must define expo.scheme as \"dbaitr\"');
  process.exit(1);
}

console.log('OK: monorepo foundation check passed.');
