// @ts-nocheck

import { lex, Parser, PrefixEnv, N3SyntaxError, materializeRdfLists } from './n3_input';
import {
  version,
  forwardChain, isGroundTriple,
  installTraceFormatting, setTracePrefixes, installN3Input,
  setEnforceHttpsEnabled, getEnforceHttpsEnabled,
  setProofCommentsEnabled,
  setSuperRestrictedMode,
} from './reasoner';
import {
  termToN3, tripleToN3,
  formatN3SyntaxError,
  collectOutputStringsFromFacts,
  printExplanation,
} from './n3_output';

// Install N3 input + trace formatting hooks for builtins that need them.
installN3Input(lex, Parser);
installTraceFormatting(termToN3, PrefixEnv.newDefault());

export function reasonStream(n3Text, opts = {}) {
  const {
    baseIri = null,
    proof = false,
    onDerived = null,
    includeInputFactsInClosure = true,
    enforceHttps = false,
  } = opts;

  const __oldEnforceHttps = getEnforceHttpsEnabled();
  setEnforceHttpsEnabled(!!enforceHttps);
  setProofCommentsEnabled(!!proof);

  const toks = lex(n3Text);
  const parser = new Parser(toks);
  if (baseIri) parser.prefixes.setBase(baseIri);

  let prefixes, triples, frules, brules;
  [prefixes, triples, frules, brules] = parser.parseDocument();

  // Make the parsed prefixes available to log:trace output
  setTracePrefixes(prefixes);

  materializeRdfLists(triples, frules, brules);

  const facts = triples.filter((tr) => isGroundTriple(tr));

  const derived = forwardChain(facts, frules, brules, (df) => {
    if (typeof onDerived === 'function') {
      onDerived({
        triple: tripleToN3(df.fact, prefixes),
        df,
      });
    }
  });

  // `forwardChain` mutates `facts` to include derived facts.
  // The option controls whether we include the *original* input facts as well.
  const derivedTriples = derived.map((d) => d.fact);
  const closureTriples = includeInputFactsInClosure ? facts : derivedTriples;

  const __out = {
    prefixes,
    facts,
    derived,
    closureN3: closureTriples.map((t) => tripleToN3(t, prefixes)).join('\n'),
  };

  setEnforceHttpsEnabled(__oldEnforceHttps);
  return __out;
}

// Minimal export surface for Node + browser/worker
const EYELING_API = { reasonStream };

try {
  if (typeof module !== 'undefined' && module.exports) module.exports = EYELING_API;
} catch (_) {}

try {
  if (typeof self !== 'undefined') self.eyeling = EYELING_API;
} catch (_) {}

export function main() {
  // CLI default (and API default) is machine-friendly output: no proof comments.
  setProofCommentsEnabled(false);

  const argvRaw = process.argv.slice(2);
  const argv = [];
  for (const a of argvRaw) {
    if (a === '-' || !a.startsWith('-') || a.startsWith('--') || a.length === 2) {
      argv.push(a);
      continue;
    }
    for (const ch of a.slice(1)) argv.push('-' + ch);
  }
  const prog = String(process.argv[1] || 'eyeling').split(/[\/]/).pop();

  function printHelp(toStderr = false) {
    const msg =
      `Usage: ${prog} [options] <file.n3>

` +
      `Options:
` +
      `  -a, --ast               Print parsed AST as JSON and exit.
` +
      `  -e, --enforce-https     Rewrite http:// IRIs to https:// for log dereferencing builtins.
` +
      `  -h, --help              Show this help and exit.
` +
      `  -p, --proof-comments    Enable proof explanations.
` +
      `  -r, --strings           Print log:outputString strings (ordered by key) instead of N3 output.
` +
      `  -s, --super-restricted  Disable all builtins except => and <=.
` +
      `  -t, --stream            Stream derived triples as soon as they are derived.
` +
      `  -v, --version           Print version and exit.
`;
    (toStderr ? console.error : console.log)(msg);
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp(false);
    process.exit(0);
  }

  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`eyeling v${version}`);
    process.exit(0);
  }

  const showAst = argv.includes('--ast') || argv.includes('-a');
  const outputStringsMode = argv.includes('--strings') || argv.includes('-r');
  const streamMode = argv.includes('--stream') || argv.includes('-t');

  if (argv.includes('--enforce-https') || argv.includes('-e')) {
    setEnforceHttpsEnabled(true);
  }

  if (argv.includes('--proof-comments') || argv.includes('-p')) {
    setProofCommentsEnabled(true);
  }

  if (argv.includes('--no-proof-comments')) {
    setProofCommentsEnabled(false);
  }

  if (argv.includes('--super-restricted') || argv.includes('-s')) {
    setSuperRestrictedMode(true);
  }

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

  const path = positional[0];
  let text;
  try {
    const fs = require('fs');
    text = fs.readFileSync(path, { encoding: 'utf8' });
  } catch (e) {
    console.error(`Error reading file ${JSON.stringify(path)}: ${e.message}`);
    process.exit(1);
  }

  let toks;
  let prefixes, triples, frules, brules;
  try {
    toks = lex(text);
    const parser = new Parser(toks);
    [prefixes, triples, frules, brules] = parser.parseDocument();
    setTracePrefixes(prefixes);
  } catch (e) {
    if (e && e.name === 'N3SyntaxError') {
      console.error(formatN3SyntaxError(e, text, path));
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

  materializeRdfLists(triples, frules, brules);

  const facts = triples.filter((tr) => isGroundTriple(tr));

  if (outputStringsMode) {
    forwardChain(facts, frules, brules);
    const out = collectOutputStringsFromFacts(facts, prefixes);
    if (out) process.stdout.write(out);
    process.exit(0);
  }

  function prefixesUsedInInputTokens(toks2, prefEnv) {
    const used = new Set();

    function maybeAddFromQName(name) {
      if (typeof name !== 'string') return;
      if (!name.includes(':')) return;
      if (name.startsWith('_:')) return;
      const idx = name.indexOf(':');
      const p = name.slice(0, idx);
      if (!Object.prototype.hasOwnProperty.call(prefEnv.map, p)) return;
      used.add(p);
    }

    for (let i = 0; i < toks2.length; i++) {
      const t = toks2[i];
      if (t.typ === 'AtPrefix') {
        while (i < toks2.length && toks2[i].typ !== 'Dot' && toks2[i].typ !== 'EOF') i++;
        continue;
      }
      if (t.typ === 'AtBase') {
        while (i < toks2.length && toks2[i].typ !== 'Dot' && toks2[i].typ !== 'EOF') i++;
        continue;
      }
      if (t.typ === 'Ident') maybeAddFromQName(t.value);
      if (t.typ === 'PNameNs') maybeAddFromQName(t.value + ':');
    }

    const pfxLines = [];
    for (const pfx of Array.from(used).sort()) {
      const iri = prefEnv.map[pfx];
      const pname = pfx === '' ? ':' : pfx + ':';
      pfxLines.push(`@prefix ${pname} <${iri}> .`);
    }
    return pfxLines.join('\n');
  }

  const outPrefixes = prefixes;

  if (streamMode) {
    const header = prefixesUsedInInputTokens(toks, outPrefixes);
    if (header) console.log(header + '\n');

    forwardChain(facts, frules, brules, (df) => {
      if (argv.includes('--proof-comments') || argv.includes('-p')) {
        printExplanation(df, outPrefixes);
      }
      console.log(tripleToN3(df.fact, outPrefixes));
    });
    process.exit(0);
  }

  const derived = forwardChain(facts, frules, brules);

  // If nothing was derived, print nothing (even if the input had prefixes).
  if (!derived || derived.length === 0) {
    process.exit(0);
  }

  // Print only *newly derived forward facts* (CLI contract).
  const header = prefixesUsedInInputTokens(toks, outPrefixes);
  if (header) console.log(header + '\n');

  // If proof comments are enabled, print the explanation blocks first (so the
  // output triples remain easy to parse by machines when comments are disabled).
  if (argv.includes('--proof-comments') || argv.includes('-p')) {
    for (const df of derived) printExplanation(df, outPrefixes);
  }

  const outN3 = derived.map((df) => tripleToN3(df.fact, outPrefixes)).join('\n');
  if (outN3) console.log(outN3);
}

// In a bundled single-file build, `require.main === module` is unreliable
// because the bundle wraps modules in internal CJS shims.
// Instead, detect direct execution via `node eyeling.js ...`.
function __shouldRunMain() {
  try {
    if (typeof process === 'undefined' || !process.argv || process.argv.length < 2) return false;
    const arg1 = String(process.argv[1] || '');
    if (!arg1) return false;
    const base = typeof __filename === 'string' ? __filename.split(/[\\/]/).pop() : 'eyeling.js';
    if (!base) return false;
    return arg1 === __filename || arg1.endsWith('/' + base) || arg1.endsWith('\\' + base);
  } catch (_) {
    return false;
  }
}
if (__shouldRunMain()) main();
