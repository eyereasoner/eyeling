import { build } from 'esbuild';
import { chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// When npm is run with --json (packlist test), stdout must remain valid JSON.
const QUIET = process.env.npm_config_json === 'true';

await build({
  entryPoints: [path.join(root, 'src/eyeling.ts')],
  bundle: true,

  // UMD-ish single file: runs in browser/worker (no CommonJS wrapper) AND in Node.
  // In Node, src/eyeling.ts sets module.exports when available.
  format: 'iife',
  // IMPORTANT: don't set platform="node".
  // That lets esbuild constant-fold `typeof module !== 'undefined'` to true,
  // which breaks browser/worker builds with `ReferenceError: module is not defined`.
  platform: 'neutral',
  target: ['es2020'],

  // Keep Node builtins as runtime requires so the bundle still works in Node,
  // but doesn't try to resolve/polyfill them for the browser.
  external: [
    'fs', 'child_process', 'crypto', 'http', 'https', 'url',
    'node:fs', 'node:child_process', 'node:crypto', 'node:http', 'node:https', 'node:url',
  ],

  outfile: path.join(root, 'eyeling.js'),
  banner: { js: '#!/usr/bin/env node\n' },

  logLevel: QUIET ? 'silent' : 'info',
});

chmodSync(path.join(root, 'eyeling.js'), 0o755);
if (!QUIET) console.error('Built eyeling.js');
