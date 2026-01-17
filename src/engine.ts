// @ts-nocheck
/* eslint-disable */
// ===========================================================================
// Unification + substitution
// ===========================================================================

function containsVarTerm(t, v) {
  if (t instanceof Var) return t.name === v;
  if (t instanceof ListTerm) return t.elems.some((e) => containsVarTerm(e, v));
  if (t instanceof OpenListTerm) return t.prefix.some((e) => containsVarTerm(e, v)) || t.tailVar === v;
  if (t instanceof GraphTerm)
    return t.triples.some((tr) => containsVarTerm(tr.s, v) || containsVarTerm(tr.p, v) || containsVarTerm(tr.o, v));
  return false;
}

function isGroundTermInGraph(t) {
  // variables inside graph terms are treated as local placeholders,
  // so they don't make the *surrounding triple* non-ground.
  if (t instanceof OpenListTerm) return false;
  if (t instanceof ListTerm) return t.elems.every((e) => isGroundTermInGraph(e));
  if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
  // Iri/Literal/Blank/Var are all OK inside formulas
  return true;
}

function isGroundTripleInGraph(tr) {
  return isGroundTermInGraph(tr.s) && isGroundTermInGraph(tr.p) && isGroundTermInGraph(tr.o);
}

function isGroundTerm(t) {
  if (t instanceof Var) return false;
  if (t instanceof ListTerm) return t.elems.every((e) => isGroundTerm(e));
  if (t instanceof OpenListTerm) return false;
  if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
  return true;
}

function isGroundTriple(tr) {
  return isGroundTerm(tr.s) && isGroundTerm(tr.p) && isGroundTerm(tr.o);
}

// Canonical JSON-ish encoding for use as a Skolem cache key.
// We only *call* this on ground terms in log:skolem, but it is
// robust to seeing vars/open lists anyway.
function skolemKeyFromTerm(t) {
  function enc(u) {
    if (u instanceof Iri) return ['I', u.value];
    if (u instanceof Literal) return ['L', u.value];
    if (u instanceof Blank) return ['B', u.label];
    if (u instanceof Var) return ['V', u.name];
    if (u instanceof ListTerm) return ['List', u.elems.map(enc)];
    if (u instanceof OpenListTerm) return ['OpenList', u.prefix.map(enc), u.tailVar];
    if (u instanceof GraphTerm) return ['Graph', u.triples.map((tr) => [enc(tr.s), enc(tr.p), enc(tr.o)])];
    return ['Other', String(u)];
  }
  return JSON.stringify(enc(t));
}

function applySubstTerm(t, s) {
  // Common case: variable
  if (t instanceof Var) {
    // Fast path: unbound variable → no change
    const first = s[t.name];
    if (first === undefined) {
      return t;
    }

    // Follow chains X -> Y -> ... until we hit a non-var or a cycle.
    let cur = first;
    const seen = new Set([t.name]);
    while (cur instanceof Var) {
      const name = cur.name;
      if (seen.has(name)) break; // cycle
      seen.add(name);
      const nxt = s[name];
      if (!nxt) break;
      cur = nxt;
    }

    if (cur instanceof Var) {
      // Still a var: keep it as is (no need to clone)
      return cur;
    }
    // Bound to a non-var term: apply substitution recursively in case it
    // contains variables inside.
    return applySubstTerm(cur, s);
  }

  // Non-variable terms
  if (t instanceof ListTerm) {
    return new ListTerm(t.elems.map((e) => applySubstTerm(e, s)));
  }

  if (t instanceof OpenListTerm) {
    const newPrefix = t.prefix.map((e) => applySubstTerm(e, s));
    const tailTerm = s[t.tailVar];
    if (tailTerm !== undefined) {
      const tailApplied = applySubstTerm(tailTerm, s);
      if (tailApplied instanceof ListTerm) {
        return new ListTerm(newPrefix.concat(tailApplied.elems));
      } else if (tailApplied instanceof OpenListTerm) {
        return new OpenListTerm(newPrefix.concat(tailApplied.prefix), tailApplied.tailVar);
      } else {
        return new OpenListTerm(newPrefix, t.tailVar);
      }
    } else {
      return new OpenListTerm(newPrefix, t.tailVar);
    }
  }

  if (t instanceof GraphTerm) {
    return new GraphTerm(t.triples.map((tr) => applySubstTriple(tr, s)));
  }

  return t;
}

function applySubstTriple(tr, s) {
  return new Triple(applySubstTerm(tr.s, s), applySubstTerm(tr.p, s), applySubstTerm(tr.o, s));
}

function iriValue(t) {
  return t instanceof Iri ? t.value : null;
}

function unifyOpenWithList(prefix, tailv, ys, subst) {
  if (ys.length < prefix.length) return null;
  let s2 = { ...subst };
  for (let i = 0; i < prefix.length; i++) {
    s2 = unifyTerm(prefix[i], ys[i], s2);
    if (s2 === null) return null;
  }
  const rest = new ListTerm(ys.slice(prefix.length));
  s2 = unifyTerm(new Var(tailv), rest, s2);
  if (s2 === null) return null;
  return s2;
}

function unifyGraphTriples(xs, ys, subst) {
  if (xs.length !== ys.length) return null;

  // Fast path: exact same sequence.
  if (triplesListEqual(xs, ys)) return { ...subst };

  // Backtracking match (order-insensitive), *threading* the substitution through.
  const used = new Array(ys.length).fill(false);

  function step(i, s) {
    if (i >= xs.length) return s;
    const x = xs[i];

    for (let j = 0; j < ys.length; j++) {
      if (used[j]) continue;
      const y = ys[j];

      // Cheap pruning when both predicates are IRIs.
      if (x.p instanceof Iri && y.p instanceof Iri && x.p.value !== y.p.value) continue;

      const s2 = unifyTriple(x, y, s); // IMPORTANT: use `s`, not {}
      if (s2 === null) continue;

      used[j] = true;
      const s3 = step(i + 1, s2);
      if (s3 !== null) return s3;
      used[j] = false;
    }
    return null;
  }

  return step(0, { ...subst }); // IMPORTANT: start from the incoming subst
}

function unifyTerm(a, b, subst) {
  return unifyTermWithOptions(a, b, subst, {
    boolValueEq: true,
    intDecimalEq: false,
  });
}

function unifyTermListAppend(a, b, subst) {
  // Keep list:append behavior: allow integer<->decimal exact equality,
  // but do NOT add boolean-value equivalence (preserves current semantics).
  return unifyTermWithOptions(a, b, subst, {
    boolValueEq: false,
    intDecimalEq: true,
  });
}

function unifyTermWithOptions(a, b, subst, opts) {
  a = applySubstTerm(a, subst);
  b = applySubstTerm(b, subst);

  // Variable binding
  if (a instanceof Var) {
    const v = a.name;
    const t = b;
    if (t instanceof Var && t.name === v) return { ...subst };
    if (containsVarTerm(t, v)) return null;
    const s2 = { ...subst };
    s2[v] = t;
    return s2;
  }
  if (b instanceof Var) {
    return unifyTermWithOptions(b, a, subst, opts);
  }

  // Exact matches
  if (a instanceof Iri && b instanceof Iri && a.value === b.value) return { ...subst };
  if (a instanceof Literal && b instanceof Literal && a.value === b.value) return { ...subst };
  if (a instanceof Blank && b instanceof Blank && a.label === b.label) return { ...subst };

  // Plain string vs xsd:string equivalence
  if (a instanceof Literal && b instanceof Literal) {
    if (literalsEquivalentAsXsdString(a.value, b.value)) return { ...subst };
  }

  // Boolean-value equivalence (ONLY for normal unifyTerm)
  if (opts.boolValueEq && a instanceof Literal && b instanceof Literal) {
    const ai = parseBooleanLiteralInfo(a);
    const bi = parseBooleanLiteralInfo(b);
    if (ai && bi && ai.value === bi.value) return { ...subst };
  }

  // Numeric-value match:
  // - always allow equality when datatype matches (existing behavior)
  // - optionally allow integer<->decimal exact equality (list:append only)
  if (a instanceof Literal && b instanceof Literal) {
    const ai = parseNumericLiteralInfo(a);
    const bi = parseNumericLiteralInfo(b);
    if (ai && bi) {
      if (ai.dt === bi.dt) {
        if (ai.kind === 'bigint' && bi.kind === 'bigint') {
          if (ai.value === bi.value) return { ...subst };
        } else {
          const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
          const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
          if (!Number.isNaN(an) && !Number.isNaN(bn) && an === bn) return { ...subst };
        }
      }

      if (opts.intDecimalEq) {
        const intDt = XSD_NS + 'integer';
        const decDt = XSD_NS + 'decimal';
        if ((ai.dt === intDt && bi.dt === decDt) || (ai.dt === decDt && bi.dt === intDt)) {
          const intInfo = ai.dt === intDt ? ai : bi; // bigint
          const decInfo = ai.dt === decDt ? ai : bi; // number + lexStr
          const dec = parseXsdDecimalToBigIntScale(decInfo.lexStr);
          if (dec) {
            const scaledInt = intInfo.value * pow10n(dec.scale);
            if (scaledInt === dec.num) return { ...subst };
          }
        }
      }
    }
  }

  // Open list vs concrete list
  if (a instanceof OpenListTerm && b instanceof ListTerm) {
    return unifyOpenWithList(a.prefix, a.tailVar, b.elems, subst);
  }
  if (a instanceof ListTerm && b instanceof OpenListTerm) {
    return unifyOpenWithList(b.prefix, b.tailVar, a.elems, subst);
  }

  // Open list vs open list
  if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
    if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return null;
    let s2 = { ...subst };
    for (let i = 0; i < a.prefix.length; i++) {
      s2 = unifyTermWithOptions(a.prefix[i], b.prefix[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // List terms
  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return null;
    let s2 = { ...subst };
    for (let i = 0; i < a.elems.length; i++) {
      s2 = unifyTermWithOptions(a.elems[i], b.elems[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // Graphs
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    if (alphaEqGraphTriples(a.triples, b.triples)) return { ...subst };
    return unifyGraphTriples(a.triples, b.triples, subst);
  }

  return null;
}

function unifyTriple(pat, fact, subst) {
  // Predicates are usually the cheapest and most selective
  const s1 = unifyTerm(pat.p, fact.p, subst);
  if (s1 === null) return null;

  const s2 = unifyTerm(pat.s, fact.s, s1);
  if (s2 === null) return null;

  const s3 = unifyTerm(pat.o, fact.o, s2);
  return s3;
}

function composeSubst(outer, delta) {
  if (!delta || Object.keys(delta).length === 0) {
    return { ...outer };
  }
  const out = { ...outer };
  for (const [k, v] of Object.entries(delta)) {
    if (out.hasOwnProperty(k)) {
      if (!termsEqual(out[k], v)) return null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ===========================================================================
// Backward proof (SLD-style)
// ===========================================================================

function standardizeRule(rule, gen) {
  function renameTerm(t, vmap, genArr) {
    if (t instanceof Var) {
      if (!vmap.hasOwnProperty(t.name)) {
        const name = `${t.name}__${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.name] = name;
      }
      return new Var(vmap[t.name]);
    }
    if (t instanceof ListTerm) {
      let changed = false;
      const elems2 = t.elems.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      return changed ? new ListTerm(elems2) : t;
    }
    if (t instanceof OpenListTerm) {
      let changed = false;
      const newXs = t.prefix.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      if (!vmap.hasOwnProperty(t.tailVar)) {
        const name = `${t.tailVar}__${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.tailVar] = name;
      }
      const newTail = vmap[t.tailVar];
      if (newTail !== t.tailVar) changed = true;
      return changed ? new OpenListTerm(newXs, newTail) : t;
    }
    if (t instanceof GraphTerm) {
      let changed = false;
      const triples2 = t.triples.map((tr) => {
        const s2 = renameTerm(tr.s, vmap, genArr);
        const p2 = renameTerm(tr.p, vmap, genArr);
        const o2 = renameTerm(tr.o, vmap, genArr);
        if (s2 !== tr.s || p2 !== tr.p || o2 !== tr.o) changed = true;
        return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
      });
      return changed ? new GraphTerm(triples2) : t;
    }
    return t;
  }

  const vmap2 = {};
  const premise = rule.premise.map((tr) => {
    const s2 = renameTerm(tr.s, vmap2, gen);
    const p2 = renameTerm(tr.p, vmap2, gen);
    const o2 = renameTerm(tr.o, vmap2, gen);
    return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
  });
  const conclusion = rule.conclusion.map((tr) => {
    const s2 = renameTerm(tr.s, vmap2, gen);
    const p2 = renameTerm(tr.p, vmap2, gen);
    const o2 = renameTerm(tr.o, vmap2, gen);
    return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
  });
  return new Rule(premise, conclusion, rule.isForward, rule.isFuse, rule.headBlankLabels);
}

function listHasTriple(list, tr) {
  return list.some((t) => triplesEqual(t, tr));
}

// ===========================================================================
// Substitution compaction (to avoid O(depth^2) in deep backward chains)
// ===========================================================================
//
// Why: backward chaining with standardizeRule introduces fresh variables at
// each step. composeSubst frequently copies a growing substitution object.
// For deep linear recursions this becomes quadratic.
//
// Strategy: when the substitution is "large" or search depth is high,
// keep only bindings that are still relevant to:
//   - variables appearing in the remaining goals
//   - variables from the original goals (answer vars)
// plus the transitive closure of variables that appear inside kept bindings.
//
// This is semantics-preserving for the ongoing proof state.

function gcCollectVarsInTerm(t, out) {
  if (t instanceof Var) {
    out.add(t.name);
    return;
  }
  if (t instanceof ListTerm) {
    for (const e of t.elems) gcCollectVarsInTerm(e, out);
    return;
  }
  if (t instanceof OpenListTerm) {
    for (const e of t.prefix) gcCollectVarsInTerm(e, out);
    out.add(t.tailVar);
    return;
  }
  if (t instanceof GraphTerm) {
    for (const tr of t.triples) gcCollectVarsInTriple(tr, out);
    return;
  }
}

function gcCollectVarsInTriple(tr, out) {
  gcCollectVarsInTerm(tr.s, out);
  gcCollectVarsInTerm(tr.p, out);
  gcCollectVarsInTerm(tr.o, out);
}

function gcCollectVarsInGoals(goals, out) {
  for (const g of goals) gcCollectVarsInTriple(g, out);
}

function substSizeOver(subst, limit) {
  let c = 0;
  for (const _k in subst) {
    if (++c > limit) return true;
  }
  return false;
}

function gcCompactForGoals(subst, goals, answerVars) {
  const keep = new Set(answerVars);
  gcCollectVarsInGoals(goals, keep);

  const expanded = new Set();
  const queue = Array.from(keep);

  while (queue.length) {
    const v = queue.pop();
    if (expanded.has(v)) continue;
    expanded.add(v);

    const bound = subst[v];
    if (bound === undefined) continue;

    const before = keep.size;
    gcCollectVarsInTerm(bound, keep);
    if (keep.size !== before) {
      for (const nv of keep) {
        if (!expanded.has(nv)) queue.push(nv);
      }
    }
  }

  const out = {};
  for (const k of Object.keys(subst)) {
    if (keep.has(k)) out[k] = subst[k];
  }
  return out;
}

function maybeCompactSubst(subst, goals, answerVars, depth) {
  // Keep the fast path fast.
  // Only compact when the substitution is clearly getting large, or
  // we are in a deep chain (where the quadratic behavior shows up).
  if (depth < 128 && !substSizeOver(subst, 256)) return subst;
  return gcCompactForGoals(subst, goals, answerVars);
}

function proveGoals(goals, subst, facts, backRules, depth, visited, varGen, maxResults) {
  // Iterative DFS over proof states using an explicit stack.
  // Each state carries its own substitution and remaining goals.
  const results = [];
  const max = typeof maxResults === 'number' && maxResults > 0 ? maxResults : Infinity;

  const initialGoals = Array.isArray(goals) ? goals.slice() : [];
  const initialSubst = subst ? { ...subst } : {};
  const initialVisited = visited ? visited.slice() : [];

  // Variables from the original goal list (needed by the caller to instantiate conclusions)
  const answerVars = new Set();
  gcCollectVarsInGoals(initialGoals, answerVars);
  if (!initialGoals.length) {
    results.push(gcCompactForGoals(initialSubst, [], answerVars));

    if (results.length >= max) return results;
    return results;
  }

  const stack = [
    {
      goals: initialGoals,
      subst: initialSubst,
      depth: depth || 0,
      visited: initialVisited,
    },
  ];

  while (stack.length) {
    const state = stack.pop();

    if (!state.goals.length) {
      results.push(gcCompactForGoals(state.subst, [], answerVars));

      if (results.length >= max) return results;
      continue;
    }

    const rawGoal = state.goals[0];
    const restGoals = state.goals.slice(1);
    const goal0 = applySubstTriple(rawGoal, state.subst);

    // 1) Builtins
    if (isBuiltinPred(goal0.p)) {
      const remaining = max - results.length;
      if (remaining <= 0) return results;
      const builtinMax = Number.isFinite(remaining) && !restGoals.length ? remaining : undefined;
      const deltas = evalBuiltin(goal0, {}, facts, backRules, state.depth, varGen, builtinMax);
      const nextStates = [];
      for (const delta of deltas) {
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
          });
        }
      }
      // Push in reverse so the *first* generated alternative is explored first (LIFO stack).
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
      continue;
    }

    // 2) Loop check for backward reasoning
    if (listHasTriple(state.visited, goal0)) continue;
    const visitedForRules = state.visited.concat([goal0]);

    // 3) Try to satisfy the goal from known facts (NOW indexed by (p,o) when possible)
    if (goal0.p instanceof Iri) {
      const candidates = candidateFacts(facts, goal0);
      const nextStates = [];
      for (const f of candidates) {
        const delta = unifyTriple(goal0, f, {});
        if (delta === null) continue;
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
          });
        }
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    } else {
      // Non-IRI predicate → must try all facts.
      const nextStates = [];
      for (const f of facts) {
        const delta = unifyTriple(goal0, f, {});
        if (delta === null) continue;
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
          });
        }
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    }

    // 4) Backward rules (indexed by head predicate)
    if (goal0.p instanceof Iri) {
      ensureBackRuleIndexes(backRules);
      const candRules = (backRules.__byHeadPred.get(goal0.p.value) || []).concat(backRules.__wildHeadPred);

      const nextStates = [];
      for (const r of candRules) {
        if (r.conclusion.length !== 1) continue;
        const rawHead = r.conclusion[0];
        if (rawHead.p instanceof Iri && rawHead.p.value !== goal0.p.value) continue;
        const rStd = standardizeRule(r, varGen);
        const head = rStd.conclusion[0];
        const deltaHead = unifyTriple(head, goal0, {});
        if (deltaHead === null) continue;
        const body = rStd.premise.map((b) => applySubstTriple(b, deltaHead));
        const composed = composeSubst(state.subst, deltaHead);
        if (composed === null) continue;
        const newGoals = body.concat(restGoals);
        const nextSubst = maybeCompactSubst(composed, newGoals, answerVars, state.depth + 1);
        nextStates.push({
          goals: newGoals,
          subst: nextSubst,
          depth: state.depth + 1,
          visited: visitedForRules,
        });
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    }
  }

  return results;
}

// ===========================================================================
// Forward chaining to fixpoint
// ===========================================================================

function forwardChain(facts, forwardRules, backRules, onDerived /* optional */) {
  ensureFactIndexes(facts);
  ensureBackRuleIndexes(backRules);

  const factList = facts.slice();
  const derivedForward = [];
  const varGen = [0];
  const skCounter = [0];

  // Cache head blank-node skolemization per (rule firing, head blank label).
  // This prevents repeatedly generating fresh _:sk_N blanks for the *same*
  // rule+substitution instance across outer fixpoint iterations.
  const headSkolemCache = new Map();

  function firingKey(ruleIndex, instantiatedPremises) {
    // Deterministic key derived from the instantiated body (ground per substitution).
    const parts = [];
    for (const tr of instantiatedPremises) {
      parts.push(JSON.stringify([skolemKeyFromTerm(tr.s), skolemKeyFromTerm(tr.p), skolemKeyFromTerm(tr.o)]));
    }
    return `R${ruleIndex}|` + parts.join('\\n');
  }

  // Make rules visible to introspection builtins
  backRules.__allForwardRules = forwardRules;
  backRules.__allBackwardRules = backRules;

  // Closure level counter used by log:collectAllIn/log:forAllIn priority gating.
  // Level 0 means "no frozen snapshot" (during Phase A of each outer iteration).
  let scopedClosureLevel = 0;

  // Scan known rules for the maximum requested closure priority in
  // log:collectAllIn / log:forAllIn goals.
  function computeMaxScopedClosurePriorityNeeded() {
    let maxP = 0;
    function scanTriple(tr) {
      if (!(tr && tr.p instanceof Iri)) return;
      const pv = tr.p.value;

      // log:collectAllIn / log:forAllIn use the object position for the priority.
      if (pv === LOG_NS + 'collectAllIn' || pv === LOG_NS + 'forAllIn') {
        // Explicit scope graphs are immediate and do not require a closure.
        if (tr.o instanceof GraphTerm) return;
        // Variable or non-numeric object => default priority 1 (if used).
        if (tr.o instanceof Var) {
          if (maxP < 1) maxP = 1;
          return;
        }
        const p0 = __logNaturalPriorityFromTerm(tr.o);
        if (p0 !== null) {
          if (p0 > maxP) maxP = p0;
        } else {
          if (maxP < 1) maxP = 1;
        }
        return;
      }

      // log:includes / log:notIncludes use the subject position for the priority.
      if (pv === LOG_NS + 'includes' || pv === LOG_NS + 'notIncludes') {
        // Explicit scope graphs are immediate and do not require a closure.
        if (tr.s instanceof GraphTerm) return;
        // Variable or non-numeric subject => default priority 1 (if used).
        if (tr.s instanceof Var) {
          if (maxP < 1) maxP = 1;
          return;
        }
        const p0 = __logNaturalPriorityFromTerm(tr.s);
        if (p0 !== null) {
          if (p0 > maxP) maxP = p0;
        } else {
          if (maxP < 1) maxP = 1;
        }
      }
    }

    for (const r of forwardRules) {
      for (const tr of r.premise) scanTriple(tr);
    }
    for (const r of backRules) {
      for (const tr of r.premise) scanTriple(tr);
    }
    return maxP;
  }

  let maxScopedClosurePriorityNeeded = computeMaxScopedClosurePriorityNeeded();

  function setScopedSnapshot(snap, level) {
    if (!Object.prototype.hasOwnProperty.call(facts, '__scopedSnapshot')) {
      Object.defineProperty(facts, '__scopedSnapshot', {
        value: snap,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    } else {
      facts.__scopedSnapshot = snap;
    }

    if (!Object.prototype.hasOwnProperty.call(facts, '__scopedClosureLevel')) {
      Object.defineProperty(facts, '__scopedClosureLevel', {
        value: level,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    } else {
      facts.__scopedClosureLevel = level;
    }
  }

  function makeScopedSnapshot() {
    const snap = facts.slice();
    ensureFactIndexes(snap);
    Object.defineProperty(snap, '__scopedSnapshot', {
      value: snap,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    // Propagate closure level so nested scoped builtins can see it.
    Object.defineProperty(snap, '__scopedClosureLevel', {
      value: scopedClosureLevel,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return snap;
  }

  function runFixpoint() {
    let anyChange = false;

    while (true) {
      let changed = false;

      for (let i = 0; i < forwardRules.length; i++) {
        const r = forwardRules[i];
        const empty = {};
        const visited = [];
        // Optimization: if the rule head is **structurally ground** (no vars anywhere, even inside
        // quoted formulas) and has no head blanks, then the head does not depend on which body
        // solution we pick. In that case, we only need *one* proof of the body, and once all head
        // triples are already known we can skip proving the body entirely.
        function isStrictGroundTerm(t) {
          if (t instanceof Var) return false;
          if (t instanceof Blank) return false;
          if (t instanceof OpenListTerm) return false;
          if (t instanceof ListTerm) return t.elems.every(isStrictGroundTerm);
          if (t instanceof GraphTerm) return t.triples.every(isStrictGroundTriple);
          return true; // Iri/Literal and any other atomic terms
        }
        function isStrictGroundTriple(tr) {
          return isStrictGroundTerm(tr.s) && isStrictGroundTerm(tr.p) && isStrictGroundTerm(tr.o);
        }

        const headIsStrictGround =
          !r.isFuse && (!r.headBlankLabels || r.headBlankLabels.size === 0) && r.conclusion.every(isStrictGroundTriple);

        if (headIsStrictGround) {
          let allKnown = true;
          for (const tr of r.conclusion) {
            if (!hasFactIndexed(facts, tr)) {
              allKnown = false;
              break;
            }
          }
          if (allKnown) continue;
        }

        const maxSols = r.isFuse || headIsStrictGround ? 1 : undefined;
        const sols = proveGoals(r.premise.slice(), empty, facts, backRules, 0, visited, varGen, maxSols);

        // Inference fuse
        if (r.isFuse && sols.length) {
          console.log('# Inference fuse triggered: a { ... } => false. rule fired.');
          process.exit(2);
        }

        for (const s of sols) {
          // IMPORTANT: one skolem map per *rule firing*
          const skMap = {};
          const instantiatedPremises = r.premise.map((b) => applySubstTriple(b, s));
          const fireKey = firingKey(i, instantiatedPremises);

          for (const cpat of r.conclusion) {
            const instantiated = applySubstTriple(cpat, s);

            const isFwRuleTriple =
              isLogImplies(instantiated.p) &&
              ((instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm) ||
                (instantiated.s instanceof Literal &&
                  instantiated.s.value === 'true' &&
                  instantiated.o instanceof GraphTerm) ||
                (instantiated.s instanceof GraphTerm &&
                  instantiated.o instanceof Literal &&
                  instantiated.o.value === 'true'));

            const isBwRuleTriple =
              isLogImpliedBy(instantiated.p) &&
              ((instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm) ||
                (instantiated.s instanceof GraphTerm &&
                  instantiated.o instanceof Literal &&
                  instantiated.o.value === 'true') ||
                (instantiated.s instanceof Literal &&
                  instantiated.s.value === 'true' &&
                  instantiated.o instanceof GraphTerm));

            if (isFwRuleTriple || isBwRuleTriple) {
              if (!hasFactIndexed(facts, instantiated)) {
                factList.push(instantiated);
                pushFactIndexed(facts, instantiated);
                const df = new DerivedFact(instantiated, r, instantiatedPremises.slice(), { ...s });
                derivedForward.push(df);
                if (typeof onDerived === 'function') onDerived(df);

                changed = true;
              }

              // Promote rule-producing triples to live rules, treating literal true as {}.
              const left =
                instantiated.s instanceof GraphTerm
                  ? instantiated.s.triples
                  : instantiated.s instanceof Literal && instantiated.s.value === 'true'
                    ? []
                    : null;

              const right =
                instantiated.o instanceof GraphTerm
                  ? instantiated.o.triples
                  : instantiated.o instanceof Literal && instantiated.o.value === 'true'
                    ? []
                    : null;

              if (left !== null && right !== null) {
                if (isFwRuleTriple) {
                  const [premise0, conclusion] = liftBlankRuleVars(left, right);
                  const premise = reorderPremiseForConstraints(premise0);
                  const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                  const newRule = new Rule(premise, conclusion, true, false, headBlankLabels);

                  const already = forwardRules.some(
                    (rr) =>
                      rr.isForward === newRule.isForward &&
                      rr.isFuse === newRule.isFuse &&
                      triplesListEqual(rr.premise, newRule.premise) &&
                      triplesListEqual(rr.conclusion, newRule.conclusion),
                  );
                  if (!already) forwardRules.push(newRule);
                } else if (isBwRuleTriple) {
                  const [premise, conclusion] = liftBlankRuleVars(right, left);
                  const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                  const newRule = new Rule(premise, conclusion, false, false, headBlankLabels);

                  const already = backRules.some(
                    (rr) =>
                      rr.isForward === newRule.isForward &&
                      rr.isFuse === newRule.isFuse &&
                      triplesListEqual(rr.premise, newRule.premise) &&
                      triplesListEqual(rr.conclusion, newRule.conclusion),
                  );
                  if (!already) {
                    backRules.push(newRule);
                    indexBackRule(backRules, newRule);
                  }
                }
              }

              continue; // skip normal fact handling
            }

            // Only skolemize blank nodes that occur explicitly in the rule head
            const inst = skolemizeTripleForHeadBlanks(
              instantiated,
              r.headBlankLabels,
              skMap,
              skCounter,
              fireKey,
              headSkolemCache,
            );

            if (!isGroundTriple(inst)) continue;
            if (hasFactIndexed(facts, inst)) continue;

            factList.push(inst);
            pushFactIndexed(facts, inst);
            const df = new DerivedFact(inst, r, instantiatedPremises.slice(), {
              ...s,
            });
            derivedForward.push(df);
            if (typeof onDerived === 'function') onDerived(df);

            changed = true;
          }
        }
      }

      if (!changed) break;
      anyChange = true;
    }

    return anyChange;
  }

  while (true) {
    // Phase A: scoped builtins disabled => they “delay” (fail) during saturation
    setScopedSnapshot(null, 0);
    const changedA = runFixpoint();

    // Freeze saturated scope
    scopedClosureLevel += 1;
    const snap = makeScopedSnapshot();

    // Phase B: scoped builtins enabled, but they query only `snap`
    setScopedSnapshot(snap, scopedClosureLevel);
    const changedB = runFixpoint();

    // Rules may have been added dynamically (rule-producing triples), possibly
    // introducing higher closure priorities. Keep iterating until we have
    // reached the maximum requested priority and no further changes occur.
    maxScopedClosurePriorityNeeded = Math.max(maxScopedClosurePriorityNeeded, computeMaxScopedClosurePriorityNeeded());

    if (!changedA && !changedB && scopedClosureLevel >= maxScopedClosurePriorityNeeded) break;
  }

  setScopedSnapshot(null, 0);

  return derivedForward;
}

// ===========================================================================
// Pretty printing as N3/Turtle
// ===========================================================================

function termToN3(t, pref) {
  if (t instanceof Iri) {
    const i = t.value;
    const q = pref.shrinkIri(i);
    if (q !== null) return q;
    if (i.startsWith('_:')) return i;
    return `<${i}>`;
  }
  if (t instanceof Literal) {
    const [lex, dt] = literalParts(t.value);

    // Pretty-print xsd:boolean as bare true/false
    if (dt === XSD_NS + 'boolean') {
      const v = stripQuotes(lex);
      if (v === 'true' || v === 'false') return v;
      // optional: normalize 1/0 too
      if (v === '1') return 'true';
      if (v === '0') return 'false';
    }

    if (!dt) return t.value; // keep numbers, booleans, lang-tagged strings, etc.
    const qdt = pref.shrinkIri(dt);
    if (qdt !== null) return `${lex}^^${qdt}`; // e.g. ^^rdf:JSON
    return `${lex}^^<${dt}>`; // fallback
  }
  if (t instanceof Var) return `?${t.name}`;
  if (t instanceof Blank) return t.label;
  if (t instanceof ListTerm) {
    const inside = t.elems.map((e) => termToN3(e, pref));
    return '(' + inside.join(' ') + ')';
  }
  if (t instanceof OpenListTerm) {
    const inside = t.prefix.map((e) => termToN3(e, pref));
    inside.push('?' + t.tailVar);
    return '(' + inside.join(' ') + ')';
  }
  if (t instanceof GraphTerm) {
    const indent = '    ';
    const indentBlock = (str) =>
      str
        .split(/\r?\n/)
        .map((ln) => (ln.length ? indent + ln : ln))
        .join('\n');

    let s = '{\n';
    for (const tr of t.triples) {
      const block = tripleToN3(tr, pref).trimEnd();
      if (block) s += indentBlock(block) + '\n';
    }
    s += '}';
    return s;
  }
  return JSON.stringify(t);
}

function tripleToN3(tr, prefixes) {
  // log:implies / log:impliedBy as => / <= syntactic sugar everywhere
  if (isLogImplies(tr.p)) {
    const s = termToN3(tr.s, prefixes);
    const o = termToN3(tr.o, prefixes);
    return `${s} => ${o} .`;
  }

  if (isLogImpliedBy(tr.p)) {
    const s = termToN3(tr.s, prefixes);
    const o = termToN3(tr.o, prefixes);
    return `${s} <= ${o} .`;
  }

  const s = termToN3(tr.s, prefixes);
  const p = isRdfTypePred(tr.p) ? 'a' : isOwlSameAsPred(tr.p) ? '=' : termToN3(tr.p, prefixes);
  const o = termToN3(tr.o, prefixes);

  return `${s} ${p} ${o} .`;
}

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

// ===========================================================================
// CLI entry point
// ===========================================================================
// ===========================================================================
// log:outputString support
// ===========================================================================

function __compareOutputStringKeys(a, b, prefixes) {
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

function __collectOutputStringsFromFacts(facts, prefixes) {
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

