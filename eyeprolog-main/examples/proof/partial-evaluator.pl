partialEvalAnswer(residual(poly_y), add(mul(const(10), var(y)), const(13))).
why(
  partialEvalAnswer(residual(poly_y), add(mul(const(10), var(y)), const(13))),
  proof(
    goal(partialEvalAnswer(residual(poly_y), add(mul(const(10), var(y)), const(13)))),
    by(rule("partial-evaluator.pl", clause(20))),
    bindings([binding("Name", poly_y), binding("Residual", add(mul(const(10), var(y)), const(13)))]),
    uses([
      proof(
        goal(residual_program(poly_y, add(mul(const(10), var(y)), const(13)))),
        by(rule("partial-evaluator.pl", clause(19))),
        bindings([binding("Name", poly_y), binding("Residual", add(mul(const(10), var(y)), const(13))), binding("Expr", add(mul(var(x), var(y)), add(var(x), const(3)))), binding("Env", [bind(x, const(10))])]),
        uses([
          proof(
            goal(program(poly_y, add(mul(var(x), var(y)), add(var(x), const(3))), [bind(x, const(10))])),
            by(fact("partial-evaluator.pl", clause(1)))
          ),
          proof(
            goal(pe([bind(x, const(10))], add(mul(var(x), var(y)), add(var(x), const(3))), add(mul(const(10), var(y)), const(13)))),
            by(rule("partial-evaluator.pl", clause(14))),
            bindings([binding("Env", [bind(x, const(10))]), binding("Left", mul(var(x), var(y))), binding("Right", add(var(x), const(3))), binding("Left_residual", mul(const(10), var(y))), binding("Right_residual", const(13))]),
            uses([
              proof(
                goal(pe([bind(x, const(10))], mul(var(x), var(y)), mul(const(10), var(y)))),
                by(rule("partial-evaluator.pl", clause(15))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", var(y)), binding("Left_residual", const(10)), binding("Right_residual", var(y))]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], var(y), var(y))),
                    by(rule("partial-evaluator.pl", clause(11))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                    uses([
                      proof(
                        goal(unknown_var([bind(x, const(10))], y)),
                        by(rule("partial-evaluator.pl", clause(7))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                        uses([
                          proof(
                            goal('\\+'(known_var([bind(x, const(10))], y, __anon3))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal('\\+'((=(const(10), const(_A)), =(var(y), const(_B))))),
                    by(builtin('\\+', 1))
                  )
                ])
              ),
              proof(
                goal(pe([bind(x, const(10))], add(var(x), const(3)), const(13))),
                by(rule("partial-evaluator.pl", clause(12))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", const(3)), binding("Sum", 13), binding("A", 10), binding("B", 3)]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], const(3), const(3))),
                    by(fact("partial-evaluator.pl", clause(8))),
                    bindings([binding("__anon4", [bind(x, const(10))]), binding("N", 3)])
                  ),
                  proof(
                    goal(is(13, '+'(10, 3))),
                    by(builtin(is, 2))
                  )
                ])
              ),
              proof(
                goal('\\+'((=(mul(const(10), var(y)), const(_A)), =(const(13), const(_B))))),
                by(builtin('\\+', 1))
              )
            ])
          )
        ])
      )
    ])
  )
).

partialEvalAnswer(residual(static_branch), const(11)).
why(
  partialEvalAnswer(residual(static_branch), const(11)),
  proof(
    goal(partialEvalAnswer(residual(static_branch), const(11))),
    by(rule("partial-evaluator.pl", clause(20))),
    bindings([binding("Name", static_branch), binding("Residual", const(11))]),
    uses([
      proof(
        goal(residual_program(static_branch, const(11))),
        by(rule("partial-evaluator.pl", clause(19))),
        bindings([binding("Name", static_branch), binding("Residual", const(11)), binding("Expr", if(bool(true), add(var(x), const(1)), mul(var(y), const(999)))), binding("Env", [bind(x, const(10))])]),
        uses([
          proof(
            goal(program(static_branch, if(bool(true), add(var(x), const(1)), mul(var(y), const(999))), [bind(x, const(10))])),
            by(fact("partial-evaluator.pl", clause(2)))
          ),
          proof(
            goal(pe([bind(x, const(10))], if(bool(true), add(var(x), const(1)), mul(var(y), const(999))), const(11))),
            by(rule("partial-evaluator.pl", clause(16))),
            bindings([binding("Env", [bind(x, const(10))]), binding("Cond", bool(true)), binding("Then", add(var(x), const(1))), binding("_Else", mul(var(y), const(999))), binding("Residual", const(11))]),
            uses([
              proof(
                goal(pe([bind(x, const(10))], bool(true), bool(true))),
                by(fact("partial-evaluator.pl", clause(9))),
                bindings([binding("__anon5", [bind(x, const(10))]), binding("B", true)])
              ),
              proof(
                goal(pe([bind(x, const(10))], add(var(x), const(1)), const(11))),
                by(rule("partial-evaluator.pl", clause(12))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", const(1)), binding("Sum", 11), binding("A", 10), binding("B", 1)]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], const(1), const(1))),
                    by(fact("partial-evaluator.pl", clause(8))),
                    bindings([binding("__anon4", [bind(x, const(10))]), binding("N", 1)])
                  ),
                  proof(
                    goal(is(11, '+'(10, 1))),
                    by(builtin(is, 2))
                  )
                ])
              )
            ])
          )
        ])
      )
    ])
  )
).

partialEvalAnswer(residual(dynamic_branch), if(var(flag), const(11), mul(var(y), const(2)))).
why(
  partialEvalAnswer(residual(dynamic_branch), if(var(flag), const(11), mul(var(y), const(2)))),
  proof(
    goal(partialEvalAnswer(residual(dynamic_branch), if(var(flag), const(11), mul(var(y), const(2))))),
    by(rule("partial-evaluator.pl", clause(20))),
    bindings([binding("Name", dynamic_branch), binding("Residual", if(var(flag), const(11), mul(var(y), const(2))))]),
    uses([
      proof(
        goal(residual_program(dynamic_branch, if(var(flag), const(11), mul(var(y), const(2))))),
        by(rule("partial-evaluator.pl", clause(19))),
        bindings([binding("Name", dynamic_branch), binding("Residual", if(var(flag), const(11), mul(var(y), const(2)))), binding("Expr", if(var(flag), add(var(x), const(1)), mul(var(y), const(2)))), binding("Env", [bind(x, const(10))])]),
        uses([
          proof(
            goal(program(dynamic_branch, if(var(flag), add(var(x), const(1)), mul(var(y), const(2))), [bind(x, const(10))])),
            by(fact("partial-evaluator.pl", clause(3)))
          ),
          proof(
            goal(pe([bind(x, const(10))], if(var(flag), add(var(x), const(1)), mul(var(y), const(2))), if(var(flag), const(11), mul(var(y), const(2))))),
            by(rule("partial-evaluator.pl", clause(18))),
            bindings([binding("Env", [bind(x, const(10))]), binding("Cond", var(flag)), binding("Then", add(var(x), const(1))), binding("Else", mul(var(y), const(2))), binding("Cond_residual", var(flag)), binding("Then_residual", const(11)), binding("Else_residual", mul(var(y), const(2)))]),
            uses([
              proof(
                goal(pe([bind(x, const(10))], var(flag), var(flag))),
                by(rule("partial-evaluator.pl", clause(11))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Name", flag)]),
                uses([
                  proof(
                    goal(unknown_var([bind(x, const(10))], flag)),
                    by(rule("partial-evaluator.pl", clause(7))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", flag)]),
                    uses([
                      proof(
                        goal('\\+'(known_var([bind(x, const(10))], flag, __anon3))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  )
                ])
              ),
              proof(
                goal('\\+'(=(var(flag), bool(true)))),
                by(builtin('\\+', 1))
              ),
              proof(
                goal('\\+'(=(var(flag), bool(false)))),
                by(builtin('\\+', 1))
              ),
              proof(
                goal(pe([bind(x, const(10))], add(var(x), const(1)), const(11))),
                by(rule("partial-evaluator.pl", clause(12))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", const(1)), binding("Sum", 11), binding("A", 10), binding("B", 1)]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], const(1), const(1))),
                    by(fact("partial-evaluator.pl", clause(8))),
                    bindings([binding("__anon4", [bind(x, const(10))]), binding("N", 1)])
                  ),
                  proof(
                    goal(is(11, '+'(10, 1))),
                    by(builtin(is, 2))
                  )
                ])
              ),
              proof(
                goal(pe([bind(x, const(10))], mul(var(y), const(2)), mul(var(y), const(2)))),
                by(rule("partial-evaluator.pl", clause(15))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(y)), binding("Right", const(2)), binding("Left_residual", var(y)), binding("Right_residual", const(2))]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(y), var(y))),
                    by(rule("partial-evaluator.pl", clause(11))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                    uses([
                      proof(
                        goal(unknown_var([bind(x, const(10))], y)),
                        by(rule("partial-evaluator.pl", clause(7))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                        uses([
                          proof(
                            goal('\\+'(known_var([bind(x, const(10))], y, __anon3))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], const(2), const(2))),
                    by(fact("partial-evaluator.pl", clause(8))),
                    bindings([binding("__anon4", [bind(x, const(10))]), binding("N", 2)])
                  ),
                  proof(
                    goal('\\+'((=(var(y), const(_A)), =(const(2), const(_B))))),
                    by(builtin('\\+', 1))
                  )
                ])
              )
            ])
          )
        ])
      )
    ])
  )
).

partialEvalAnswer(note, "static inputs are folded while dynamic variables remain as residual code").
why(
  partialEvalAnswer(note, "static inputs are folded while dynamic variables remain as residual code"),
  proof(
    goal(partialEvalAnswer(note, "static inputs are folded while dynamic variables remain as residual code")),
    by(rule("partial-evaluator.pl", clause(21))),
    bindings([binding("__anon6", add(mul(const(10), var(y)), const(13)))]),
    uses([
      proof(
        goal(residual_program(poly_y, add(mul(const(10), var(y)), const(13)))),
        by(rule("partial-evaluator.pl", clause(19))),
        bindings([binding("Name", poly_y), binding("Residual", add(mul(const(10), var(y)), const(13))), binding("Expr", add(mul(var(x), var(y)), add(var(x), const(3)))), binding("Env", [bind(x, const(10))])]),
        uses([
          proof(
            goal(program(poly_y, add(mul(var(x), var(y)), add(var(x), const(3))), [bind(x, const(10))])),
            by(fact("partial-evaluator.pl", clause(1)))
          ),
          proof(
            goal(pe([bind(x, const(10))], add(mul(var(x), var(y)), add(var(x), const(3))), add(mul(const(10), var(y)), const(13)))),
            by(rule("partial-evaluator.pl", clause(14))),
            bindings([binding("Env", [bind(x, const(10))]), binding("Left", mul(var(x), var(y))), binding("Right", add(var(x), const(3))), binding("Left_residual", mul(const(10), var(y))), binding("Right_residual", const(13))]),
            uses([
              proof(
                goal(pe([bind(x, const(10))], mul(var(x), var(y)), mul(const(10), var(y)))),
                by(rule("partial-evaluator.pl", clause(15))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", var(y)), binding("Left_residual", const(10)), binding("Right_residual", var(y))]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], var(y), var(y))),
                    by(rule("partial-evaluator.pl", clause(11))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                    uses([
                      proof(
                        goal(unknown_var([bind(x, const(10))], y)),
                        by(rule("partial-evaluator.pl", clause(7))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", y)]),
                        uses([
                          proof(
                            goal('\\+'(known_var([bind(x, const(10))], y, __anon3))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal('\\+'((=(const(10), const(_A)), =(var(y), const(_B))))),
                    by(builtin('\\+', 1))
                  )
                ])
              ),
              proof(
                goal(pe([bind(x, const(10))], add(var(x), const(3)), const(13))),
                by(rule("partial-evaluator.pl", clause(12))),
                bindings([binding("Env", [bind(x, const(10))]), binding("Left", var(x)), binding("Right", const(3)), binding("Sum", 13), binding("A", 10), binding("B", 3)]),
                uses([
                  proof(
                    goal(pe([bind(x, const(10))], var(x), const(10))),
                    by(rule("partial-evaluator.pl", clause(10))),
                    bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                    uses([
                      proof(
                        goal(known_var([bind(x, const(10))], x, const(10))),
                        by(rule("partial-evaluator.pl", clause(6))),
                        bindings([binding("Env", [bind(x, const(10))]), binding("Name", x), binding("Value", const(10))]),
                        uses([
                          proof(
                            goal(lookup(x, [bind(x, const(10))], const(10))),
                            by(fact("partial-evaluator.pl", clause(4))),
                            bindings([binding("Name", x), binding("Value", const(10)), binding("__anon0", [])])
                          )
                        ])
                      )
                    ])
                  ),
                  proof(
                    goal(pe([bind(x, const(10))], const(3), const(3))),
                    by(fact("partial-evaluator.pl", clause(8))),
                    bindings([binding("__anon4", [bind(x, const(10))]), binding("N", 3)])
                  ),
                  proof(
                    goal(is(13, '+'(10, 3))),
                    by(builtin(is, 2))
                  )
                ])
              ),
              proof(
                goal('\\+'((=(mul(const(10), var(y)), const(_A)), =(const(13), const(_B))))),
                by(builtin('\\+', 1))
              )
            ])
          )
        ])
      )
    ])
  )
).

