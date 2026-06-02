/**
 * Eyeling Reasoner — explain/output
 *
 * Pretty-printing of proofs and log:outputString aggregation.
 * Extracted from engine.js to keep the core engine focused on inference/search.
 */
'use strict';

const { LOG_NS, Literal, Iri, Blank, Var, GraphTerm, varsInRule, literalParts, PrefixEnv } = require('./prelude');

const { termToN3, tripleToN3 } = require('./printing');
const { parseNumericLiteralInfo, termToJsString } = require('./builtins');

function makeExplain(deps) {
  const applySubstTerm = deps.applySubstTerm;
  const skolemKeyFromTerm = deps.skolemKeyFromTerm;
  const isBuiltinPred = typeof deps.isBuiltinPred === 'function' ? deps.isBuiltinPred : () => false;
  const findBackwardProofForGoal = typeof deps.findBackwardProofForGoal === 'function' ? deps.findBackwardProofForGoal : null;

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


  const PE_NS = 'https://eyereasoner.github.io/pe#';

  function n3String(value) {
    return JSON.stringify(String(value));
  }

  function lineIndent(text, prefix) {
    return String(text)
      .split(/\r?\n/)
      .map((line) => (line.length ? prefix + line : line))
      .join('\n');
  }

  function graphForTriple(tr, prefixes) {
    const body = tripleToN3(tr, prefixes).trimEnd();
    if (!body.includes('\n')) return `{ ${body} }`;
    return `{
${lineIndent(body, '    ')}
}`;
  }

  function clonePrefixEnvWithProofVocabulary(prefixes) {
    const map = { ...(prefixes && prefixes.map ? prefixes.map : {}) };
    if (!map.pe) map.pe = PE_NS;
    return new PrefixEnv(map, (prefixes && prefixes.baseIri) || '');
  }

  function proofTripleKey(tr) {
    if (!tr) return '';
    return `${skolemKeyFromTerm(tr.s)}\t${skolemKeyFromTerm(tr.p)}\t${skolemKeyFromTerm(tr.o)}`;
  }

  function sourceLabelForProof(source) {
    if (!source || typeof source.label !== 'string' || !source.label) return '<unknown>';
    // Keep proof output stable when the CLI is invoked with paths such as examples/foo.n3.
    return source.label.replace(/\\/g, '/').split('/').pop() || source.label;
  }

  function sourceKeyForProof(source) {
    if (!source) return '<unknown>';
    return `${sourceLabelForProof(source)}:${Number.isInteger(source.line) ? source.line : ''}`;
  }

  function byBlankNode(kind, source) {
    const src = source || {};
    const props = [`pe:${kind} ${n3String(sourceLabelForProof(src))}`];
    if (Number.isInteger(src.line) && src.line > 0) props.push(`pe:line ${src.line}`);
    return `[ ${props.join('; ')} ]`;
  }

  function renderBindingItems(df, prefixes) {
    if (!df || !df.rule || !df.subst) return [];
    const ruleVars = varsInRule(df.rule);
    const visibleNames = Object.keys(df.subst)
      .filter((name) => ruleVars.has(name))
      .sort();
    if (!visibleNames.length) return [];
    const sourceNames = (df.rule && df.rule.__proofVarSourceNames) || null;
    return visibleNames.map((name) => {
      const value = applySubstTerm(new Var(name), df.subst);
      const displayName = sourceNames && sourceNames[name] ? sourceNames[name] : name;
      return `[ pe:var ${n3String(displayName)}; pe:value ${termToN3(value, prefixes)} ]`;
    });
  }

  function withLastLineSuffix(text, suffix) {
    const lines = String(text).split(/\r?\n/);
    lines[lines.length - 1] += suffix;
    return lines.join('\n');
  }

  function renderPredicateObjects(predicate, objects, isLast) {
    const values = (objects || []).filter((value) => value);
    if (!values.length) return [];
    const end = isLast ? '.' : ';';
    if (values.length === 1 && !values[0].includes('\n')) {
      return [`    ${predicate} ${values[0]}${end}`];
    }
    const out = [`    ${predicate}`];
    for (let i = 0; i < values.length; i++) {
      const suffix = i === values.length - 1 ? end : ',';
      out.push(lineIndent(withLastLineSuffix(values[i], suffix), '      '));
    }
    return out;
  }

  function proofEntryKey(entry) {
    if (!entry) return '';
    if (entry.kind === 'rule') {
      const df = entry.df;
      const source = df && df.rule && df.rule.__source;
      const premiseKey = (df && df.premises ? df.premises : []).map(proofTripleKey).join('|');
      return `rule:${proofTripleKey(df && df.fact)}:${sourceKeyForProof(source)}:${premiseKey}`;
    }
    if (entry.kind === 'builtin') return `builtin:${proofTripleKey(entry.fact)}`;
    return `fact:${proofTripleKey(entry.fact)}:${sourceKeyForProof(entry.source)}`;
  }

  function collectProofEntries(rootDf, derivedByKey, baseFactByKey, resolveBackwardProof) {
    const entries = [];
    const seen = new Set();

    function remember(entry) {
      const key = proofEntryKey(entry);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      entries.push(entry);
      return true;
    }

    function derivedCandidatesForKey(key) {
      const found = derivedByKey.get(key);
      if (!found) return [];
      return Array.isArray(found) ? found : [found];
    }

    function visitProofNode(proof, fallbackTriple, parentDf) {
      if (!proof) {
        visitFactTriple(fallbackTriple, parentDf);
        return;
      }
      if (proof.kind === 'rule' && proof.df) {
        visitDerivedFact(proof.df, proof.children || null);
        return;
      }
      if (proof.kind === 'builtin') {
        remember({ kind: 'builtin', fact: proof.fact || fallbackTriple, builtin: proof.builtin || (proof.fact && proof.fact.p) });
        return;
      }
      remember({ kind: 'fact', fact: proof.fact || fallbackTriple, source: proof.source });
    }

    function visitFactTriple(tr, parentDf) {
      const key = proofTripleKey(tr);
      const base = baseFactByKey.get(key) || null;
      if (base) {
        remember({ kind: 'fact', fact: base, source: base.__source });
        return;
      }

      const candidates = derivedCandidatesForKey(key);
      const df = candidates.find((candidate) => candidate !== parentDf) || null;
      if (df) {
        visitDerivedFact(df);
        return;
      }

      if (tr && isBuiltinPred(tr.p)) {
        remember({ kind: 'builtin', fact: tr, builtin: tr.p });
        return;
      }

      if (resolveBackwardProof) {
        const proof = resolveBackwardProof(tr);
        if (proof) {
          visitProofNode(proof, tr, parentDf);
          return;
        }
      }

      remember({ kind: 'fact', fact: tr, source: null });
    }

    function visitDerivedFact(df, children) {
      if (!df || !df.fact) return;
      const entry = { kind: 'rule', df };
      if (!remember(entry)) return;

      if (Array.isArray(children) && children.length) {
        for (const child of children) visitProofNode(child, null, df);
        return;
      }
      for (const prem of df.premises || []) visitFactTriple(prem, df);
    }

    visitDerivedFact(rootDf);
    return entries;
  }

  function collectProofOutputTriples(outputDerived) {
    const out = [];
    const seen = new Set();
    for (const df of outputDerived || []) {
      if (!df || !df.fact) continue;
      const key = proofTripleKey(df.fact);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(df.fact);
    }
    return out;
  }

  function renderProofEntry(entry, prefixes) {
    if (!entry) return '';
    if (entry.kind === 'fact') {
      return `  ${graphForTriple(entry.fact, prefixes)}\n    pe:by ${byBlankNode('fact', entry.source)}.`;
    }
    if (entry.kind === 'builtin') {
      return `  ${graphForTriple(entry.fact, prefixes)}\n    pe:by [ pe:builtin ${termToN3(entry.builtin, prefixes)} ].`;
    }

    const df = entry.df;
    const bindingItems = renderBindingItems(df, prefixes);
    const useItems = (df.premises || []).map((prem) => graphForTriple(prem, prefixes));
    const propertyGroups = [
      { predicate: 'pe:by', objects: [byBlankNode('rule', df.rule && df.rule.__source)] },
      { predicate: 'pe:binding', objects: bindingItems },
      { predicate: 'pe:uses', objects: useItems },
    ].filter((group) => group.objects.length);

    let out = `  ${graphForTriple(df.fact, prefixes)}\n`;
    for (let i = 0; i < propertyGroups.length; i++) {
      const group = propertyGroups[i];
      out += renderPredicateObjects(group.predicate, group.objects, i === propertyGroups.length - 1).join('\n') + '\n';
    }
    return out.trimEnd();
  }

  function renderProofBlock(rootDf, derivedByKey, baseFactByKey, prefixes, resolveBackwardProof) {
    const entries = collectProofEntries(rootDf, derivedByKey, baseFactByKey, resolveBackwardProof);
    const rootGraph = graphForTriple(rootDf.fact, prefixes);
    const proofBody = entries.map((entry) => renderProofEntry(entry, prefixes)).join('\n\n');
    const proofGraph = proofBody ? `{
${proofBody}
}` : '{}';
    return `${rootGraph} pe:why ${proofGraph}.`;
  }

  function renderProofDocument(outputDerived, allDerived, baseFacts, prefixes, backRules) {
    const selectedDerived = Array.isArray(outputDerived) ? outputDerived.filter((df) => df && df.fact) : [];
    if (!selectedDerived.length) return '';

    const proofPrefixes = clonePrefixEnvWithProofVocabulary(prefixes);
    const derivedByKey = new Map();
    function addDerived(df) {
      if (!df || !df.fact) return;
      const key = proofTripleKey(df.fact);
      let bucket = derivedByKey.get(key);
      if (!bucket) {
        bucket = [];
        derivedByKey.set(key, bucket);
      }
      if (!bucket.includes(df)) bucket.push(df);
    }
    for (const df of allDerived || []) addDerived(df);
    for (const df of selectedDerived) addDerived(df);

    const baseFactByKey = new Map();
    for (const tr of baseFacts || []) {
      if (!tr) continue;
      const key = proofTripleKey(tr);
      if (!baseFactByKey.has(key)) baseFactByKey.set(key, tr);
    }

    const resolveBackwardProof = findBackwardProofForGoal
      ? (tr) => findBackwardProofForGoal(tr, baseFacts || [], backRules || [], { maxDepth: 64 })
      : null;

    const outputTriples = collectProofOutputTriples(selectedDerived);
    const proofRelationTriples = [];
    for (const df of selectedDerived) {
      proofRelationTriples.push({ s: new GraphTerm([df.fact]), p: new Iri(PE_NS + 'why'), o: new GraphTerm([]) });
      for (const entry of collectProofEntries(df, derivedByKey, baseFactByKey, resolveBackwardProof)) {
        const fact = entry.kind === 'rule' ? entry.df.fact : entry.fact;
        const byObject = entry.kind === 'builtin' && entry.builtin ? entry.builtin : new Iri(PE_NS + 'source');
        proofRelationTriples.push({ s: new GraphTerm([fact]), p: new Iri(PE_NS + 'by'), o: byObject });
        if (entry.kind === 'rule') {
          for (const prem of entry.df.premises || []) proofRelationTriples.push({ s: new GraphTerm([fact]), p: new Iri(PE_NS + 'uses'), o: new GraphTerm([prem]) });
        }
      }
    }

    const usedPrefixes = proofPrefixes.prefixesUsedForOutput(outputTriples.concat(proofRelationTriples));
    if (!usedPrefixes.some(([pfx]) => pfx === 'pe')) usedPrefixes.push(['pe', PE_NS]);
    usedPrefixes.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

    const parts = [];
    for (const [pfx, base] of usedPrefixes) {
      if (!base) continue;
      if (pfx === '') parts.push(`@prefix : <${base}> .`);
      else parts.push(`@prefix ${pfx}: <${base}> .`);
    }
    if (parts.length) parts.push('');

    parts.push(...outputTriples.map((tr) => tripleToN3(tr, proofPrefixes)));
    parts.push('');
    for (let i = 0; i < selectedDerived.length; i++) {
      if (i > 0) parts.push('');
      parts.push(renderProofBlock(selectedDerived[i], derivedByKey, baseFactByKey, proofPrefixes, resolveBackwardProof));
    }

    return parts.join('\n').replace(/[ \t]+$/gm, '').replace(/\s*$/g, '') + '\n';
  }

  // ===========================================================================
  // CLI entry point
  // ===========================================================================
  // ===========================================================================
  // log:outputString support
  // ===========================================================================

  function compareOutputStringKeys(a, b) {
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

  function addMarkdownHardBreaks(text) {
    const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalized.startsWith('# ')) return text;

    return normalized
      .split('\n')
      .map((line) => {
        if (line.length === 0) return line;
        return line.replace(/[ \t]+$/g, '') + '  ';
      })
      .join('\n');
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
      const c = compareOutputStringKeys(a.key, b.key, prefixes);
      if (c !== 0) return c;
      return a.idx - b.idx; // stable tie-breaker
    });

    return addMarkdownHardBreaks(pairs.map((p) => p.text).join(''));
  }

  return { printExplanation, renderProofDocument, collectOutputStringsFromFacts };
}

module.exports = { makeExplain };
