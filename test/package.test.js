#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function info(msg) {
  console.log(`${C.y}==${C.n} ${msg}`);
}
function ok(msg) {
  console.log(`${C.g}OK${C.n}  ${msg}`);
}
function fail(msg) {
  console.error(`${C.r}FAIL${C.n} ${msg}`);
}

function isWin() {
  return process.platform === 'win32';
}
function npmCmd() {
  return isWin() ? 'npm.cmd' : 'npm';
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function run(cmd, args, opts = {}) {
  const res = cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
    ...opts,
  });
  return res;
}

function runChecked(cmd, args, opts = {}) {
  // Print the command in a dim style
  console.log(`${C.dim}$ ${cmd} ${args.join(' ')}${C.n}`);
  const res = run(cmd, args, opts);
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const err = new Error(`Command failed (${cmd} ${args.join(' ')}), exit ${res.status}`);
    err.code = res.status;
    err.stdout = res.stdout;
    err.stderr = res.stderr;
    throw err;
  }
  return res;
}

function normalizeNewlines(s) {
  return String(s).replace(/\r\n/g, '\n');
}

// Expectation logic (shared with test/examples.test.js):
// 1) If file contains:  # expect-exit: N  -> use N
// 2) Else, if it contains "=> false" -> expect exit 2
// 3) Else -> expect exit 0
function expectedExitCode(n3Text) {
  const m = n3Text.match(/^[ \t]*#[: ]*expect-exit:[ \t]*([0-9]+)\b/m);
  if (m) return parseInt(m[1], 10);
  if (/=>\s*false\b/.test(n3Text)) return 2;
  return 0;
}

function hasGit() {
  const r = run('git', ['--version']);
  return r.status === 0;
}

function showDiff(expectedPath, generatedPath) {
  try {
    if (hasGit()) {
      const d = run('git', ['diff', '--no-index', expectedPath, generatedPath]);
      if (d.stdout) process.stdout.write(d.stdout);
      if (d.stderr) process.stderr.write(d.stderr);
      return;
    }
  } catch {}
  try {
    const d = run('diff', ['-u', expectedPath, generatedPath]);
    if (d.stdout) process.stdout.write(d.stdout);
    if (d.stderr) process.stderr.write(d.stderr);
    return;
  } catch {}
  // Last resort: print a small excerpt
  try {
    const exp = fs.readFileSync(expectedPath, 'utf8').split(/\r?\n/).slice(0, 40).join('\n');
    const gen = fs.readFileSync(generatedPath, 'utf8').split(/\r?\n/).slice(0, 40).join('\n');
    console.error('\n--- expected (first 40 lines)\n' + exp);
    console.error('\n--- generated (first 40 lines)\n' + gen);
  } catch {}
}

function packTarball(root) {
  // `npm pack --silent` prints the filename (usually one line)
  const res = runChecked(npmCmd(), ['pack', '--silent'], { cwd: root });
  const out = String(res.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (out.length === 0) throw new Error('npm pack produced no output');
  return out[out.length - 1].trim(); // tarball filename in root
}

function main() {
  const suiteStart = Date.now();
  const root = path.resolve(__dirname, '..');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-smoke-'));
  const cleanup = () => rmrf(tmp);

  let tgzInRoot = null;

  try {
    info('Building tarball (npm pack)');
    tgzInRoot = packTarball(root);
    const srcTgz = path.join(root, tgzInRoot);
    const dstTgz = path.join(tmp, tgzInRoot);

    fs.renameSync(srcTgz, dstTgz);

    info('Creating temp project + installing tarball');
    runChecked(npmCmd(), ['init', '-y'], { cwd: tmp, stdio: 'ignore' });
    runChecked(npmCmd(), ['install', `./${tgzInRoot}`, '--no-audit', '--no-fund'], { cwd: tmp, stdio: 'inherit' });

    info('API smoke test');
    // Run a tiny API check via node -e
    const apiCode = `
      const { reason } = require('eyeling');
      const input = \`
{ <http://example.org/s> <http://example.org/p> <http://example.org/o>. }
  => { <http://example.org/s> <http://example.org/q> <http://example.org/o>. }.

<http://example.org/s> <http://example.org/p> <http://example.org/o>.
\`;
      const out = reason({ proofComments: false }, input);
      const re = /<http:\\/\\/example\\.org\\/s>\\s+<http:\\/\\/example\\.org\\/q>\\s+<http:\\/\\/example\\.org\\/o>\\s*\\./;
      if (!re.test(out)) {
        console.error('Unexpected output:\\n' + out);
        process.exit(1);
      }
      console.log('OK: API works');
    `;
    runChecked(process.execPath, ['-e', apiCode], { cwd: tmp, stdio: 'inherit' });
    ok('API works');

    info('CLI smoke test');
    const bin = isWin()
      ? path.join(tmp, 'node_modules', '.bin', 'eyeling.cmd')
      : path.join(tmp, 'node_modules', '.bin', 'eyeling');
    runChecked(bin, ['-v'], { cwd: tmp, stdio: 'inherit' });
    ok('CLI works');


info('Examples smoke test (installed package)');
const pkgRoot = path.join(tmp, 'node_modules', 'eyeling');
const examplesDir = path.join(pkgRoot, 'examples');
const outputDir = path.join(examplesDir, 'output');
const eyelingJsPath = path.join(pkgRoot, 'eyeling.js');

if (!fs.existsSync(examplesDir)) throw new Error(`Missing examples directory in installed package: ${examplesDir}`);
if (!fs.existsSync(outputDir)) throw new Error(`Missing examples/output directory in installed package: ${outputDir}`);
if (!fs.existsSync(eyelingJsPath)) throw new Error(`Missing eyeling.js in installed package: ${eyelingJsPath}`);

// Keep this fast: package.test.js is a smoke test. The full matrix is covered by test/examples.test.js in-repo.
const SMOKE_EXAMPLES = [
  'age.n3',
  'basic-monadic.n3',
  'collection.n3',
  'family-cousins.n3',
  'backward.n3',
];

const tmpExamplesOut = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-pkg-examples-'));
let smokeIdx = 1;
const smokePad2 = (n) => String(n).padStart(2, '0');
const smokeOk = (n, msg) => console.log(`${C.g}OK${C.n}  ${smokePad2(n)} ${msg}`);
try {
  for (const file of SMOKE_EXAMPLES) {
    const inputPath = path.join(examplesDir, file);
    const expectedPath = path.join(outputDir, file);

    if (!fs.existsSync(inputPath)) throw new Error(`Missing example in installed package: ${inputPath}`);
    if (!fs.existsSync(expectedPath)) throw new Error(`Missing golden output in installed package: ${expectedPath}`);

    const n3Text = fs.readFileSync(inputPath, 'utf8');
    const expectedRc = expectedExitCode(n3Text);

    const r = cp.spawnSync(process.execPath, [eyelingJsPath, '-d', file], {
      cwd: examplesDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 200 * 1024 * 1024,
      encoding: 'utf8',
    });

    const rc = r.status == null ? 1 : r.status;
    if (rc !== expectedRc) {
      const stderr = (r.stderr || '').trim();
      throw new Error(`Example ${file}: exit ${rc}, expected ${expectedRc}${stderr ? `
${stderr}` : ''}`);
    }

    // Normalize newlines so this is stable across platforms.
    const got = normalizeNewlines(r.stdout || '');
    const exp = normalizeNewlines(fs.readFileSync(expectedPath, 'utf8'));

    if (got !== exp) {
      const genPath = path.join(tmpExamplesOut, file);
      fs.writeFileSync(genPath, got, 'utf8');
      console.error(`
Output differs for ${file}:`);
      showDiff(expectedPath, genPath);
      throw new Error(`Example ${file}: output differs from golden`);
    }

    smokeOk(smokeIdx++, `Example smoke: ${file}`);
  }
} finally {
  rmrf(tmpExamplesOut);
}
smokeOk(smokeIdx++, 'Installed examples smoke test passed');

    const suiteMs = Date.now() - suiteStart;
    console.log('');
    ok(`Packaged install smoke test passed ${C.dim}(${suiteMs} ms, ${(suiteMs / 1000).toFixed(2)} s)${C.n}`);
    process.exit(0);
  } catch (e) {
    console.log('');
    fail(e && e.stack ? e.stack : String(e));
    process.exit(1);
  } finally {
    // If rename failed and the tarball still exists in root, try to delete it
    if (tgzInRoot) {
      const maybe = path.join(root, tgzInRoot);
      if (fs.existsSync(maybe)) {
        try {
          fs.unlinkSync(maybe);
        } catch {}
      }
    }
    cleanup();
  }
}

main();
