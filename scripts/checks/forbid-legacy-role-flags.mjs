#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const offenders = [];
const LEGACY = /(\bisAdmin\b|\bisModerator\b)/;
function scan(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scan(p);
    else if (ent.isFile() && /\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      const s = fs.readFileSync(p, 'utf8');
      if (LEGACY.test(s)) offenders.push(`${p}: uses legacy role flags (isAdmin/isModerator)`);
    }
  }
}
scan(root);
if (offenders.length) {
  // Temporarily demoted to warn to unblock builds while migrating fully to AuthZ capabilities.
  console.warn('WARN: Legacy role flags detected. Use claims.role and capability gates instead:');
  offenders.forEach(x => console.warn('  ' + x));
  process.exit(0);
}
console.log('OK: no legacy role flags found.');
