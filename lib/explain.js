/**
 * Eyeling Reasoner — explain/output
 *
 * Pretty-printing of proofs and log:outputString aggregation.
 * Extracted from engine.js to keep the core engine focused on inference/search.
 */
'use strict';

const { LOG_NS, Literal, Iri, Blank, Var, varsInRule, literalParts } = require('./prelude');

const { termToN3, tripleToN3 } = require('./printing');
const { parseNumericLiteralInfo, termToJsString } = require('./builtins');

function makeExplain(deps) {
  const applySubstTerm = deps.applySubstTerm;
  const skolemKeyFromTerm = deps.skolemKeyFromTerm;

  function printExplanation(df, prefixes) {
    console.log('# ----------------------------------------------------------------------');
    console.log('# Proof for derived triple:');

    // Fact line(s), indented 2 spaces after '# '
    for (const line of tripleToN3(df.fact, prefixes).split(/\r?\n/)) {
      const stripped = line.replace(/\s+$/, '');
      if (stripped) {
        console.log('#   ' + stripped);
      }
    }

    if (!df.premises.length) {
      console.log('# This triple is the head of a forward rule with an empty premise,');
      console.log('# so it holds unconditionally whenever the program is loaded.');
    } else {
      console.log('# It holds because the following instance of the rule body is provable:');

      // Premises, also indented 2 spaces after '# '
      for (const prem of df.premises) {
        for (const line of tripleToN3(prem, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, '');
          if (stripped) {
            console.log('#   ' + stripped);
          }
        }
      }

      console.log('# via the schematic forward rule:');

      // Rule pretty-printed
      console.log('#   {');
      for (const tr of df.rule.premise) {
        for (const line of tripleToN3(tr, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, '');
          if (stripped) {
            console.log('#     ' + stripped);
          }
        }
      }
      console.log('#   } => {');
      for (const tr of df.rule.conclusion) {
        for (const line of tripleToN3(tr, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, '');
          if (stripped) {
            console.log('#     ' + stripped);
          }
        }
      }
      console.log('#   } .');
    }

    // Substitution block
    const ruleVars = varsInRule(df.rule);
    const visibleNames = Object.keys(df.subst)
      .filter((name) => ruleVars.has(name))
      .sort();

    if (visibleNames.length) {
      console.log('# with substitution (on rule variables):');
      for (const v of visibleNames) {
        const fullTerm = applySubstTerm(new Var(v), df.subst);
        const rendered = termToN3(fullTerm, prefixes);
        const lines = rendered.split(/\r?\n/);

        if (lines.length === 1) {
          // single-line term
          const stripped = lines[0].replace(/\s+$/, '');
          if (stripped) {
            console.log('#   ?' + v + ' = ' + stripped);
          }
        } else {
          // multi-line term (e.g. a formula)
          const first = lines[0].trimEnd(); // usually "{"
          if (first) {
            console.log('#   ?' + v + ' = ' + first);
          }
          for (let i = 1; i < lines.length; i++) {
            const stripped = lines[i].trim();
            if (!stripped) continue;
            if (i === lines.length - 1) {
              // closing brace
              console.log('#   ' + stripped);
            } else {
              // inner triple lines
              console.log('#     ' + stripped);
            }
          }
        }
      }
    }

    console.log('# Therefore the derived triple above is entailed by the rules and facts.');
    console.log('# ----------------------------------------------------------------------\n');
  }

  // ===========================================================================
  // CLI entry point
  // ===========================================================================
  // ===========================================================================
  // log:outputString support
  // ===========================================================================

  function __compareOutputStringKeys(a, b, _prefixes) {
    // Deterministic ordering of keys. The spec only requires "order of the subject keys"
    // and leaves concrete term ordering reasoner-dependent. We implement:
    //   1) numeric literals (numeric value)
    //   2) plain literals (lexical form)
    //   3) IRIs
    //   4) blank nodes (label)
    //   5) fallback: skolemKeyFromTerm
    const aNum = parseNumericLiteralInfo(a);
    const bNum = parseNumericLiteralInfo(b);
    if (aNum && bNum) {
      // bigint or number
      if (aNum.kind === 'bigint' && bNum.kind === 'bigint') {
        if (aNum.value < bNum.value) return -1;
        if (aNum.value > bNum.value) return 1;
        return 0;
      }
      const av = Number(aNum.value);
      const bv = Number(bNum.value);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    }
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;

    // Plain literal ordering (lexical)
    if (a instanceof Literal && b instanceof Literal) {
      const [alex] = literalParts(a.value);
      const [blex] = literalParts(b.value);
      if (alex < blex) return -1;
      if (alex > blex) return 1;
      return 0;
    }
    if (a instanceof Literal && !(b instanceof Literal)) return -1;
    if (!(a instanceof Literal) && b instanceof Literal) return 1;

    // IRIs
    if (a instanceof Iri && b instanceof Iri) {
      if (a.value < b.value) return -1;
      if (a.value > b.value) return 1;
      return 0;
    }
    if (a instanceof Iri && !(b instanceof Iri)) return -1;
    if (!(a instanceof Iri) && b instanceof Iri) return 1;

    // Blank nodes
    if (a instanceof Blank && b instanceof Blank) {
      if (a.label < b.label) return -1;
      if (a.label > b.label) return 1;
      return 0;
    }
    if (a instanceof Blank && !(b instanceof Blank)) return -1;
    if (!(a instanceof Blank) && b instanceof Blank) return 1;

    // Fallback
    const ak = skolemKeyFromTerm(a);
    const bk = skolemKeyFromTerm(b);
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return 0;
  }

  function collectOutputStringsFromFacts(facts, prefixes) {
    // Gather all (key, string) pairs from the saturated fact store.
    const pairs = [];
    for (const tr of facts) {
      if (!(tr && tr.p instanceof Iri)) continue;
      if (tr.p.value !== LOG_NS + 'outputString') continue;
      if (!(tr.o instanceof Literal)) continue;

      const s = termToJsString(tr.o);
      if (s === null) continue;

      pairs.push({ key: tr.s, text: s, idx: pairs.length });
    }

    pairs.sort((a, b) => {
      const c = __compareOutputStringKeys(a.key, b.key, prefixes);
      if (c !== 0) return c;
      return a.idx - b.idx; // stable tie-breaker
    });

    return pairs.map((p) => p.text).join('');
  }

  return { printExplanation, collectOutputStringsFromFacts };
}

module.exports = { makeExplain };
