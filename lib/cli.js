/**
 * Eyeling Reasoner — cli
 *
 * CLI helpers: argument handling, user-facing errors, and convenient wrappers
 * around the core engine for command-line usage.
 */

'use strict';

const engine = require('./engine');
const { PrefixEnv } = require('./prelude');

function offsetToLineCol(text, offset) {
  const chars = Array.from(text);
  const n = Math.max(0, Math.min(typeof offset === 'number' ? offset : 0, chars.length));
  let line = 1;
  let col = 1;
  for (let i = 0; i < n; i++) {
    const c = chars[i];
    if (c === '\n') {
      line++;
      col = 1;
    } else if (c === '\r') {
      line++;
      col = 1;
      if (i + 1 < n && chars[i + 1] === '\n') i++; // swallow \n in CRLF
    } else {
      col++;
    }
  }
  return { line, col };
}

function formatN3SyntaxError(err, text, path) {
  const off = err && typeof err.offset === 'number' ? err.offset : null;
  const label = path ? String(path) : '<input>';
  if (off === null) {
    return `Syntax error in ${label}: ${err && err.message ? err.message : String(err)}`;
  }
  const { line, col } = offsetToLineCol(text, off);
  const lines = String(text).split(/\r\n|\n|\r/);
  const lineText = lines[line - 1] ?? '';
  const caret = ' '.repeat(Math.max(0, col - 1)) + '^';
  return `Syntax error in ${label}:${line}:${col}: ${err.message}\n${lineText}\n${caret}`;
}

// CLI entry point (invoked when eyeling.js is run directly)
function main() {
  // Drop "node" and script name; keep only user-provided args
  // Expand combined short options: -pt == -p -t
  const argvRaw = process.argv.slice(2);
  const argv = [];
  for (const a of argvRaw) {
    if (a === '-' || !a.startsWith('-') || a.startsWith('--') || a.length === 2) {
      argv.push(a);
      continue;
    }
    // Combined short flags (no flag in eyeling takes a value)
    for (const ch of a.slice(1)) argv.push('-' + ch);
  }
  const prog = String(process.argv[1] || 'eyeling')
    .split(/[\/]/)
    .pop();

  function printHelp(toStderr = false) {
    const msg =
      `Usage: ${prog} [options] <file.n3>\n\n` +
      `Options:\n` +
      `  -a, --ast                    Print parsed AST as JSON and exit.\n` +
      `  -d, --deterministic-skolem   Make log:skolem stable across reasoning runs.\n` +
      `  -e, --enforce-https          Rewrite http:// IRIs to https:// for log dereferencing builtins.\n` +
      `  -h, --help                   Show this help and exit.\n` +
      `  -p, --proof-comments         Enable proof explanations.\n` +
      `  -r, --strings                Print log:outputString strings (ordered by key) instead of N3 output.\n` +
      `  -s, --super-restricted       Disable all builtins except => and <=.\n` +
      `  -t, --stream                 Stream derived triples as soon as they are derived.\n` +
      `  -v, --version                Print version and exit.\n`;
    (toStderr ? console.error : console.log)(msg);
  }

  // --help / -h: print help and exit
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp(false);
    process.exit(0);
  }

  // --version / -v: print version and exit
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`eyeling v${engine.version}`);
    process.exit(0);
  }

  const showAst = argv.includes('--ast') || argv.includes('-a');
  const outputStringsMode = argv.includes('--strings') || argv.includes('-r');
  const streamMode = argv.includes('--stream') || argv.includes('-t');

  // --enforce-https: rewrite http:// -> https:// for log dereferencing builtins
  if (argv.includes('--enforce-https') || argv.includes('-e')) {
    engine.setEnforceHttpsEnabled(true);
  }

  // --deterministic-skolem / -d: make log:skolem stable across runs
  if (argv.includes('--deterministic-skolem') || argv.includes('-d')) {
    if (typeof engine.setDeterministicSkolemEnabled === 'function') engine.setDeterministicSkolemEnabled(true);
  }

  // --proof-comments / -p: enable proof explanations
  if (argv.includes('--proof-comments') || argv.includes('-p')) {
    engine.setProofCommentsEnabled(true);
  }

  // --super-restricted / -s: disable all builtins except => / <=
  if (argv.includes('--super-restricted') || argv.includes('-s')) {
    if (typeof engine.setSuperRestrictedMode === 'function') engine.setSuperRestrictedMode(true);
  }

  // Positional args (the N3 file)
  const positional = argv.filter((a) => !a.startsWith('-'));
  if (positional.length === 0) {
    printHelp(false);
    process.exit(0);
  }
  if (positional.length !== 1) {
    console.error('Error: expected exactly one input <file.n3>.');
    printHelp(true);
    process.exit(1);
  }

  const filePath = positional[0];
  let text;
  try {
    const fs = require('fs');
    text = fs.readFileSync(filePath, { encoding: 'utf8' });
  } catch (e) {
    console.error(`Error reading file ${JSON.stringify(filePath)}: ${e.message}`);
    process.exit(1);
  }

  let toks;
  let prefixes, triples, frules, brules;
  try {
    toks = engine.lex(text);
    const parser = new engine.Parser(toks);
    [prefixes, triples, frules, brules] = parser.parseDocument();
    // Make the parsed prefixes available to log:trace output (CLI path)
    engine.setTracePrefixes(prefixes);
  } catch (e) {
    if (e && e.name === 'N3SyntaxError') {
      console.error(formatN3SyntaxError(e, text, filePath));
      process.exit(1);
    }
    throw e;
  }

  if (showAst) {
    function astReplacer(_key, value) {
      if (value instanceof Set) return Array.from(value);
      if (value && typeof value === 'object' && value.constructor) {
        const t = value.constructor.name;
        if (t && t !== 'Object' && t !== 'Array') return { _type: t, ...value };
      }
      return value;
    }
    console.log(JSON.stringify([prefixes, triples, frules, brules], astReplacer, 2));
    process.exit(0);
  }

  // NOTE: Do not rewrite rdf:first/rdf:rest RDF list nodes into list terms.
  // list:* builtins interpret RDF list structures directly when needed.

  const facts = triples.filter((tr) => engine.isGroundTriple(tr));

  // If requested, print log:outputString values (ordered by subject key) and exit.
  // Note: log:outputString values may depend on derived facts, so we must saturate first.
  if (outputStringsMode) {
    engine.forwardChain(facts, frules, brules);
    const out = engine.collectOutputStringsFromFacts(facts, prefixes);
    if (out) process.stdout.write(out);
    process.exit(0);
  }

  // In --stream mode we print prefixes *before* any derivations happen.
  // To keep the header small and stable, emit only prefixes that are actually
  // used (as QNames) in the *input* N3 program.
  function prefixesUsedInInputTokens(toks2, prefEnv) {
    const used = new Set();

    function maybeAddFromQName(name) {
      if (typeof name !== 'string') return;
      if (!name.includes(':')) return;
      if (name.startsWith('_:')) return; // blank node

      // Split only on the first ':'
      const idx = name.indexOf(':');
      const p = name.slice(0, idx); // may be '' for ":foo"

      // Ignore things like "http://..." unless that prefix is actually defined.
      if (!Object.prototype.hasOwnProperty.call(prefEnv.map, p)) return;

      used.add(p);
    }

    for (let i = 0; i < toks2.length; i++) {
      const t = toks2[i];

      // Skip @prefix ... .
      if (t.typ === 'AtPrefix') {
        while (i < toks2.length && toks2[i].typ !== 'Dot' && toks2[i].typ !== 'EOF') i++;
        continue;
      }
      // Skip @base ... .
      if (t.typ === 'AtBase') {
        while (i < toks2.length && toks2[i].typ !== 'Dot' && toks2[i].typ !== 'EOF') i++;
        continue;
      }

      // Skip SPARQL/Turtle PREFIX pfx: <iri>
      if (
        t.typ === 'Ident' &&
        typeof t.value === 'string' &&
        t.value.toLowerCase() === 'prefix' &&
        toks2[i + 1] &&
        toks2[i + 1].typ === 'Ident' &&
        typeof toks2[i + 1].value === 'string' &&
        toks2[i + 1].value.endsWith(':') &&
        toks2[i + 2] &&
        (toks2[i + 2].typ === 'IriRef' || toks2[i + 2].typ === 'Ident')
      ) {
        i += 2;
        continue;
      }

      // Skip SPARQL BASE <iri>
      if (
        t.typ === 'Ident' &&
        typeof t.value === 'string' &&
        t.value.toLowerCase() === 'base' &&
        toks2[i + 1] &&
        toks2[i + 1].typ === 'IriRef'
      ) {
        i += 1;
        continue;
      }

      // Count QNames in identifiers (including datatypes like xsd:integer).
      if (t.typ === 'Ident') {
        maybeAddFromQName(t.value);
      }
    }

    return used;
  }

  function restrictPrefixEnv(prefEnv, usedSet) {
    const m = {};
    for (const p of usedSet) {
      if (Object.prototype.hasOwnProperty.call(prefEnv.map, p)) {
        m[p] = prefEnv.map[p];
      }
    }
    return new PrefixEnv(m, prefEnv.baseIri || '');
  }

  // Streaming mode: print (input) prefixes first, then print derived triples as soon as they are found.
  if (streamMode) {
    const usedInInput = prefixesUsedInInputTokens(toks, prefixes);
    const outPrefixes = restrictPrefixEnv(prefixes, usedInInput);

    // Ensure log:trace uses the same compact prefix set as the output.
    engine.setTracePrefixes(outPrefixes);

    const entries = Object.entries(outPrefixes.map)
      .filter(([_p, base]) => !!base)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

    for (const [pfx, base] of entries) {
      if (pfx === '') console.log(`@prefix : <${base}> .`);
      else console.log(`@prefix ${pfx}: <${base}> .`);
    }
    if (entries.length) console.log();

    engine.forwardChain(facts, frules, brules, (df) => {
      if (engine.getProofCommentsEnabled()) {
        engine.printExplanation(df, outPrefixes);
        console.log(engine.tripleToN3(df.fact, outPrefixes));
        console.log();
      } else {
        console.log(engine.tripleToN3(df.fact, outPrefixes));
      }
    });
    return;
  }

  // Default (non-streaming): derive everything first, then print only the newly derived facts.
  const derived = engine.forwardChain(facts, frules, brules);
  const derivedTriples = derived.map((df) => df.fact);
  const usedPrefixes = prefixes.prefixesUsedForOutput(derivedTriples);

  for (const [pfx, base] of usedPrefixes) {
    if (pfx === '') console.log(`@prefix : <${base}> .`);
    else console.log(`@prefix ${pfx}: <${base}> .`);
  }
  if (derived.length && usedPrefixes.length) console.log();

  for (const df of derived) {
    if (engine.getProofCommentsEnabled()) {
      engine.printExplanation(df, prefixes);
      console.log(engine.tripleToN3(df.fact, prefixes));
      console.log();
    } else {
      console.log(engine.tripleToN3(df.fact, prefixes));
    }
  }
}

module.exports = { main, formatN3SyntaxError };
