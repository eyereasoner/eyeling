// run-inprocess.js
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Local repo engine (in-process)
const engine = require("./lib/engine.js");

const argv = process.argv.slice(2);

let overall = 0; // 0 ok, 1 error, 2 contradiction/fuse seen

function prefixLabel(pfx) {
  // N3/Turtle syntax requires the trailing ':'
  return pfx === "" ? ":" : `${pfx}:`;
}

function printPrefixes(prefixes, derivedTriples) {
  const used = prefixes.prefixesUsedForOutput(derivedTriples);
  for (const [pfx, base] of used) {
    console.log(`@prefix ${prefixLabel(pfx)} <${base}> .`);
  }
  if (used.length && derivedTriples.length) console.log();
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
    console.error(`# skip ${file} (stat failed: ${st.__err.code || st.__err.message})`);
    return 1;
  }
  if (st.isDirectory()) {
    console.error(`# skip ${file} (is a directory)`);
    return 0;
  }
  if (!st.isFile()) {
    console.error(`# skip ${file} (not a regular file)`);
    return 0;
  }

  let n3;
  try {
    n3 = fs.readFileSync(file, "utf8");
  } catch (e) {
    console.error(`# ${file} failed (read error: ${e.code || e.message}). Continuing…`);
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
      baseIri: "file://" + path.resolve(file),
      proof: false,
      includeInputFactsInClosure: true,
    });

    // CLI-like output: derived triples only (not the full closure)
    const derivedTriples = res.derived.map((df) => df.fact);
    if (!derivedTriples.length) return 0;

    printPrefixes(res.prefixes, derivedTriples);

    for (const df of res.derived) {
      console.log(engine.tripleToN3(df.fact, res.prefixes));
    }

    return 0;
  } catch (e) {
    if (e && e.code === 2) {
      console.error(`# ${path.basename(file)} failed (exit 2: contradiction/fuse). Continuing…`);
      return 2;
    }
    console.error(`# ${file} failed (${e && (e.stack || e.message) ? (e.stack || e.message) : String(e)}). Continuing…`);
    return 1;
  } finally {
    process.exit = origExit;
  }
}

for (const f of argv) {
  const code = runOne(f);
  overall = Math.max(overall, code);
}

// Preserve a useful overall exit status for CI
process.exitCode = overall;

