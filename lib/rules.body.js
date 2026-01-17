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

function isConstraintBuiltin(tr) {
  if (!(tr.p instanceof Iri)) return false;
  const v = tr.p.value;

  // math: numeric comparisons (no new bindings, just tests)
  if (
    v === MATH_NS + 'equalTo' ||
    v === MATH_NS + 'greaterThan' ||
    v === MATH_NS + 'lessThan' ||
    v === MATH_NS + 'notEqualTo' ||
    v === MATH_NS + 'notGreaterThan' ||
    v === MATH_NS + 'notLessThan'
  ) {
    return true;
  }

  // list: membership test with no bindings
  if (v === LIST_NS + 'notMember') {
    return true;
  }

  // log: tests that are purely constraints (no new bindings)
  if (
    v === LOG_NS + 'forAllIn' ||
    v === LOG_NS + 'notEqualTo' ||
    v === LOG_NS + 'notIncludes' ||
    v === LOG_NS + 'outputString'
  ) {
    return true;
  }

  // string: relational / membership style tests (no bindings)
  if (
    v === STRING_NS + 'contains' ||
    v === STRING_NS + 'containsIgnoringCase' ||
    v === STRING_NS + 'endsWith' ||
    v === STRING_NS + 'equalIgnoringCase' ||
    v === STRING_NS + 'greaterThan' ||
    v === STRING_NS + 'lessThan' ||
    v === STRING_NS + 'matches' ||
    v === STRING_NS + 'notEqualIgnoringCase' ||
    v === STRING_NS + 'notGreaterThan' ||
    v === STRING_NS + 'notLessThan' ||
    v === STRING_NS + 'notMatches' ||
    v === STRING_NS + 'startsWith'
  ) {
    return true;
  }

  return false;
}

// Move constraint builtins to the end of the rule premise.
// This is a simple "delaying" strategy similar in spirit to Prolog's when/2:
// - normal goals first (can bind variables),
// - pure test / constraint builtins last (checked once bindings are in place).
function reorderPremiseForConstraints(premise) {
  if (!premise || premise.length === 0) return premise;

  const normal = [];
  const delayed = [];

  for (const tr of premise) {
    if (isConstraintBuiltin(tr)) delayed.push(tr);
    else normal.push(tr);
  }
  return normal.concat(delayed);
}

// ===========================================================================
