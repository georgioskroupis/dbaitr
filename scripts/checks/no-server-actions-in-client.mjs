#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
let violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.isFile() && /\.(tsx?|mjs|cjs|js)$/.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8');
      const isClient = /"use client"|'use client'/.test(text.split('\n', 3).join('\n'));
      if (isClient) {
        if (/@\/app\/actions\//.test(text)) violations.push(`${p}: client imports server action`);
        if (/firebase-admin/.test(text)) violations.push(`${p}: client imports firebase-admin`);
      }
    }
  }
}

if (fs.existsSync(SRC)) walk(SRC);

if (violations.length) {
  console.error('Boundary check failed:\n' + violations.map(v => ` - ${v}`).join('\n'));
  process.exit(1);
} else {
  console.log('Boundary check passed.');
}

