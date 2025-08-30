#!/usr/bin/env node
// Flags client-side fetch('/api/...') usage not going through apiFetch.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const offenders = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip server api routes
      if (p.includes(path.join('src','app','api'))) continue;
      walk(p);
    } else if (ent.isFile() && /\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      const s = fs.readFileSync(p, 'utf8');
      // Consider client files only
      if (!s.includes('"use client"') && !s.includes("'use client'")) continue;
      const lines = s.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes('fetch(') && line.includes('/api/')) {
          if (!line.includes('apiFetch(')) {
            offenders.push(`${p}:${i+1}:${line.trim()}`);
          }
        }
      });
    }
  }
}
walk(root);
if (offenders.length) {
  console.error('Found client fetch calls to /api/ without apiFetch (App Check header likely missing):');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('OK: all client /api calls use apiFetch.');

