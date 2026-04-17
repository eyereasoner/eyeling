/**
 * Eyeling Reasoner — rules
 *
 * Built-in rule helpers and utilities used by the engine. This is not the
 * inference engine itself, but shared rule-related machinery.
 */

'use strict';

const { Var, Blank, ListTerm, OpenListTerm, GraphTerm, Triple, copyQuotedGraphMetadata } = require('./prelude');

function liftBlankRuleVars(premise, conclusion) {
  // Map blank labels to stable rule-local variable names.
  // This runs at rule construction time; keep it simple and allocation-light.
  const mapping = Object.create(null);
  let counter = 0;

  function blankToVar(label) {
    let name = mapping[label];
    if (name === undefined) {
      counter += 1;
      name = `_b${counter}`;
      mapping[label] = name;
    }
    return new Var(name);
  }

  function copyQuotedTerm(t) {
    // Quoted formulas are data terms with their own local blank scope.
    // Copy them structurally so later in-place rewrites cannot mutate shared AST,
    // but do not lift their blank nodes into rule-body variables.
    if (t instanceof ListTerm) return new ListTerm(t.elems.map(copyQuotedTerm));
    if (t instanceof OpenListTerm) return new OpenListTerm(t.prefix.map(copyQuotedTerm), t.tailVar);
    if (t instanceof GraphTerm) {
      const triples = t.triples.map(
        (tr) => new Triple(copyQuotedTerm(tr.s), copyQuotedTerm(tr.p), copyQuotedTerm(tr.o)),
      );
      return copyQuotedGraphMetadata(t, new GraphTerm(triples));
    }
    return t;
  }

  function convertTerm(t) {
    if (t instanceof Blank) return blankToVar(t.label);
    if (t instanceof ListTerm) return new ListTerm(t.elems.map(convertTerm));
    if (t instanceof OpenListTerm) return new OpenListTerm(t.prefix.map(convertTerm), t.tailVar);
    if (t instanceof GraphTerm) return copyQuotedTerm(t);
    return t;
  }

  const newPremise = premise.map((tr) => new Triple(convertTerm(tr.s), convertTerm(tr.p), convertTerm(tr.o)));
  return [newPremise, conclusion];
}

module.exports = {
  liftBlankRuleVars,
};
