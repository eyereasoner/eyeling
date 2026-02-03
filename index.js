'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

/**
 * Synchronously run Eyeling on an N3 input string (spawns the CLI).
 * Writes input to a temp file, returns stdout, forwards stderr, and throws on non-zero exit.
 *
 * opt may be { args, proofComments/noProofComments, maxBuffer } or an args array.
 */
function reason(opt = {}, n3_input = '') {
  if (n3_input == null) n3_input = '';
  if (typeof n3_input !== 'string') {
    throw new TypeError('reason(opt, n3_input): n3_input must be a string');
  }

  // allow passing an args array directly
  if (Array.isArray(opt)) opt = { args: opt };
  if (opt == null || typeof opt !== 'object') opt = {};

  const args = [];

  // default: proof comments OFF for API output (machine-friendly)
  // set { proofComments: true } to keep them
  const proofCommentsSpecified = typeof opt.proofComments === 'boolean' || typeof opt.noProofComments === 'boolean';

  const proofComments =
    typeof opt.proofComments === 'boolean'
      ? opt.proofComments
      : typeof opt.noProofComments === 'boolean'
        ? !opt.noProofComments
        : false;

  // Only pass a flag when the caller explicitly asked.
  // (CLI default is now: no proof comments.)
  if (proofCommentsSpecified) {
    if (proofComments) args.push('--proof-comments');
    else args.push('--no-proof-comments');
  }

  if (Array.isArray(opt.args)) args.push(...opt.args);

  const maxBuffer = Number.isFinite(opt.maxBuffer) ? opt.maxBuffer : 50 * 1024 * 1024;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-'));
  const inputFile = path.join(dir, 'input.n3');

  try {
    fs.writeFileSync(inputFile, n3_input, 'utf8');

    const eyelingPath = path.join(__dirname, 'eyeling.js');
    const res = cp.spawnSync(process.execPath, [eyelingPath, ...args, inputFile], { encoding: 'utf8', maxBuffer });

    if (res.error) throw res.error;

    // Always forward stderr (log:trace, warnings, parse errors, etc.)
    if (res.stderr) process.stderr.write(res.stderr);

    if (res.status !== 0) {
      const err = new Error(res.stderr || `eyeling exited with code ${res.status}`);
      err.code = res.status;
      err.stdout = res.stdout;
      err.stderr = res.stderr;
      throw err;
    }

    return res.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run eyeling in-process over a list of files.
 * - skips directories / non-regular files
 * - continues after a contradiction/fuse (exit code 2) and after errors
 * - prints derived triples (plus the required @prefix headers) to stdout
 * - prints status messages to stderr
 *
 * Returns: 0 (ok), 1 (error), 2 (contradiction/fuse observed).
 */
function runFiles(files = [], opt = {}) {
  if (!Array.isArray(files)) {
    throw new TypeError('runFiles(files, opt): files must be an array');
  }
  if (opt == null || typeof opt !== 'object') opt = {};

  // Lazy-load engine so consumers who only use `reason()` don't pay startup cost.

  const engine = require('./lib/engine.js');

  let overall = 0;

  function prefixLabel(pfx) {
    // N3/Turtle syntax requires the trailing ':'
    return pfx === '' ? ':' : `${pfx}:`;
  }

  function printPrefixes(prefixes, derivedTriples) {
    const used = prefixes.prefixesUsedForOutput(derivedTriples);
    for (const [pfx, base] of used) {
      process.stdout.write(`@prefix ${prefixLabel(pfx)} <${base}> .\n`);
    }
    if (used.length && derivedTriples.length) process.stdout.write('\n');
  }

  function statSafe(p) {
    try {
      return fs.statSync(p);
    } catch (e) {
      return { __err: e };
    }
  }

  function runOne(file) {
    const st = statSafe(file);
    if (st.__err) {
      process.stderr.write(`# skip ${file} (stat failed: ${st.__err.code || st.__err.message})\n`);
      return 1;
    }
    if (st.isDirectory()) {
      process.stderr.write(`# skip ${file} (is a directory)\n`);
      return 0;
    }
    if (!st.isFile()) {
      process.stderr.write(`# skip ${file} (not a regular file)\n`);
      return 0;
    }

    let n3;
    try {
      n3 = fs.readFileSync(file, 'utf8');
    } catch (e) {
      process.stderr.write(`# ${file} failed (read error: ${e.code || e.message}). Continuing…\n`);
      return 1;
    }

    // Trap process.exit so a fuse/contradiction (exit 2) doesn't stop the batch.
    const origExit = process.exit;
    process.exit = (code = 0) => {
      const err = new Error(`eyeling requested process.exit(${code})`);
      err.code = code;
      throw err;
    };

    try {
      const res = engine.reasonStream(n3, {
        baseIri: 'file://' + path.resolve(file),
        proof: typeof opt.proof === 'boolean' ? opt.proof : false,
        includeInputFactsInClosure:
          typeof opt.includeInputFactsInClosure === 'boolean' ? opt.includeInputFactsInClosure : true,
      });

      // CLI-like output: derived triples only (not the full closure)
      const derivedTriples = res.derived.map((df) => df.fact);
      if (!derivedTriples.length) return 0;

      printPrefixes(res.prefixes, derivedTriples);

      for (const df of res.derived) {
        process.stdout.write(engine.tripleToN3(df.fact, res.prefixes) + '\n');
      }

      return 0;
    } catch (e) {
      if (e && e.code === 2) {
        process.stderr.write(`# ${path.basename(file)} failed (exit 2: contradiction/fuse). Continuing…\n`);
        return 2;
      }
      process.stderr.write(
        `# ${file} failed (${e && (e.stack || e.message) ? e.stack || e.message : String(e)}). Continuing…\n`,
      );
      return 1;
    } finally {
      process.exit = origExit;
    }
  }

  for (const f of files) {
    const code = runOne(f);
    overall = Math.max(overall, code);
  }

  return overall;
}

module.exports = { reason, runFiles };

// small interop nicety for ESM default import
module.exports.default = module.exports;
