#!/usr/bin/env node
// SafeLab workflow build: workflows/src/*.json -> workflows/dist/*.json (importable into n8n).
//
//   node build.mjs [--sheet-id <GOOGLE_SHEET_ID>] [--lib <path to safelab.js>]
//
// - Every Code-node line "/*@@SAFELAB_LIB@@*/" is replaced with the full contents of lib/safelab.js.
// - "__SAFELAB_SHEET_ID__" is replaced with --sheet-id or env SAFELAB_SHEET_ID (kept + warning if absent).
// - Each output is validated: JSON with nodes + connections, unique node names, every connection
//   pointing at an existing node, no leftover library marker.
// No dependencies (Node >= 18).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'workflows', 'src');
const DIST = path.join(HERE, 'workflows', 'dist');
const LIB_MARKER = '/*@@SAFELAB_LIB@@*/';
const SHEET_PLACEHOLDER = '__SAFELAB_SHEET_ID__';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [key, inline] = a.startsWith('--') ? a.slice(2).split(/=(.*)/s, 2) : [null];
    if (key === 'sheet-id' || key === 'lib') {
      const value = inline !== undefined ? inline : argv[++i];
      if (!value) fail(`--${key} needs a value`);
      args[key] = value;
    } else if (key === 'help' || a === '-h') {
      console.log('usage: node build.mjs [--sheet-id <ID>] [--lib <path/to/safelab.js>]');
      process.exit(0);
    } else {
      fail(`unknown argument: ${a}`);
    }
  }
  return args;
}

function fail(msg) {
  console.error(`build: ERROR ${msg}`);
  process.exit(1);
}

// Apply fn to every string inside a JSON value.
function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}

function injectLib(workflow, lib) {
  let count = 0;
  for (const node of workflow.nodes) {
    const code = node.parameters && node.parameters.jsCode;
    if (node.type !== 'n8n-nodes-base.code' || typeof code !== 'string') continue;
    node.parameters.jsCode = code
      .split('\n')
      .map((line) => {
        if (line.trim() !== LIB_MARKER) return line;
        count++;
        return lib;
      })
      .join('\n');
  }
  return count;
}

function validate(file, text) {
  const errors = [];
  let wf;
  try {
    wf = JSON.parse(text);
  } catch (e) {
    return [`not valid JSON: ${e.message}`];
  }
  if (!wf || typeof wf !== 'object') return ['not a JSON object'];
  if (typeof wf.name !== 'string' || !wf.name) errors.push('missing workflow name');
  if (!Array.isArray(wf.nodes) || !wf.nodes.length) errors.push('missing nodes[]');
  if (!wf.connections || typeof wf.connections !== 'object' || Array.isArray(wf.connections)) {
    errors.push('missing connections{}');
  }
  if (errors.length) return errors;

  const names = new Set();
  for (const n of wf.nodes) {
    if (!n.name || !n.type) errors.push(`node without name/type: ${JSON.stringify(n).slice(0, 80)}`);
    else if (names.has(n.name)) errors.push(`duplicate node name "${n.name}"`);
    names.add(n.name);
    if (typeof n.parameters?.jsCode === 'string' && n.parameters.jsCode.includes(LIB_MARKER)) {
      errors.push(`node "${n.name}": library marker not replaced`);
    }
  }
  for (const [from, byType] of Object.entries(wf.connections)) {
    if (!names.has(from)) errors.push(`connection from unknown node "${from}"`);
    for (const outputs of Object.values(byType || {})) {
      for (const targets of outputs || []) {
        for (const t of targets || []) {
          if (!names.has(t.node)) errors.push(`connection "${from}" -> unknown node "${t.node}"`);
        }
      }
    }
  }
  return errors;
}

const args = parseArgs(process.argv.slice(2));
const libPath = path.resolve(args.lib || path.join(HERE, 'lib', 'safelab.js'));
if (!fs.existsSync(libPath)) fail(`library not found: ${libPath}`);
const lib = fs.readFileSync(libPath, 'utf8').replace(/\r\n/g, '\n').trimEnd();
if (!/\bconst SafeLab\b/.test(lib)) fail(`${libPath} does not define "const SafeLab"`);

const sheetId = (args['sheet-id'] || process.env.SAFELAB_SHEET_ID || '').trim();
if (sheetId && !/^[A-Za-z0-9_-]+$/.test(sheetId)) fail(`invalid sheet id "${sheetId}" (expected letters, digits, - and _)`);
if (!sheetId) {
  console.warn(`build: WARNING no --sheet-id / SAFELAB_SHEET_ID given; "${SHEET_PLACEHOLDER}" is kept in dist ` +
    '(set the spreadsheet in each Google Sheets node after import, or rebuild with the id).');
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).sort();
if (!files.length) fail(`no workflow sources in ${SRC}`);
fs.mkdirSync(DIST, { recursive: true });
// Remove outputs whose source no longer exists, so dist/ can be imported as a folder.
for (const f of fs.readdirSync(DIST)) {
  if (f.endsWith('.json') && !files.includes(f)) fs.unlinkSync(path.join(DIST, f));
}

let failed = false;
for (const file of files) {
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  } catch (e) {
    console.error(`build: ${file}: source is not valid JSON: ${e.message}`);
    failed = true;
    continue;
  }
  if (sheetId) wf = mapStrings(wf, (s) => s.split(SHEET_PLACEHOLDER).join(sheetId));
  const injected = Array.isArray(wf.nodes) ? injectLib(wf, lib) : 0;
  const out = JSON.stringify(wf, null, 2) + '\n';
  const errors = validate(file, out);
  if (errors.length) {
    errors.forEach((e) => console.error(`build: ${file}: ${e}`));
    failed = true;
    continue;
  }
  fs.writeFileSync(path.join(DIST, file), out);
  console.log(`build: ${file} -> dist/${file} (${wf.nodes.length} nodes, library injected into ${injected} Code node(s))`);
}
if (failed) fail('one or more workflows failed validation');
console.log(`build: OK ${files.length} workflow(s) written to ${path.relative(process.cwd(), DIST) || DIST}`);
