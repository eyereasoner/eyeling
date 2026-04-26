/**
 * Eyeling Reasoner — cli
 *
 * CLI helpers: argument handling, user-facing errors, and convenient wrappers
 * around the core engine for command-line usage.
 */

'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const engine = require('./engine');
const deref = require('./deref');
const { PrefixEnv } = require('./prelude');
const { parseN3Text, mergeParsedDocuments } = require('./multisource');

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
function readTextFromStdinSync() {
  const fs = require('node:fs');
  return fs.readFileSync(0, { encoding: 'utf8' });
}

function __isNetworkOrFileIri(s) {
  return typeof s === 'string' && /^(https?:|file:\/\/)/i.test(s);
}

function __sourceLabelToBaseIri(sourceLabel) {
  if (!sourceLabel || sourceLabel === '<stdin>') return '';
  if (__isNetworkOrFileIri(sourceLabel)) return deref.stripFragment(sourceLabel);
  return pathToFileURL(path.resolve(sourceLabel)).toString();
}

function __readInputSourceSync(sourceLabel) {
  if (sourceLabel === '<stdin>') return readTextFromStdinSync();

  if (__isNetworkOrFileIri(sourceLabel)) {
    const txt = deref.derefTextSync(sourceLabel);
    if (typeof txt !== 'string') throw new Error(`Failed to dereference ${sourceLabel}`);
    return txt;
  }

  const fs = require('node:fs');
  return fs.readFileSync(sourceLabel, { encoding: 'utf8' });
}

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
    // Combined short flags (the long --builtin option takes a value)
    for (const ch of a.slice(1)) argv.push('-' + ch);
  }
  const prog = String(process.argv[1] || 'eyeling')
    .split(/\//)
    .pop();

  function printHelp(toStderr = false) {
    const msg =
      `Usage: ${prog} [options] [file-or-url.n3|- ...]\n\n` +
      `When no file is given and stdin is piped, read N3 from stdin.\n` +
      `When multiple inputs are given, parse each source separately, merge ASTs, then reason once.\n\n` +
      `Options:\n` +
      `  -a, --ast                    Print parsed AST as JSON and exit.\n` +
      `      --builtin <module.js>    Load a custom builtin module (repeatable).\n` +
      `  -d, --deterministic-skolem   Make log:skolem stable across reasoning runs.\n` +
      `  -e, --enforce-https          Rewrite http:// IRIs to https:// for log dereferencing builtins.\n` +
      `  -h, --help                   Show this help and exit.\n` +
      `  -p, --proof-comments         Enable proof explanations.\n` +
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

  const builtinModules = [];
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--builtin') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('Error: --builtin expects a module path.');
        process.exit(1);
      }
      builtinModules.push(next);
      i += 1;
      continue;
    }
    if (typeof a === 'string' && a.startsWith('--builtin=')) {
      builtinModules.push(a.slice('--builtin='.length));
      continue;
    }
    if (a === '-' || !a.startsWith('-')) positional.push(a);
  }

  const showAst = argv.includes('--ast') || argv.includes('-a');
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

  // Positional args (one or more N3 sources).
  const useImplicitStdin = positional.length === 0 && !process.stdin.isTTY;
  if (positional.length === 0 && !useImplicitStdin) {
    printHelp(false);
    process.exit(0);
  }

  for (const spec of builtinModules) {
    try {
      if (typeof engine.loadBuiltinModule === 'function')
        engine.loadBuiltinModule(spec, { resolveFrom: process.cwd() });
    } catch (e) {
      console.error(`Error loading builtin module ${JSON.stringify(spec)}: ${e && e.message ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  const sourceLabels = useImplicitStdin ? ['<stdin>'] : positional.map((item) => (item === '-' ? '<stdin>' : item));
  if (sourceLabels.filter((item) => item === '<stdin>').length > 1) {
    console.error('Error: stdin can only be used once.');
    process.exit(1);
  }

  const parsedSources = [];
  for (const sourceLabel of sourceLabels) {
    let text;
    try {
      text = __readInputSourceSync(sourceLabel);
    } catch (e) {
      if (sourceLabel === '<stdin>') console.error(`Error reading stdin: ${e.message}`);
      else console.error(`Error reading source ${JSON.stringify(sourceLabel)}: ${e.message}`);
      process.exit(1);
    }

    try {
      parsedSources.push(
        parseN3Text(text, {
          baseIri: __sourceLabelToBaseIri(sourceLabel),
          label: sourceLabel,
          collectUsedPrefixes: true,
          keepSourceArtifacts: false,
        }),
      );
    } catch (e) {
      if (e && e.name === 'N3SyntaxError') {
        console.error(formatN3SyntaxError(e, text, sourceLabel));
        process.exit(1);
      }
      throw e;
    }
  }

  const mergedDocument = mergeParsedDocuments(parsedSources);
  const prefixes = mergedDocument.prefixes;
  const triples = mergedDocument.triples;
  const frules = mergedDocument.frules;
  const brules = mergedDocument.brules;
  const qrules = mergedDocument.logQueryRules;
  if (showAst) {
    function astReplacer(unusedJsonKey, value) {
      if (value instanceof Set) return Array.from(value);
      if (value && typeof value === 'object' && value.constructor) {
        const t = value.constructor.name;
        if (t && t !== 'Object' && t !== 'Array') return { _type: t, ...value };
      }
      return value;
    }
    // For backwards compatibility, --ast prints exactly four top-level elements:
    //   [prefixes, triples, forwardRules, backwardRules]
    // log:query directives are output-selection statements and are not included
    // in the legacy AST contract expected by test suites and downstream tools.
    console.log(JSON.stringify([prefixes, triples, frules, brules], astReplacer, 2));
    process.exit(0);
  }

  // Materialize anonymous rdf:first/rdf:rest collections into list terms.
  // Named list nodes keep identity; list:* builtins can traverse them.
  engine.materializeRdfLists(triples, frules.concat(qrules || []), brules);

  // Keep non-ground top-level facts too (e.g., universally quantified N3 vars)
  // so they can participate in rule matching. Derived/output facts remain
  // ground-gated in the engine.
  const facts = triples.slice();

  const LOG_OUTPUT_STRING = 'http://www.w3.org/2000/10/swap/log#outputString';

  function programMayProduceOutputStrings(topLevelTriples, forwardRules, logQueryRules) {
    const hasOutputStringPredicate = (trs) =>
      Array.isArray(trs) &&
      trs.some(
        (tr) => tr && tr.p && tr.p.constructor && tr.p.constructor.name === 'Iri' && tr.p.value === LOG_OUTPUT_STRING,
      );

    if (hasOutputStringPredicate(topLevelTriples)) return true;
    if (Array.isArray(forwardRules) && forwardRules.some((r) => hasOutputStringPredicate(r && r.conclusion)))
      return true;
    if (Array.isArray(logQueryRules) && logQueryRules.some((r) => hasOutputStringPredicate(r && r.conclusion)))
      return true;
    return false;
  }

  function factsContainOutputStrings(triplesForOutput) {
    return (
      Array.isArray(triplesForOutput) &&
      triplesForOutput.some(
        (tr) => tr && tr.p && tr.p.constructor && tr.p.constructor.name === 'Iri' && tr.p.value === LOG_OUTPUT_STRING,
      )
    );
  }

  // In --stream mode we print prefixes *before* any derivations happen.
  // To keep the header small and stable, emit only prefixes that are actually
  // used (as QNames) in the *input* N3 program.
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
  // Note: when log:query directives are present, we cannot stream output because
  // the selected results depend on the saturated closure.
  const hasQueries = Array.isArray(qrules) && qrules.length;
  const mayAutoRenderOutputStrings = programMayProduceOutputStrings(triples, frules, qrules);

  if (streamMode && !hasQueries && !mayAutoRenderOutputStrings) {
    const usedInInput = mergedDocument.usedPrefixes instanceof Set ? new Set(mergedDocument.usedPrefixes) : new Set();
    const outPrefixes = restrictPrefixEnv(prefixes, usedInInput);

    // Ensure log:trace uses the same compact prefix set as the output.
    engine.setTracePrefixes(outPrefixes);

    const entries = Object.entries(outPrefixes.map)
      .filter(([, base]) => !!base)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

    for (const [pfx, base] of entries) {
      if (pfx === '') console.log(`@prefix : <${base}> .`);
      else console.log(`@prefix ${pfx}: <${base}> .`);
    }
    if (entries.length) console.log();

    engine.forwardChain(
      facts,
      frules,
      brules,
      (df) => {
        if (engine.getProofCommentsEnabled()) {
          engine.printExplanation(df, outPrefixes);
          console.log(engine.tripleToN3(df.fact, outPrefixes));
          console.log();
        } else {
          console.log(engine.tripleToN3(df.fact, outPrefixes));
        }
      },
      { captureExplanations: engine.getProofCommentsEnabled(), prefixes: outPrefixes },
    );
    return;
  }

  // Default (non-streaming):
  // - without log:query: derive everything first, then print only newly derived facts
  // - with log:query: derive everything first, then print only unique instantiated
  //   conclusion triples from the log:query directives.
  let derived = [];
  let outTriples = [];
  let outDerived = [];

  if (hasQueries) {
    const res = engine.forwardChainAndCollectLogQueryConclusions(facts, frules, brules, qrules, { prefixes });
    derived = res.derived;
    outTriples = res.queryTriples;
    outDerived = res.queryDerived;
  } else {
    derived = engine.forwardChain(facts, frules, brules, null, {
      captureExplanations: engine.getProofCommentsEnabled(),
      prefixes,
    });
    outDerived = derived;
    outTriples = derived.map((df) => df.fact);
  }

  const renderedOutputTriples = hasQueries ? outTriples : facts;
  if (factsContainOutputStrings(renderedOutputTriples)) {
    process.stdout.write(engine.collectOutputStringsFromFacts(renderedOutputTriples, prefixes));
    return;
  }

  const usedPrefixes = prefixes.prefixesUsedForOutput(outTriples);

  for (const [pfx, base] of usedPrefixes) {
    if (pfx === '') console.log(`@prefix : <${base}> .`);
    else console.log(`@prefix ${pfx}: <${base}> .`);
  }
  if (outTriples.length && usedPrefixes.length) console.log();

  // In log:query mode, when proof comments are disabled, pretty-print blank-node
  // shaped outputs as Turtle property lists ("[ ... ] .") for readability.
  if (hasQueries && !engine.getProofCommentsEnabled()) {
    const s = engine.prettyPrintQueryTriples(outTriples, prefixes);
    if (s) process.stdout.write(String(s).replace(/\s*$/g, '') + '\n');
    return;
  }

  for (const df of outDerived) {
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
