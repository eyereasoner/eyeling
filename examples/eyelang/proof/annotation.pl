name(a, "Alice").
why(
  name(a, "Alice"),
  proof(
    goal(name(a, "Alice")),
    by(rule("annotation.pl", clause(6))),
    bindings([binding("S", a), binding("O", "Alice"), binding("_T", t), binding("Formula", (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))]),
    uses([
      proof(
        goal(annotation(t, (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))),
        by(fact("annotation.pl", clause(5)))
      ),
      proof(
        goal(formula_binary((name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")), a, name, "Alice")),
        by(builtin(formula_binary, 4))
      )
    ])
  )
).

log_nameOf(t, name(a, "Alice")).
why(
  log_nameOf(t, name(a, "Alice")),
  proof(
    goal(log_nameOf(t, name(a, "Alice"))),
    by(rule("annotation.pl", clause(7))),
    bindings([binding("T", t), binding("S", a), binding("O", "Alice"), binding("Formula", (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))]),
    uses([
      proof(
        goal(annotation(t, (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))),
        by(fact("annotation.pl", clause(5)))
      ),
      proof(
        goal(formula_binary((name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")), a, name, "Alice")),
        by(builtin(formula_binary, 4))
      )
    ])
  )
).

statedBy(t, bob).
why(
  statedBy(t, bob),
  proof(
    goal(statedBy(t, bob)),
    by(rule("annotation.pl", clause(8))),
    bindings([binding("S", t), binding("O", bob), binding("_T", t), binding("Formula", (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))]),
    uses([
      proof(
        goal(annotation(t, (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))),
        by(fact("annotation.pl", clause(5)))
      ),
      proof(
        goal(formula_binary((name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")), t, statedBy, bob)),
        by(builtin(formula_binary, 4))
      )
    ])
  )
).

recorded(t, "2021-07-07").
why(
  recorded(t, "2021-07-07"),
  proof(
    goal(recorded(t, "2021-07-07")),
    by(rule("annotation.pl", clause(9))),
    bindings([binding("S", t), binding("O", "2021-07-07"), binding("_T", t), binding("Formula", (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))]),
    uses([
      proof(
        goal(annotation(t, (name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")))),
        by(fact("annotation.pl", clause(5)))
      ),
      proof(
        goal(formula_binary((name(a, "Alice"), statedBy(t, bob), recorded(t, "2021-07-07")), t, recorded, "2021-07-07")),
        by(builtin(formula_binary, 4))
      )
    ])
  )
).

