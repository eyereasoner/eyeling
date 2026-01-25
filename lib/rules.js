/**
 * Eyeling Reasoner — rules
 *
 * Built-in rule helpers and utilities used by the engine. This is not the
 * inference engine itself, but shared rule-related machinery.
 */

'use strict';

const {
  Var,
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
} = require('./prelude');

function liftBlankRuleVars(premise, conclusion) {
  function convertTerm(t, mapping, counter) {
    if (t instanceof Blank) {
      const label = t.label;
      if (!mapping.hasOwnProperty(label)) {
        counter[0] += 1;
        mapping[label] = `_b${counter[0]}`;
      }
      return new Var(mapping[label]);
    }
    if (t instanceof ListTerm) {
      return new ListTerm(t.elems.map((e) => convertTerm(e, mapping, counter)));
    }
    if (t instanceof OpenListTerm) {
      return new OpenListTerm(
        t.prefix.map((e) => convertTerm(e, mapping, counter)),
        t.tailVar,
      );
    }
    if (t instanceof GraphTerm) {
      const triples = t.triples.map(
        (tr) =>
          new Triple(
            convertTerm(tr.s, mapping, counter),
            convertTerm(tr.p, mapping, counter),
            convertTerm(tr.o, mapping, counter),
          ),
      );
      return new GraphTerm(triples);
    }
    return t;
  }

  function convertTriple(tr, mapping, counter) {
    return new Triple(
      convertTerm(tr.s, mapping, counter),
      convertTerm(tr.p, mapping, counter),
      convertTerm(tr.o, mapping, counter),
    );
  }

  const mapping = {};
  const counter = [0];
  const newPremise = premise.map((tr) => convertTriple(tr, mapping, counter));
  return [newPremise, conclusion];
}

// ===========================================================================

module.exports = {
  liftBlankRuleVars,
};
