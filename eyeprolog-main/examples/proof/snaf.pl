hates(alice, nobody).
why(
  hates(alice, nobody),
  proof(
    goal(hates(alice, nobody)),
    by(rule("snaf.pl", clause(3))),
    bindings([binding("X", bob)]),
    uses([
      proof(
        goal(person(bob)),
        by(fact("snaf.pl", clause(2)))
      ),
      proof(
        goal('\\+'(hates(alice, bob))),
        by(builtin('\\+', 1))
      )
    ])
  )
).

