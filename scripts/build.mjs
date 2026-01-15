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

  // UMD-ish single file: runs in browser (no CommonJS wrapper) AND in Node.
  // In Node, src/eyeling.ts sets module.exports when available.
  format: 'iife',
  platform: 'node',
  target: ['node18'],

  outfile: path.join(root, 'eyeling.js'),
  banner: { js: '#!/usr/bin/env node\n' },

  logLevel: QUIET ? 'silent' : 'info',
});

chmodSync(path.join(root, 'eyeling.js'), 0o755);
if (!QUIET) console.error('Built eyeling.js');
