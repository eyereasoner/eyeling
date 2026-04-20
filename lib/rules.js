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

  function convertQuotedPatternTerm(t) {
    if (t instanceof Blank) return blankToVar(t.label);
    if (t instanceof ListTerm) return new ListTerm(t.elems.map(convertQuotedPatternTerm));
    if (t instanceof OpenListTerm) return new OpenListTerm(t.prefix.map(convertQuotedPatternTerm), t.tailVar);
    if (t instanceof GraphTerm) {
      const triples = t.triples.map(
        (tr) =>
          new Triple(convertQuotedPatternTerm(tr.s), convertQuotedPatternTerm(tr.p), convertQuotedPatternTerm(tr.o)),
      );
      return copyQuotedGraphMetadata(t, new GraphTerm(triples));
    }
    return t;
  }

  function convertTerm(t, allowDirectQuotedPattern = false) {
    if (t instanceof Blank) return blankToVar(t.label);
    if (t instanceof ListTerm) return new ListTerm(t.elems.map((e) => convertTerm(e, false)));
    if (t instanceof OpenListTerm)
      return new OpenListTerm(
        t.prefix.map((e) => convertTerm(e, false)),
        t.tailVar,
      );
    if (t instanceof GraphTerm) return allowDirectQuotedPattern ? convertQuotedPatternTerm(t) : copyQuotedTerm(t);
    return t;
  }

  const newPremise = premise.map(
    (tr) => new Triple(convertTerm(tr.s, true), convertTerm(tr.p, true), convertTerm(tr.o, true)),
  );
  return [newPremise, conclusion];
}

module.exports = {
  liftBlankRuleVars,
};
