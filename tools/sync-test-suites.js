#!/usr/bin/env node
'use strict';

// Refresh the local conformance mirrors from upstream:
//
//   test/notation3tests/tests/  from https://codeberg.org/phochste/notation3tests
//   test/w3c_rdf/rdf-tests/     from https://w3c.github.io/rdf-tests/ (RDF 1.2 syntax)
//
// The tests only read these mirrors, so an upstream change reaches the suite
// as a reviewable commit instead of failing an unrelated run.

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { MIRROR, SUITES, mirrorPath } = require('../test/rdf12.test.js');

const ROOT = path.resolve(__dirname, '..');
const N3_REPO = 'https://codeberg.org/phochste/notation3tests.git';
const N3_TESTS = path.join(ROOT, 'test', 'notation3tests', 'tests');

function replaceDir(target, source) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function syncNotation3tests() {
  console.log('Syncing notation3tests from Codeberg...');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-notation3tests-'));
  try {
    cp.execFileSync('git', ['clone', '--depth', '1', '--quiet', N3_REPO, work], { stdio: 'inherit' });
    replaceDir(N3_TESTS, path.join(work, 'tests'));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function fetchText(url) {
  const res = await globalThis.fetch(url); // Node 18+
  if (!res.ok) throw new Error(`Could not fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

// Fetch each manifest and every file its tests name into a fresh tree, then
// swap it in, so files upstream dropped do not linger.
async function syncW3cRdf() {
  console.log('Refreshing W3C RDF 1.2 syntax manifests from GitHub...');
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-rdf-tests-'));
  try {
    const target = (url) => path.join(fresh, path.relative(MIRROR, mirrorPath(url)));
    for (const suite of Object.values(SUITES)) {
      const manifest = await fetchText(suite.manifest);
      const urls = new Set([suite.manifest]);
      for (const m of manifest.matchAll(/mf:(?:action|result|include)\s+<([^>]+)>/g)) {
        urls.add(new URL(m[1], suite.manifest).href);
      }
      for (const url of urls) {
        const file = target(url);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, url === suite.manifest ? manifest : await fetchText(url));
      }
      console.log(`  ${suite.label}: ${urls.size} files`);
    }
    replaceDir(MIRROR, fresh);
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
}

(async () => {
  syncNotation3tests();
  await syncW3cRdf();
  console.log('Test suites are up to date.');
})().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});
