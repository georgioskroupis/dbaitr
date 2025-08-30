#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const offenders = [];
function scan(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scan(p);
    else if (ent.isFile() && /\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      const s = fs.readFileSync(p, 'utf8');
      if (p.includes(path.join('src','lib','firebase','client.ts')) || p.includes(path.join('src','lib','firebase','admin.ts'))) continue;
      if (s.match(/from\s+['\"]firebase\/app['\"]/)) offenders.push(`${p}: imports firebase/app directly`);
      if (s.match(/from\s+['\"]firebase-admin(\/|['\"]).*/)) offenders.push(`${p}: imports firebase-admin directly`);
    }
  }
}
scan(root);
if (offenders.length) {
  console.error('Duplicate Firebase initialization detected. Import only from src/lib/firebase/client or src/lib/firebase/admin:');
  offenders.forEach(x => console.error('  ' + x));
  process.exit(1);
}
console.log('OK: no duplicate Firebase init imports found.');
