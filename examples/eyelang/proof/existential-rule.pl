is(socrates, sk_0).
why(
  is(socrates, sk_0),
  proof(
    goal(is(socrates, sk_0)),
    by(rule("existential-rule.pl", clause(6))),
    bindings([binding("Person", socrates), binding("Witness", sk_0)]),
    uses([
      proof(
        goal(type(socrates, human)),
        by(fact("existential-rule.pl", clause(2)))
      ),
      proof(
        goal(witness(socrates, sk_0)),
        by(fact("existential-rule.pl", clause(4)))
      )
    ])
  )
).

is(plato, sk_1).
why(
  is(plato, sk_1),
  proof(
    goal(is(plato, sk_1)),
    by(rule("existential-rule.pl", clause(6))),
    bindings([binding("Person", plato), binding("Witness", sk_1)]),
    uses([
      proof(
        goal(type(plato, human)),
        by(fact("existential-rule.pl", clause(3)))
      ),
      proof(
        goal(witness(plato, sk_1)),
        by(fact("existential-rule.pl", clause(5)))
      )
    ])
  )
).

