// ISO/IEC TS 13211-3:2025 definite clause grammar expansion.
// Grammar rules are lowered to ordinary clauses during program preparation;
// phrase/2-3 use the same body expansion for dynamically supplied grammars.
import {
  ATOM, COMPOUND, VAR, Env, atom, compactListLength, compound, deref, emptyList,
  flattenConjunction, variable,
} from './term.js';
import { PrologError } from './errors.js';

let dcgFresh = 0;

function freshDcgVariable(label = 'S') {
  // NUL cannot occur in a source variable name, so generated difference-list
  // variables cannot capture a variable written by the program.
  return variable(`\u0000dcg${++dcgFresh}:${label}`);
}

function conjunction(first, second) {
  return compound(',', [first, second]);
}

function equality(left, right) {
  return compound('=', [left, right]);
}

function listWithTail(items, tail) {
  let list = tail;
  for (let index = items.length - 1; index >= 0; index--) {
    list = compound('.', [items[index], list]);
  }
  return list;
}

function terminalItems(term, env = new Env()) {
  const items = [];
  const original = term;
  const seen = new Set();
  let cursor = deref(term, env);
  while (cursor.type === COMPOUND && cursor.name === '.' && cursor.arity === 2) {
    if (seen.has(cursor)) throw new PrologError('type_error(list)', original);
    seen.add(cursor);
    items.push(cursor.args[0]);
    cursor = deref(cursor.args[1], env);
  }
  if (cursor.type === ATOM && cursor.name === '[]') return items;
  if (cursor.type === VAR) throw new PrologError('instantiation_error');
  throw new PrologError('type_error(list)', original);
}

function terminalsGoal(terminals, input, output, env) {
  return equality(input, listWithTail(terminalItems(terminals, env), output));
}

function appendStateArguments(nonterminal, input, output, module) {
  nonterminal = deref(nonterminal, new Env());
  if (nonterminal.type === ATOM) {
    const goal = compound(nonterminal.name, [input, output]);
    goal.module = module;
    return goal;
  }
  if (nonterminal.type !== COMPOUND) throw new PrologError('type_error(callable)', nonterminal);
  if (nonterminal.name === ':' && nonterminal.arity === 2) {
    const qualifier = nonterminal.args[0];
    if (qualifier.type === VAR) throw new PrologError('instantiation_error');
    if (qualifier.type !== ATOM) throw new PrologError('type_error(atom)', qualifier);
    return compound(':', [qualifier, appendStateArguments(nonterminal.args[1], input, output, qualifier.name)]);
  }
  const goal = compound(nonterminal.name, [...nonterminal.args, input, output]);
  goal.module = nonterminal.module ?? module;
  return goal;
}

function markGoalModule(term, module) {
  if (!term || (term.type !== ATOM && term.type !== COMPOUND)) return term;
  term.module ??= module;
  if (term.type === COMPOUND &&
      [',', ';', '->', '\\+', 'call', 'once', 'catch', 'phrase'].includes(term.name)) {
    for (const argument of term.args) markGoalModule(argument, module);
  }
  return term;
}

function isTerminalSequence(term) {
  return (term.type === ATOM && term.name === '[]') ||
    (term.type === COMPOUND && term.name === '.' && term.arity === 2);
}

export function expandDcgBody(body, input, output, options = {}) {
  const env = options.env ?? new Env();
  const module = options.module ?? 'user';
  body = deref(body, env);

  if (body.type === VAR) {
    const goal = compound('phrase', [body, input, output]);
    goal.module = module;
    return goal;
  }

  // Empty braces are the empty embedded-goal sequence. Like {true}, they
  // consume no terminals and leave the grammar state unchanged.
  if (body.type === ATOM && body.name === '{}') return equality(input, output);

  if (isTerminalSequence(body)) return terminalsGoal(body, input, output, env);

  if (body.type === COMPOUND && body.name === ',' && body.arity === 2) {
    const middle = freshDcgVariable('sequence');
    return conjunction(
      expandDcgBody(body.args[0], input, middle, options),
      expandDcgBody(body.args[1], middle, output, options),
    );
  }

  if (body.type === COMPOUND && [';', '|'].includes(body.name) && body.arity === 2) {
    const left = body.args[0];
    if (body.name === ';' && left.type === COMPOUND && left.name === '->' && left.arity === 2) {
      const middle = freshDcgVariable('condition');
      return compound(';', [
        compound('->', [
          expandDcgBody(left.args[0], input, middle, options),
          expandDcgBody(left.args[1], middle, output, options),
        ]),
        expandDcgBody(body.args[1], input, output, options),
      ]);
    }
    return compound(';', [
      expandDcgBody(left, input, output, options),
      expandDcgBody(body.args[1], input, output, options),
    ]);
  }

  if (body.type === COMPOUND && body.name === '{}' && body.arity === 1) {
    return conjunction(markGoalModule(body.args[0], module), equality(input, output));
  }

  if (body.type === COMPOUND && body.name === 'call' && body.arity === 1) {
    const closure = body.args[0];
    if (closure.type === ATOM || closure.type === COMPOUND) closure.module ??= module;
    const goal = compound('call', [closure, input, output]);
    goal.module = module;
    return goal;
  }

  if (body.type === COMPOUND && body.name === 'phrase' && body.arity === 1) {
    const goal = compound('phrase', [body.args[0], input, output]);
    goal.module = module;
    return goal;
  }

  if (body.type === ATOM && body.name === '!') {
    return conjunction(body, equality(input, output));
  }

  // TS 13211-3 leaves \+//1 and ->//2 implementation dependent.  EyeProlog
  // uses the widespread non-consuming negation and state-threading if-then
  // definitions and documents these choices in its conformance profile.
  if (body.type === COMPOUND && body.name === '\\+' && body.arity === 1) {
    const ignored = freshDcgVariable('negated');
    const negated = body.args[0];
    const expandedNegated = negated.type === ATOM || negated.type === COMPOUND || negated.type === VAR
      ? expandDcgBody(negated, input, ignored, options)
      : negated;
    return conjunction(
      compound('\\+', [expandedNegated]),
      equality(input, output),
    );
  }

  if (body.type === COMPOUND && body.name === '->' && body.arity === 2) {
    const middle = freshDcgVariable('condition');
    return compound('->', [
      expandDcgBody(body.args[0], input, middle, options),
      expandDcgBody(body.args[1], middle, output, options),
    ]);
  }

  if (body.type !== ATOM && body.type !== COMPOUND) {
    throw new PrologError('type_error(callable)', body);
  }
  return appendStateArguments(body, input, output, module);
}

// Embedded goals are validated before the translated grammar is executed.
// This keeps a non-callable goal visible even when an earlier terminal or
// branch would otherwise prevent the host goal from being reached.
export function validateDcgEmbeddedGoals(body, input, output) {
  const invalidBody = invalidDcgControl(body);
  if (invalidBody != null) throw new PrologError('type_error(callable)', invalidBody);

  const visit = (term) => {
    if (term.type !== COMPOUND) return;
    if (term.name === '{}' && term.arity === 1) {
      if (invalidControlGoal(term.args[0])) {
        // Report the translated host-language conjunction, matching the
        // convention used by Trealla and the ISO Part 3 quad corpus.
        throw new PrologError('type_error(callable)', conjunction(term.args[0], equality(input, output)));
      }
      return;
    }
    if ([',', ';', '|', '->', '\\+'].includes(term.name)) {
      for (const argument of term.args) visit(argument);
    }
  };
  visit(body);
}

function invalidDcgControl(term) {
  if (term.type !== ATOM && term.type !== COMPOUND && term.type !== VAR) return term;
  if (term.type !== COMPOUND || ![',', ';', '|', '->'].includes(term.name)) return null;
  for (const argument of term.args) {
    if (argument.type === COMPOUND && argument.name === '{}' && argument.arity === 1) continue;
    const invalid = invalidDcgControl(argument);
    if (invalid != null) return invalid;
  }
  return null;
}

function invalidControlGoal(goal) {
  if (goal.type === VAR) return false;
  if (goal.type !== ATOM && goal.type !== COMPOUND) return true;
  if (goal.type === COMPOUND && [',', ';', '->'].includes(goal.name) && goal.arity === 2) {
    return goal.args.some(invalidControlGoal);
  }
  return false;
}

function splitGrammarHead(head) {
  let terminals = null;
  if (head.type === COMPOUND && head.name === ',' && head.arity === 2) {
    terminals = head.args[1];
    head = head.args[0];
  }
  let module = null;
  if (head.type === COMPOUND && head.name === ':' && head.arity === 2) {
    if (head.args[0].type === VAR) throw new PrologError('instantiation_error');
    if (head.args[0].type !== ATOM) throw new PrologError('type_error(atom)', head.args[0]);
    module = head.args[0].name;
    head = head.args[1];
  }
  if (head.type === VAR) throw new PrologError('instantiation_error');
  if (head.type !== ATOM && head.type !== COMPOUND) throw new PrologError('type_error(callable)', head);
  if (isTerminalSequence(head) ||
      (head.type === COMPOUND && [',', ';', '|', '->', '{}'].includes(head.name)) ||
      (head.type === ATOM && ['!', '{}'].includes(head.name))) {
    throw new PrologError('permission_error(define, grammar_rule)', head);
  }
  return { head, terminals, module };
}

export function expandDcgRuleClause(clause, defaultModule = 'user') {
  if (clause?.body?.length !== 0 || clause?.head?.type !== COMPOUND ||
      clause.head.name !== '-->' || clause.head.arity !== 2) return null;

  const declaration = splitGrammarHead(clause.head.args[0]);
  const module = declaration.module ?? defaultModule;
  const input = freshDcgVariable('input');
  const output = freshDcgVariable('output');
  const expandedHead = appendStateArguments(declaration.head, input, output, module);
  delete expandedHead.module;

  let bodyOutput = output;
  if (declaration.terminals != null) bodyOutput = freshDcgVariable('semicontext');
  let expandedBody = expandDcgBody(clause.head.args[1], input, bodyOutput, { module });
  if (declaration.terminals != null) {
    expandedBody = conjunction(
      expandedBody,
      terminalsGoal(declaration.terminals, output, bodyOutput, new Env()),
    );
  }

  const expanded = {
    head: expandedHead,
    body: flattenConjunction(expandedBody),
    module,
    grammarRule: clause.head,
  };
  if (clause.source) expanded.source = clause.source;
  return expanded;
}

export function isListOrPartialList(term, env) {
  const seen = new Set();
  let cursor = deref(term, env);
  // A compact list skeleton has a fixed proper spine by construction. Its
  // elements may later receive bindings, but those bindings cannot change the
  // list tail shape, so phrase/2-3 need not expand the entire lazy spine merely
  // to validate it as a list.
  if (compactListLength(cursor) != null) return true;
  while (cursor.type === COMPOUND && cursor.name === '.' && cursor.arity === 2) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    cursor = deref(cursor.args[1], env);
  }
  return cursor.type === VAR || (cursor.type === ATOM && cursor.name === '[]');
}

export function emptyTerminalSequence() {
  return emptyList();
}
