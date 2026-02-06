/**
 * Eyeling Reasoner — rules
 *
 * Built-in rule helpers and utilities used by the engine. This is not the
 * inference engine itself, but shared rule-related machinery.
 */

'use strict';

const { Var, Blank, ListTerm, OpenListTerm, GraphTerm, Triple } = require('./prelude');

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

  function convertTerm(t) {
    if (t instanceof Blank) return blankToVar(t.label);
    if (t instanceof ListTerm) return new ListTerm(t.elems.map(convertTerm));
    if (t instanceof OpenListTerm) return new OpenListTerm(t.prefix.map(convertTerm), t.tailVar);
    if (t instanceof GraphTerm) {
      const triples = t.triples.map((tr) => new Triple(convertTerm(tr.s), convertTerm(tr.p), convertTerm(tr.o)));
      return new GraphTerm(triples);
    }
    return t;
  }

  const newPremise = premise.map((tr) => new Triple(convertTerm(tr.s), convertTerm(tr.p), convertTerm(tr.o)));
  return [newPremise, conclusion];
}

module.exports = {
  liftBlankRuleVars,
};
