#!/usr/bin/env node
/*
  Fails if code references per-user YouTube token storage.
  Allowed path is only _private/youtubeTokens/global/host.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetDir = path.join(root, 'src');

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && /\.(ts|tsx|js|mjs)$/.test(e.name)) yield p;
  }
}

const offenders = [];
for (const file of walk(targetDir)) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes("youtubeTokens').collection('byUser'") || text.includes('youtubeTokens"').collection && text.includes("byUser")) {
    offenders.push(file);
    continue;
  }
  if (/youtubeTokens\s*\/byUser\//.test(text)) {
    offenders.push(file);
  }
}

if (offenders.length) {
  console.error('\nPer-user YouTube token references found (forbidden):');
  for (const f of offenders) console.error(' -', path.relative(root, f));
  process.exit(1);
}
console.log('OK: no per-user YouTube token references.');

