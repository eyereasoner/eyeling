import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const quiet =
  process.argv.includes('--quiet') ||
  // npm sets this when running with --json (handy extra safety)
  process.env.npm_config_json === 'true';

function run(cmd) {
  // When quiet, suppress stdout so "npm pack --json" output stays valid JSON.
  execSync(cmd, { stdio: quiet ? ['inherit', 'ignore', 'inherit'] : 'inherit' });
}

// 1) Compile TS (as scripts) into build/*.js
run('tsc -p tsconfig.json');

// 2) Concatenate into a single browser/worker-friendly bundle at ./eyeling.js
//    (demo.html expects this exact filename)
const parts = [
  path.join('build', 'eyeling-core.js'),
  path.join('build', 'eyeling-n3.js'),
  path.join('build', 'eyeling-buitins.js'),
  path.join('build', 'eyeling-engine.js'),
  path.join('build', 'eyeling-api.js'),
];

const out = ['#!/usr/bin/env node\n'];
for (const p of parts) {
  out.push(fs.readFileSync(p, 'utf8'));
  if (!out[out.length - 1].endsWith('\n')) out.push('\n');
}

fs.writeFileSync('eyeling.js', out.join(''), 'utf8');

// Make executable on POSIX (best effort)
try {
  fs.chmodSync('eyeling.js', 0o755);
} catch {}

if (!quiet) console.log('Built ./eyeling.js');
