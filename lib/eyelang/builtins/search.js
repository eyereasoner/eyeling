// Reusable finite-search builtins for examples that would otherwise spend most
// of their time in small relational generators.  These predicates are generic
// entry points (graph, CNF, QMC, and n-queens helpers), not compiled
// replacements for particular example predicate names.
import { atom, compound, deref, listFromItems, numberTerm, properListItems, unify } from '../term.js';
import { compareLexicalOrNumeric } from './arithmetic.js';

export const searchBuiltins = {
  register(registry) {
    registry.add('n_queens', 2, nQueens, { fallbackWhenNotReady: true, ready: firstIntReady });
    registry.add('weighted_hamiltonian_cycle', 4, weightedHamiltonianCycle, { fallbackWhenNotReady: true, ready: weightedGraphReady });
    registry.add('weighted_hamiltonian_path', 4, weightedHamiltonianPath, { fallbackWhenNotReady: true, ready: weightedGraphReady });
    registry.add('hamiltonian_cycle', 3, hamiltonianCycle, { fallbackWhenNotReady: true, ready: graphReady });
    registry.add('fixed_length_cycle', 4, fixedLengthCycle, { fallbackWhenNotReady: true, ready: fixedCycleReady });
    registry.add('bounded_path', 5, boundedPath, { fallbackWhenNotReady: true, ready: boundedPathReady });
    registry.add('cnf_model', 3, cnfModel, { fallbackWhenNotReady: true, ready: cnfReady });
    registry.add('qm_prime_implicants', 4, qmPrimeImplicants, { deterministic: true, ready: qmReady });
    registry.add('qm_minimal_cover', 4, qmMinimalCover, { deterministic: true, ready: qmReady });
  }
};

function firstIntReady(goal, env) { return intTerm(goal.args[0], env) !== null; }
function graphReady(goal, env) { return atomKey(deref(goal.args[0], env)) !== null && properListItems(goal.args[1], env) !== null; }
function weightedGraphReady(goal, env) { return graphReady(goal, env); }
function fixedCycleReady(goal, env) { return atomKey(deref(goal.args[0], env)) !== null && intTerm(goal.args[1], env) !== null; }
function boundedPathReady(goal, env) { return atomKey(deref(goal.args[0], env)) !== null && atomKey(deref(goal.args[1], env)) !== null && atomKey(deref(goal.args[2], env)) !== null && intTerm(goal.args[3], env) !== null; }
function cnfReady(goal, env) { return atomList(goal.args[0], env) !== null && clauseList(goal.args[1], env) !== null; }
function qmReady(goal, env) { return numberList(goal.args[0], env) !== null && numberList(goal.args[1], env) !== null && bitTable(goal.args[2], env) !== null; }


function* nQueens({ goal, env }) {
  // n_queens(N, Solution) performs the same finite search as the declarative
  // select/not_member version, but keeps occupied diagonals in sets.
  const n = intTerm(goal.args[0], env);
  if (n == null || n < 0 || n > 14) return;
  const cols = Array.from({ length: n }, (_, i) => i + 1);
  const chosen = [];
  const down = new Set();
  const up = new Set();
  function* place(row, remaining) {
    if (remaining.length === 0) { yield chosen.slice(); return; }
    for (let i = 0; i < remaining.length; i++) {
      const q = remaining[i];
      const d = row + q;
      const u = row - q;
      if (down.has(d) || up.has(u)) continue;
      chosen.push(q); down.add(d); up.add(u);
      const rest = remaining.slice(0, i).concat(remaining.slice(i + 1));
      yield* place(row + 1, rest);
      up.delete(u); down.delete(d); chosen.pop();
    }
  }
  for (const solution of place(1, cols)) {
    const next = env.clone();
    if (unify(goal.args[1], listFromItems(solution.map(numberTerm)), next)) yield next;
  }
}

function* weightedHamiltonianCycle({ solver, goal, env }) {
  // weighted_hamiltonian_cycle(EdgePred, Cities, Cycle, Cost) treats
  // EdgePred/3 facts as undirected weighted edges and enumerates
  // symmetry-broken cycles beginning at the first city.
  const predicate = atomKey(deref(goal.args[0], env));
  const cities = properListItems(goal.args[1], env);
  if (!predicate || !cities || cities.length < 2) return;
  const weights = edgeWeightMap(solver.program, predicate);
  if (!weights) return;
  const start = cities[0];
  const rest = cities.slice(1);
  for (const order of permutations(rest)) {
    if (compareLexicalOrNumeric(atomKey(order[0]), atomKey(order[order.length - 1])) >= 0) continue;
    const cost = weightedPathCost([start, ...order, start], weights);
    if (cost == null) continue;
    const next = env.clone();
    if (unify(goal.args[2], listFromItems([start, ...order, start]), next) && unify(goal.args[3], numberTerm(cost), next)) yield next;
  }
}

function* weightedHamiltonianPath({ solver, goal, env }) {
  // weighted_hamiltonian_path(EdgePred, Cities, Path, Cost) enumerates paths
  // from the first city through every remaining city exactly once.
  const predicate = atomKey(deref(goal.args[0], env));
  const cities = properListItems(goal.args[1], env);
  if (!predicate || !cities || cities.length < 1) return;
  const weights = edgeWeightMap(solver.program, predicate);
  if (!weights) return;
  const start = cities[0];
  const rest = cities.slice(1);
  for (const order of permutations(rest)) {
    const path = [start, ...order];
    const cost = weightedPathCost(path, weights);
    if (cost == null) continue;
    const next = env.clone();
    if (unify(goal.args[2], listFromItems(path), next) && unify(goal.args[3], numberTerm(cost), next)) yield next;
  }
}

function weightedPathCost(path, weights) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const w = weights.get(`${atomKey(path[i - 1])}\x1f${atomKey(path[i])}`);
    if (w == null) return null;
    cost += w;
  }
  return cost;
}

function edgeWeightMap(program, predicate) {
  const map = new Map();
  let count = 0;
  for (const clause of program.clauses) {
    if (clause.body.length !== 0) continue;
    const h = clause.head;
    if (h.type !== 'compound' || h.name !== predicate || h.arity !== 3) continue;
    const a = atomKey(h.args[0]), b = atomKey(h.args[1]);
    const w = intTerm(h.args[2], null);
    if (a == null || b == null || w == null) continue;
    map.set(`${a}\x1f${b}`, w);
    map.set(`${b}\x1f${a}`, w);
    count++;
  }
  return count ? map : null;
}

function* hamiltonianCycle({ solver, goal, env }) {
  // hamiltonian_cycle(EdgePred, Vertices, Cycle) treats EdgePred/2 facts as an
  // undirected graph and enumerates cycles starting at Vertices[0].
  const predicate = atomKey(deref(goal.args[0], env));
  const vertices = properListItems(goal.args[1], env);
  if (!predicate || !vertices || vertices.length < 2) return;
  const graph = undirectedGraph(solver.program, predicate);
  if (!graph) return;
  const start = atomKey(vertices[0]);
  if (start == null) return;
  const rest = vertices.slice(1).map(atomKey);
  if (rest.some((v) => v == null)) return;
  const path = [start];
  function* dfs(current, remaining) {
    if (remaining.length === 0) {
      if (!graph.has(`${current}\x1f${start}`)) return;
      const next = env.clone();
      if (unify(goal.args[2], listFromItems([...path, start].map(atom)), next)) yield next;
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const v = remaining[i];
      if (!graph.has(`${current}\x1f${v}`)) continue;
      path.push(v);
      yield* dfs(v, remaining.slice(0, i).concat(remaining.slice(i + 1)));
      path.pop();
    }
  }
  yield* dfs(start, rest);
}

function undirectedGraph(program, predicate) {
  const edges = new Set();
  let count = 0;
  for (const clause of program.clauses) {
    if (clause.body.length !== 0) continue;
    const h = clause.head;
    if (h.type !== 'compound' || h.name !== predicate || h.arity !== 2) continue;
    const a = atomKey(h.args[0]), b = atomKey(h.args[1]);
    if (a == null || b == null) continue;
    edges.add(`${a}\x1f${b}`);
    edges.add(`${b}\x1f${a}`);
    count++;
  }
  return count ? edges : null;
}

function* fixedLengthCycle({ solver, goal, env }) {
  // fixed_length_cycle(EdgePred, Length, Relation, Cycle) is useful for
  // labelled edge(Source, Relation, Target) data. It enumerates closed walks
  // of exactly Length steps and returns the relation label and node list.
  const predicate = atomKey(deref(goal.args[0], env));
  const length = intTerm(goal.args[1], env);
  if (!predicate || length == null || length < 0) return;
  const graph = labelledGraph(solver.program, predicate);
  if (!graph) return;

  const requestedRelation = atomKey(deref(goal.args[2], env));
  const requestedCycle = fixedLengthCycleRequestedPath(goal, env, length);
  if (requestedRelation && requestedCycle) {
    const byStart = graph.byRelation.get(requestedRelation);
    if (byStart && fixedLengthCyclePathExists(byStart, requestedCycle)) {
      const next = env.clone();
      if (unify(goal.args[2], atom(requestedRelation), next) && unify(goal.args[3], listFromItems(requestedCycle.map(atom)), next)) yield next;
    }
    return;
  }

  const relations = requestedRelation
    ? [[requestedRelation, graph.byRelation.get(requestedRelation)]].filter(([, byStart]) => byStart)
    : graph.byRelation.entries();
  for (const [relation, byStart] of relations) {
    for (const start of byStart.keys()) {
      const path = [atom(start)];
      yield* fixedLengthCycleDfs(goal, env, byStart, relation, start, start, length, path);
    }
  }
}

function fixedLengthCycleRequestedPath(goal, env, length) {
  const items = properListItems(goal.args[3], env);
  if (!items || items.length !== length + 1) return null;
  const nodes = items.map((item) => atomKey(deref(item, env)));
  if (nodes.some((node) => node == null)) return null;
  if (nodes[0] !== nodes[nodes.length - 1]) return null;
  return nodes;
}

function fixedLengthCyclePathExists(byStart, nodes) {
  for (let i = 0; i < nodes.length - 1; i++) {
    if (!(byStart.get(nodes[i]) ?? []).includes(nodes[i + 1])) return false;
  }
  return true;
}

function* fixedLengthCycleDfs(goal, env, byStart, relation, start, current, remaining, path) {
  if (remaining === 0) {
    if (current !== start) return;
    const next = env.clone();
    if (unify(goal.args[2], atom(relation), next) && unify(goal.args[3], listFromItems(path), next)) yield next;
    return;
  }
  const nexts = byStart.get(current) ?? [];
  for (const dst of nexts) {
    path.push(atom(dst));
    yield* fixedLengthCycleDfs(goal, env, byStart, relation, start, dst, remaining - 1, path);
    path.pop();
  }
}

function labelledGraph(program, predicate) {
  let count = 0;
  const byRelation = new Map();
  for (const clause of program.clauses) {
    if (clause.body.length !== 0) continue;
    const h = clause.head;
    if (h.type !== 'compound' || h.name !== predicate || h.arity !== 3) continue;
    const src = atomKey(h.args[0]), rel = atomKey(h.args[1]), dst = atomKey(h.args[2]);
    if (src == null || rel == null || dst == null) continue;
    let byStart = byRelation.get(rel);
    if (!byStart) byRelation.set(rel, byStart = new Map());
    let arr = byStart.get(src);
    if (!arr) byStart.set(src, arr = []);
    arr.push(dst); count++;
  }
  return count ? { byRelation } : null;
}


function* boundedPath({ solver, goal, env }) {
  // bounded_path(EdgePred, Source, Target, MaxEdges, Path) enumerates simple
  // directed paths with at most MaxEdges edges. EdgePred is read from EdgePred/2
  // facts in source order so declarative examples retain stable answer order.
  const predicate = atomKey(deref(goal.args[0], env));
  const source = atomKey(deref(goal.args[1], env));
  const target = atomKey(deref(goal.args[2], env));
  const maxEdges = intTerm(goal.args[3], env);
  if (!predicate || source == null || target == null || maxEdges == null || maxEdges < 0) return;
  const graph = directedAdjacency(solver.program, predicate);
  if (!graph) return;
  const path = [source];
  const visited = new Set([source]);
  function* dfs(current, remaining) {
    if (current === target) {
      const next = env.clone();
      if (unify(goal.args[4], listFromItems(path.map(atom)), next)) yield next;
      return;
    }
    if (remaining <= 0) return;
    for (const dst of graph.get(current) ?? []) {
      if (visited.has(dst)) continue;
      visited.add(dst);
      path.push(dst);
      yield* dfs(dst, remaining - 1);
      path.pop();
      visited.delete(dst);
    }
  }
  yield* dfs(source, maxEdges);
}

function directedAdjacency(program, predicate) {
  const map = new Map();
  let count = 0;
  for (const clause of program.clauses) {
    if (clause.body.length !== 0) continue;
    const h = clause.head;
    if (h.type !== 'compound' || h.name !== predicate || h.arity !== 2) continue;
    const a = atomKey(h.args[0]), b = atomKey(h.args[1]);
    if (a == null || b == null) continue;
    let arr = map.get(a);
    if (!arr) map.set(a, arr = []);
    arr.push(b);
    count++;
  }
  return count ? map : null;
}

function* cnfModel({ goal, env }) {
  // cnf_model(Variables, Clauses, Assignment) enumerates finite truth
  // assignments in false-before-true order.  It deliberately preserves the
  // proof multiplicity of the declarative clause_true/2 + cnf_true/2 program:
  // a clause with two true literals has two derivations.
  const variables = atomList(goal.args[0], env);
  const clauses = clauseList(goal.args[1], env);
  if (!variables || !clauses) return;
  for (const assignment of enumerateAssignments(variables)) {
    const derivations = cnfDerivationCount(clauses, assignment);
    if (derivations === 0) continue;
    const terms = variables.map((v) => compound('value', [atom(v), atom(assignment.get(v) ? 'true' : 'false')]));
    for (let i = 0; i < derivations; i++) {
      const next = env.clone();
      if (unify(goal.args[2], listFromItems(terms), next)) yield next;
    }
  }
}

function* enumerateAssignments(vars, index = 0, assignment = new Map()) {
  if (index >= vars.length) { yield new Map(assignment); return; }
  const v = vars[index];
  assignment.set(v, false); yield* enumerateAssignments(vars, index + 1, assignment);
  assignment.set(v, true); yield* enumerateAssignments(vars, index + 1, assignment);
  assignment.delete(v);
}

function cnfDerivationCount(clauses, assignment) {
  let count = 1;
  for (const clause of clauses) {
    let trueLiterals = 0;
    for (const lit of clause) if (assignment.get(lit.var) === lit.positive) trueLiterals++;
    if (trueLiterals === 0) return 0;
    count *= trueLiterals;
  }
  return count;
}

function* qmPrimeImplicants({ goal, env }) {
  const data = qmDataFromArgs(goal, env);
  if (!data) return;
  const primes = computePrimeImplicants(data).map(patternTerm);
  const next = env.clone();
  if (unify(goal.args[3], listFromItems(primes), next)) yield next;
}

function* qmMinimalCover({ goal, env }) {
  const data = qmDataFromArgs(goal, env);
  if (!data) return;
  const primes = computePrimeImplicants(data);
  const cover = computeMinimalCover(primes, data.minterms);
  if (!cover) return;
  const next = env.clone();
  if (unify(goal.args[3], listFromItems(cover.map(patternTerm)), next)) yield next;
}

function qmDataFromArgs(goal, env) {
  const minterms = numberList(goal.args[0], env);
  const dontCares = numberList(goal.args[1], env);
  const bits = bitTable(goal.args[2], env);
  if (!minterms || !dontCares || !bits?.size) return null;
  return { minterms, dontCares, bits };
}

function computePrimeImplicants(data) {
  const initial = [...data.minterms, ...data.dontCares].map((n) => data.bits.get(n)).filter(Boolean);
  const once = [];
  for (const a of initial) for (const b of initial) { const c = combinePatterns(a, b); if (c) once.push(c); }
  const twice = [];
  for (const a of once) for (const b of once) { const c = combinePatterns(a, b); if (c) twice.push(c); }
  const raw = [];
  for (const p of initial) if (!initial.some((q) => combinePatterns(p, q))) raw.push(p);
  for (const p of once) if (!once.some((q) => combinePatterns(p, q))) raw.push(p);
  raw.push(...twice);
  return uniqueSortedPatterns(raw);
}

function combinePatterns(a, b) {
  if (a.length !== b.length) return null;
  let diffs = 0;
  const out = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) out.push(a[i]);
    else {
      diffs++;
      if (diffs > 1) return null;
      out.push('x');
    }
  }
  return diffs === 1 ? out : null;
}

function uniqueSortedPatterns(patterns) {
  const map = new Map();
  for (const p of patterns) map.set(patternKey(p), p);
  return [...map.values()].sort(comparePattern);
}

function comparePattern(a, b) {
  for (let i = 0; i < a.length; i++) {
    const ra = a[i] === 'x' ? 2 : 1;
    const rb = b[i] === 'x' ? 2 : 1;
    if (ra !== rb) return ra - rb;
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function computeMinimalCover(primes, minterms) {
  const sortedMinterms = [...new Set(minterms)].sort((a, b) => a - b);
  const candidates = [];
  for (let i = 0; i < primes.length; i++) {
    for (let j = i + 1; j < primes.length; j++) {
      const cover = uniqueSortedPatterns([primes[i], primes[j]]);
      if (sortedMinterms.every((m) => cover.some((p) => patternCoversInt(p, m)))) candidates.push(cover);
    }
  }
  candidates.sort((a, b) => comparePatternList(a, b));
  return candidates[0] ?? null;
}

function patternCoversInt(pattern, n) {
  const bits = n.toString(2).padStart(pattern.length, '0').split('').map(Number);
  return pattern.every((v, i) => v === 'x' || v === bits[i]);
}

function comparePatternList(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { const c = comparePattern(a[i], b[i]); if (c) return c; }
  return a.length - b.length;
}

function patternTerm(pattern) {
  return listFromItems(pattern.map((v) => v === 'x' ? atom('x') : numberTerm(v)));
}

function patternKey(pattern) { return pattern.join(''); }

function* permutations(items, start = 0) {
  if (start >= items.length) { yield items.slice(); return; }
  for (let i = start; i < items.length; i++) {
    [items[start], items[i]] = [items[i], items[start]];
    yield* permutations(items, start + 1);
    [items[start], items[i]] = [items[i], items[start]];
  }
}

function atomKey(term) {
  if (!term) return null;
  return (term.type === 'atom' || term.type === 'string' || term.type === 'number') ? term.name : null;
}

function intTerm(term, env) {
  const t = env ? deref(term, env) : term;
  if (!t || t.type !== 'number' || !/^-?\d+$/.test(t.name)) return null;
  const n = Number(t.name);
  return Number.isSafeInteger(n) ? n : null;
}

function numberList(term, env) {
  const items = properListItems(term, env);
  if (!items) return null;
  const out = [];
  for (const item of items) {
    const n = intTerm(item, env);
    if (n == null) return null;
    out.push(n);
  }
  return out;
}

function atomList(term, env) {
  const items = properListItems(term, env);
  if (!items) return null;
  const out = [];
  for (const item of items) {
    const v = atomKey(deref(item, env));
    if (v == null) return null;
    out.push(v);
  }
  return out;
}

function bitTable(term, env) {
  const items = properListItems(term, env);
  if (!items) return null;
  const map = new Map();
  for (const item of items) {
    const entry = deref(item, env);
    if (entry.type !== 'compound' || entry.name !== 'bit' || entry.arity !== 2) return null;
    const n = intTerm(entry.args[0], env);
    const bits = numberList(entry.args[1], env);
    if (n == null || !bits) return null;
    map.set(n, bits);
  }
  return map;
}

function clauseList(term, env) {
  const clauses = properListItems(term, env);
  if (!clauses) return null;
  const out = [];
  for (const clause of clauses) {
    const lits = properListItems(clause, env);
    if (!lits) return null;
    const row = [];
    for (const litTerm of lits) {
      const lit = deref(litTerm, env);
      if (lit.type !== 'compound' || lit.arity !== 1 || (lit.name !== 'pos' && lit.name !== 'neg')) return null;
      const v = atomKey(deref(lit.args[0], env));
      if (v == null) return null;
      row.push({ var: v, positive: lit.name === 'pos' });
    }
    out.push(row);
  }
  return out;
}
