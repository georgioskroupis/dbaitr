#!/usr/bin/env node
/*
  Simple AI runner that prepends our system prompt and maintains session files.
  Usage:
    node scripts/ai/codex-run.mjs --session <name> --reset -p <template.md> "prompt..."
*/
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SESS_DIR = path.join(ROOT, '.ai', 'sessions');
const SYS_PROMPT_PATH = path.join(ROOT, 'docs', 'ai', 'system-prompt.md');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function parseArgs(argv) {
  const args = { session: 'default', reset: false, template: null, prompt: null };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session') { args.session = argv[++i] || 'default'; }
    else if (a === '--reset') { args.reset = true; }
    else if (a === '-p' || a === '--template') { args.template = argv[++i] || null; }
    else { rest.push(a); }
  }
  args.prompt = rest.join(' ').trim();
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function loadSession(name) {
  ensureDir(SESS_DIR);
  const file = path.join(SESS_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return { file, messages: [] };
  try { return { file, messages: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {
    return { file, messages: [] };
  }
}

function saveSession(file, messages) {
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
}

async function main() {
  const args = parseArgs(process.argv);
  const sys = readFileSafe(SYS_PROMPT_PATH);
  if (!sys) {
    console.error('System prompt not found at', SYS_PROMPT_PATH);
    process.exit(2);
  }

  const tpl = args.template ? readFileSafe(path.isAbsolute(args.template) ? args.template : path.join(ROOT, args.template)) : '';
  const input = args.prompt || tpl || readFileSafe(0);
  if (!input) {
    console.error('No prompt provided. Use -p <template.md> or pass a prompt.');
    process.exit(2);
  }

  const { file, messages } = loadSession(args.session);
  if (args.reset) messages.length = 0;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const DRY_RUN = !OPENAI_API_KEY;

  const runMessages = [
    { role: 'system', content: sys },
    ...messages,
    { role: 'user', content: input },
  ];

  if (DRY_RUN) {
    console.log('[AI Runner] DRY RUN (OPENAI_API_KEY missing). Messages not sent.');
    console.log('--- System Prompt ---\n' + sys.split('\n').slice(0, 20).join('\n') + '\n...');
    console.log('--- Prompt ---\n' + input);
    return;
  }

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: runMessages,
    temperature: 0.2,
  };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('OpenAI API error:', res.status, await res.text());
      process.exit(3);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() || '';
    console.log(text);
    messages.push({ role: 'user', content: input }, { role: 'assistant', content: text });
    saveSession(file, messages);
  } catch (err) {
    console.error('AI Runner exception:', err?.message || err);
    process.exit(3);
  }
}

main();

