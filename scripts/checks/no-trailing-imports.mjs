#!/usr/bin/env node
/*
  Guard against accidental import statements appended at end-of-file.
  This catches patch artifacts like:
    ...
    }
    import { apiFetch } from '@/lib/http/client';
*/
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const offenders = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!ent.isFile() || !/\.(ts|tsx|js|jsx)$/.test(ent.name)) continue;

    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    let lastIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = lines[i].trim();
      if (!s) continue;
      if (s.startsWith('//')) continue;
      lastIdx = i;
      break;
    }
    if (lastIdx < 0) continue;
    const lastLine = lines[lastIdx].trim();
    if (/^import\s.+from\s+['"].+['"];?$/.test(lastLine)) {
      offenders.push(`${p}:${lastIdx + 1}: trailing import declaration`);
    }
  }
}

walk(root);

if (offenders.length) {
  console.error('Found trailing import declarations (move imports to the top of file):');
  offenders.forEach((o) => console.error(`  ${o}`));
  process.exit(1);
}

console.log('OK: no trailing import declarations.');
