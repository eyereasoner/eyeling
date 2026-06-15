// Public JavaScript API surface for embedders and the browser playground.
// The CLI imports the same parser, program, solver, and term primitives from here.
export { Program, makeProgram } from './program.mjs';
export { parseClauses, parseProgramText } from './parser.mjs';
export { parseRdfClauses, rdfToEyelang, clausesToEyelang, rdfIri, rdfBlank, rdfLiteral, rdfTripleTerm, rdfGoal } from './rdf.mjs';
export { Solver } from './solver.mjs';
export * from './term.mjs';
export { BuiltinRegistry, createDefaultRegistry, getDefaultRegistry } from './builtins/registry.mjs';

import { Env, copyResolved, termIsGround, termToString } from './term.mjs';
import { Program } from './program.mjs';
import { Solver } from './solver.mjs';
import { whyNoProof, whyProof } from './explain.mjs';
import { getDefaultRegistry } from './builtins/registry.mjs';

export function run(source, options = {}) {
  const includeWhy = options.proof === true || options.why === true || options.explain === true;
  const parseOptions = { ...options, sourceMetadata: includeWhy, markRecursive: includeWhy };
  const program = source instanceof Program ? source : Program.parse(source, parseOptions);
  const runOptions = options.registry ? options : { ...options, registry: getDefaultRegistry() };
  const solver = new Solver(program, runOptions);
  const output = [];
  const goals = program.materializationGoals();
  const materializedKeys = new Set(goals.map((goal) => `${goal.name}/${goal.arity}`));
  const facts = program.sourceFactLines(materializedKeys);
  const seen = new Set();
  for (const goal of goals) {
    solver.solutionsSeen = 0;
    for (const env of solver.solve([goal], new Env(), 0)) {
      const resolved = copyResolved(goal, env);
      if (!termIsGround(resolved)) continue;
      const line = `${termToString(resolved, new Env(), true)}.\n`;
      if (facts.has(line) || seen.has(line)) continue;
      seen.add(line);
      output.push(line);
      if (includeWhy) appendExplanation(output, program, resolved, runOptions.registry);
    }
  }
  return { stdout: output.join(''), stats: solver.stats };
}

function appendExplanation(output, program, resolved, registry) {
  const proof = whyProof(program, resolved, { registry });
  output.push(proof.text);
  if (!proof.ok) output.push(whyNoProof(resolved));
}

export * from './explain.mjs';
