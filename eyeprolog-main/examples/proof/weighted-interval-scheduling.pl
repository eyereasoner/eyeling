weighted_interval_answer(best_value, 13).
why(
  weighted_interval_answer(best_value, 13),
  proof(
    goal(weighted_interval_answer(best_value, 13)),
    by(rule("weighted-interval-scheduling.pl", clause(19))),
    bindings([binding("Best", 13)]),
    uses([
      proof(
        goal(best_from(1, 13)),
        by(rule("weighted-interval-scheduling.pl", clause(15))),
        bindings([binding("I", 1), binding("Best", 13), binding("Last", 8), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
        uses([
          proof(
            goal(last_interval(8)),
            by(fact("weighted-interval-scheduling.pl", clause(2)))
          ),
          proof(
            goal(=<(1, 8)),
            by(builtin(=<, 2))
          ),
          proof(
            goal(is(2, '+'(1, 1))),
            by(builtin(is, 2))
          ),
          proof(
            goal(best_from(2, 12)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(2, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(3, '+'(2, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(3, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(3, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(4, '+'(3, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(4, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(5, '+'(4, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(5, 6)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(5, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(6, '+'(5, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(6, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(6, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(7, '+'(6, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(7, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(7, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(8, '+'(7, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(8, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(8, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(9, '+'(8, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(next_compatible(8, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                        uses([
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal(is(4, '+'(4, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(7, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                    uses([
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal(is(2, '+'(2, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(6, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                uses([
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal(is(3, '+'(3, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(5, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                            uses([
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal(is(6, '+'(6, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(is(8, '+'(4, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(3, 7)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                    uses([
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(3, 0, 6, 8)),
                    by(fact("weighted-interval-scheduling.pl", clause(6)))
                  ),
                  proof(
                    goal(is(12, '+'(8, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(2, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                uses([
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(6, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(6, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(7, '+'(6, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(6, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                    uses([
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(6, 5, 9, 3)),
                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                  ),
                  proof(
                    goal(is(3, '+'(3, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(2, 3, 5, 1)),
                by(fact("weighted-interval-scheduling.pl", clause(5)))
              ),
              proof(
                goal(is(5, '+'(1, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(next_compatible(1, 4)),
            by(rule("weighted-interval-scheduling.pl", clause(12))),
            bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
            uses([
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                by(library(aggregate_min, 5))
              )
            ])
          ),
          proof(
            goal(best_from(4, 8)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(4, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(interval(1, 1, 4, 5)),
            by(fact("weighted-interval-scheduling.pl", clause(4)))
          ),
          proof(
            goal(is(13, '+'(5, 8))),
            by(builtin(is, 2))
          ),
          proof(
            goal(';'(->(>=(13, 12), =(13, 13)), =(13, 12))),
            by(builtin(';', 2))
          )
        ])
      )
    ])
  )
).

weighted_interval_answer(chosen_interval, interval(1, 1, 4, 5)).
why(
  weighted_interval_answer(chosen_interval, interval(1, 1, 4, 5)),
  proof(
    goal(weighted_interval_answer(chosen_interval, interval(1, 1, 4, 5))),
    by(rule("weighted-interval-scheduling.pl", clause(20))),
    bindings([binding("I", 1), binding("Start", 1), binding("Finish", 4), binding("Value", 5)]),
    uses([
      proof(
        goal(chosen_from(1, 1)),
        by(rule("weighted-interval-scheduling.pl", clause(16))),
        bindings([binding("I", 1), binding("Best", 13), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
        uses([
          proof(
            goal(best_from(1, 13)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 1), binding("Best", 13), binding("Last", 8), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(1, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(2, '+'(1, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(2, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(2, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(3, '+'(2, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(3, 12)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(3, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(4, '+'(3, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(4, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(5, '+'(4, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(5, 6)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(5, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(6, '+'(5, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(6, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(6, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(7, '+'(6, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(7, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(7, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(8, '+'(7, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(8, 4)),
                                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                        uses([
                                          proof(
                                            goal(last_interval(8)),
                                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                                          ),
                                          proof(
                                            goal(=<(8, 8)),
                                            by(builtin(=<, 2))
                                          ),
                                          proof(
                                            goal(is(9, '+'(8, 1))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(next_compatible(8, 9)),
                                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                            uses([
                                              proof(
                                                goal(interval(8, 8, 11, 4)),
                                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                                              ),
                                              proof(
                                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                                by(builtin('\\+', 1))
                                              )
                                            ])
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal(is(4, '+'(4, 0))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                            by(builtin(';', 2))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(next_compatible(7, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                        uses([
                                          proof(
                                            goal(interval(7, 6, 10, 2)),
                                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal(is(2, '+'(2, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(6, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                    uses([
                                      proof(
                                        goal(interval(6, 5, 9, 3)),
                                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal(is(3, '+'(3, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(5, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                                uses([
                                  proof(
                                    goal(interval(5, 3, 9, 6)),
                                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal(is(6, '+'(6, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(4, 8)),
                            by(rule("weighted-interval-scheduling.pl", clause(12))),
                            bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(4, 4, 7, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(7)))
                              ),
                              proof(
                                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                                by(library(aggregate_min, 5))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(is(8, '+'(4, 4))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(3, 7)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                        uses([
                          proof(
                            goal(interval(3, 0, 6, 8)),
                            by(fact("weighted-interval-scheduling.pl", clause(6)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(is(12, '+'(8, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(2, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                    uses([
                      proof(
                        goal(interval(2, 3, 5, 1)),
                        by(fact("weighted-interval-scheduling.pl", clause(5)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(is(5, '+'(1, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(1, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
                uses([
                  proof(
                    goal(interval(1, 1, 4, 5)),
                    by(fact("weighted-interval-scheduling.pl", clause(4)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(4, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(5, '+'(4, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(5, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(5, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(6, '+'(5, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(6, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(6, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(7, '+'(6, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(7, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(7, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(8, '+'(7, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(8, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(8, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(9, '+'(8, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(next_compatible(8, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                    uses([
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal(is(4, '+'(4, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(7, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                uses([
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal(is(2, '+'(2, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(6, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                            uses([
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal(is(3, '+'(3, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(5, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                        uses([
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal(is(6, '+'(6, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(is(8, '+'(4, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(is(13, '+'(5, 8))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(13, 12), =(13, 13)), =(13, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(is(2, '+'(1, 1))),
            by(builtin(is, 2))
          ),
          proof(
            goal(best_from(2, 12)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(2, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(3, '+'(2, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(3, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(3, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(4, '+'(3, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(4, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(5, '+'(4, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(5, 6)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(5, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(6, '+'(5, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(6, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(6, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(7, '+'(6, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(7, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(7, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(8, '+'(7, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(8, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(8, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(9, '+'(8, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(next_compatible(8, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                        uses([
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal(is(4, '+'(4, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(7, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                    uses([
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal(is(2, '+'(2, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(6, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                uses([
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal(is(3, '+'(3, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(5, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                            uses([
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal(is(6, '+'(6, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(is(8, '+'(4, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(3, 7)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                    uses([
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(3, 0, 6, 8)),
                    by(fact("weighted-interval-scheduling.pl", clause(6)))
                  ),
                  proof(
                    goal(is(12, '+'(8, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(2, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                uses([
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(6, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(6, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(7, '+'(6, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(6, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                    uses([
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(6, 5, 9, 3)),
                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                  ),
                  proof(
                    goal(is(3, '+'(3, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(2, 3, 5, 1)),
                by(fact("weighted-interval-scheduling.pl", clause(5)))
              ),
              proof(
                goal(is(5, '+'(1, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(next_compatible(1, 4)),
            by(rule("weighted-interval-scheduling.pl", clause(12))),
            bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
            uses([
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                by(library(aggregate_min, 5))
              )
            ])
          ),
          proof(
            goal(best_from(4, 8)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(4, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(interval(1, 1, 4, 5)),
            by(fact("weighted-interval-scheduling.pl", clause(4)))
          ),
          proof(
            goal(is(13, '+'(5, 8))),
            by(builtin(is, 2))
          ),
          proof(
            goal(=(13, 13)),
            by(builtin(=, 2))
          ),
          proof(
            goal(>=(13, 12)),
            by(builtin(>=, 2))
          )
        ])
      ),
      proof(
        goal(interval(1, 1, 4, 5)),
        by(fact("weighted-interval-scheduling.pl", clause(4)))
      )
    ])
  )
).

weighted_interval_answer(chosen_interval, interval(4, 4, 7, 4)).
why(
  weighted_interval_answer(chosen_interval, interval(4, 4, 7, 4)),
  proof(
    goal(weighted_interval_answer(chosen_interval, interval(4, 4, 7, 4))),
    by(rule("weighted-interval-scheduling.pl", clause(20))),
    bindings([binding("I", 4), binding("Start", 4), binding("Finish", 7), binding("Value", 4)]),
    uses([
      proof(
        goal(chosen_from(1, 4)),
        by(rule("weighted-interval-scheduling.pl", clause(17))),
        bindings([binding("I", 1), binding("Chosen", 4), binding("Best", 13), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
        uses([
          proof(
            goal(best_from(1, 13)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 1), binding("Best", 13), binding("Last", 8), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(1, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(2, '+'(1, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(2, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(2, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(3, '+'(2, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(3, 12)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(3, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(4, '+'(3, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(4, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(5, '+'(4, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(5, 6)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(5, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(6, '+'(5, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(6, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(6, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(7, '+'(6, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(7, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(7, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(8, '+'(7, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(8, 4)),
                                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                        uses([
                                          proof(
                                            goal(last_interval(8)),
                                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                                          ),
                                          proof(
                                            goal(=<(8, 8)),
                                            by(builtin(=<, 2))
                                          ),
                                          proof(
                                            goal(is(9, '+'(8, 1))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(next_compatible(8, 9)),
                                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                            uses([
                                              proof(
                                                goal(interval(8, 8, 11, 4)),
                                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                                              ),
                                              proof(
                                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                                by(builtin('\\+', 1))
                                              )
                                            ])
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal(is(4, '+'(4, 0))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                            by(builtin(';', 2))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(next_compatible(7, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                        uses([
                                          proof(
                                            goal(interval(7, 6, 10, 2)),
                                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal(is(2, '+'(2, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(6, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                    uses([
                                      proof(
                                        goal(interval(6, 5, 9, 3)),
                                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal(is(3, '+'(3, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(5, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                                uses([
                                  proof(
                                    goal(interval(5, 3, 9, 6)),
                                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal(is(6, '+'(6, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(4, 8)),
                            by(rule("weighted-interval-scheduling.pl", clause(12))),
                            bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(4, 4, 7, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(7)))
                              ),
                              proof(
                                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                                by(library(aggregate_min, 5))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(is(8, '+'(4, 4))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(3, 7)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                        uses([
                          proof(
                            goal(interval(3, 0, 6, 8)),
                            by(fact("weighted-interval-scheduling.pl", clause(6)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(is(12, '+'(8, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(2, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                    uses([
                      proof(
                        goal(interval(2, 3, 5, 1)),
                        by(fact("weighted-interval-scheduling.pl", clause(5)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(is(5, '+'(1, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(1, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
                uses([
                  proof(
                    goal(interval(1, 1, 4, 5)),
                    by(fact("weighted-interval-scheduling.pl", clause(4)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(4, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(5, '+'(4, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(5, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(5, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(6, '+'(5, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(6, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(6, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(7, '+'(6, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(7, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(7, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(8, '+'(7, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(8, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(8, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(9, '+'(8, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(next_compatible(8, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                    uses([
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal(is(4, '+'(4, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(7, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                uses([
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal(is(2, '+'(2, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(6, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                            uses([
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal(is(3, '+'(3, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(5, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                        uses([
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal(is(6, '+'(6, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(is(8, '+'(4, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(is(13, '+'(5, 8))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(13, 12), =(13, 13)), =(13, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(is(2, '+'(1, 1))),
            by(builtin(is, 2))
          ),
          proof(
            goal(best_from(2, 12)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(2, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(3, '+'(2, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(3, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(3, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(4, '+'(3, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(4, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(5, '+'(4, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(5, 6)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(5, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(6, '+'(5, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(6, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(6, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(7, '+'(6, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(7, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(7, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(8, '+'(7, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(8, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(8, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(9, '+'(8, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(next_compatible(8, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                        uses([
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal(is(4, '+'(4, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(7, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                    uses([
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal(is(2, '+'(2, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(6, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                uses([
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal(is(3, '+'(3, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(5, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                            uses([
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal(is(6, '+'(6, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(is(8, '+'(4, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(3, 7)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                    uses([
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(3, 0, 6, 8)),
                    by(fact("weighted-interval-scheduling.pl", clause(6)))
                  ),
                  proof(
                    goal(is(12, '+'(8, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(2, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                uses([
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(6, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(6, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(7, '+'(6, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(6, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                    uses([
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(6, 5, 9, 3)),
                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                  ),
                  proof(
                    goal(is(3, '+'(3, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(2, 3, 5, 1)),
                by(fact("weighted-interval-scheduling.pl", clause(5)))
              ),
              proof(
                goal(is(5, '+'(1, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(next_compatible(1, 4)),
            by(rule("weighted-interval-scheduling.pl", clause(12))),
            bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
            uses([
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                by(library(aggregate_min, 5))
              )
            ])
          ),
          proof(
            goal(best_from(4, 8)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(4, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(interval(1, 1, 4, 5)),
            by(fact("weighted-interval-scheduling.pl", clause(4)))
          ),
          proof(
            goal(is(13, '+'(5, 8))),
            by(builtin(is, 2))
          ),
          proof(
            goal(=(13, 13)),
            by(builtin(=, 2))
          ),
          proof(
            goal(>=(13, 12)),
            by(builtin(>=, 2))
          ),
          proof(
            goal(chosen_from(4, 4)),
            by(rule("weighted-interval-scheduling.pl", clause(16))),
            bindings([binding("I", 4), binding("Best", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(best_from(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(4, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(5, '+'(4, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(5, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(5, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(6, '+'(5, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(6, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(6, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(7, '+'(6, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(7, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(7, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(8, '+'(7, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(8, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(8, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(9, '+'(8, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(next_compatible(8, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                    uses([
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal(is(4, '+'(4, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(7, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                uses([
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal(is(2, '+'(2, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(6, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                            uses([
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal(is(3, '+'(3, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(5, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                        uses([
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal(is(6, '+'(6, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(is(8, '+'(4, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(=(8, 8)),
                by(builtin(=, 2))
              ),
              proof(
                goal(>=(8, 6)),
                by(builtin(>=, 2))
              )
            ])
          )
        ])
      ),
      proof(
        goal(interval(4, 4, 7, 4)),
        by(fact("weighted-interval-scheduling.pl", clause(7)))
      )
    ])
  )
).

weighted_interval_answer(chosen_interval, interval(8, 8, 11, 4)).
why(
  weighted_interval_answer(chosen_interval, interval(8, 8, 11, 4)),
  proof(
    goal(weighted_interval_answer(chosen_interval, interval(8, 8, 11, 4))),
    by(rule("weighted-interval-scheduling.pl", clause(20))),
    bindings([binding("I", 8), binding("Start", 8), binding("Finish", 11), binding("Value", 4)]),
    uses([
      proof(
        goal(chosen_from(1, 8)),
        by(rule("weighted-interval-scheduling.pl", clause(17))),
        bindings([binding("I", 1), binding("Chosen", 8), binding("Best", 13), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
        uses([
          proof(
            goal(best_from(1, 13)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 1), binding("Best", 13), binding("Last", 8), binding("Next", 2), binding("Skip", 12), binding("Compatible", 4), binding("Tail", 8), binding("_start", 1), binding("_finish", 4), binding("Value", 5), binding("Take", 13)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(1, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(2, '+'(1, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(2, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(2, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(3, '+'(2, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(3, 12)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(3, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(4, '+'(3, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(4, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(5, '+'(4, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(5, 6)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(5, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(6, '+'(5, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(6, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(6, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(7, '+'(6, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(7, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(7, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(8, '+'(7, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(8, 4)),
                                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                        uses([
                                          proof(
                                            goal(last_interval(8)),
                                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                                          ),
                                          proof(
                                            goal(=<(8, 8)),
                                            by(builtin(=<, 2))
                                          ),
                                          proof(
                                            goal(is(9, '+'(8, 1))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(next_compatible(8, 9)),
                                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                            uses([
                                              proof(
                                                goal(interval(8, 8, 11, 4)),
                                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                                              ),
                                              proof(
                                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                                by(builtin('\\+', 1))
                                              )
                                            ])
                                          ),
                                          proof(
                                            goal(best_from(9, 0)),
                                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                                          ),
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal(is(4, '+'(4, 0))),
                                            by(builtin(is, 2))
                                          ),
                                          proof(
                                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                            by(builtin(';', 2))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(next_compatible(7, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                        uses([
                                          proof(
                                            goal(interval(7, 6, 10, 2)),
                                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal(is(2, '+'(2, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(6, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                    uses([
                                      proof(
                                        goal(interval(6, 5, 9, 3)),
                                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal(is(3, '+'(3, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(5, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                                uses([
                                  proof(
                                    goal(interval(5, 3, 9, 6)),
                                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal(is(6, '+'(6, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(4, 8)),
                            by(rule("weighted-interval-scheduling.pl", clause(12))),
                            bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(4, 4, 7, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(7)))
                              ),
                              proof(
                                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                                by(library(aggregate_min, 5))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(is(8, '+'(4, 4))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(3, 7)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                        uses([
                          proof(
                            goal(interval(3, 0, 6, 8)),
                            by(fact("weighted-interval-scheduling.pl", clause(6)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(is(12, '+'(8, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(2, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                    uses([
                      proof(
                        goal(interval(2, 3, 5, 1)),
                        by(fact("weighted-interval-scheduling.pl", clause(5)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(is(5, '+'(1, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(1, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
                uses([
                  proof(
                    goal(interval(1, 1, 4, 5)),
                    by(fact("weighted-interval-scheduling.pl", clause(4)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(4, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(5, '+'(4, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(5, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(5, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(6, '+'(5, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(6, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(6, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(7, '+'(6, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(7, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(7, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(8, '+'(7, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(8, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(8, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(9, '+'(8, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(next_compatible(8, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                    uses([
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal(is(4, '+'(4, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(7, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                uses([
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal(is(2, '+'(2, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(6, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                            uses([
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal(is(3, '+'(3, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(5, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                        uses([
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal(is(6, '+'(6, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(is(8, '+'(4, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(is(13, '+'(5, 8))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(13, 12), =(13, 13)), =(13, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(is(2, '+'(1, 1))),
            by(builtin(is, 2))
          ),
          proof(
            goal(best_from(2, 12)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 2), binding("Best", 12), binding("Last", 8), binding("Next", 3), binding("Skip", 12), binding("Compatible", 6), binding("Tail", 4), binding("_start", 3), binding("_finish", 5), binding("Value", 1), binding("Take", 5)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(2, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(3, '+'(2, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(3, 12)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 3), binding("Best", 12), binding("Last", 8), binding("Next", 4), binding("Skip", 8), binding("Compatible", 7), binding("Tail", 4), binding("_start", 0), binding("_finish", 6), binding("Value", 8), binding("Take", 12)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(3, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(4, '+'(3, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(4, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(5, '+'(4, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(5, 6)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(5, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(6, '+'(5, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(6, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(6, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(7, '+'(6, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(7, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(7, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(8, '+'(7, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(8, 4)),
                                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                    uses([
                                      proof(
                                        goal(last_interval(8)),
                                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                                      ),
                                      proof(
                                        goal(=<(8, 8)),
                                        by(builtin(=<, 2))
                                      ),
                                      proof(
                                        goal(is(9, '+'(8, 1))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(next_compatible(8, 9)),
                                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                        uses([
                                          proof(
                                            goal(interval(8, 8, 11, 4)),
                                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                                          ),
                                          proof(
                                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                            by(builtin('\\+', 1))
                                          )
                                        ])
                                      ),
                                      proof(
                                        goal(best_from(9, 0)),
                                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                                      ),
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal(is(4, '+'(4, 0))),
                                        by(builtin(is, 2))
                                      ),
                                      proof(
                                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                        by(builtin(';', 2))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(next_compatible(7, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                    uses([
                                      proof(
                                        goal(interval(7, 6, 10, 2)),
                                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal(is(2, '+'(2, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(6, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                                uses([
                                  proof(
                                    goal(interval(6, 5, 9, 3)),
                                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal(is(3, '+'(3, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(5, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                            uses([
                              proof(
                                goal(interval(5, 3, 9, 6)),
                                by(fact("weighted-interval-scheduling.pl", clause(8)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal(is(6, '+'(6, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(4, 8)),
                        by(rule("weighted-interval-scheduling.pl", clause(12))),
                        bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(4, 4, 7, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(7)))
                          ),
                          proof(
                            goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                            by(library(aggregate_min, 5))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(is(8, '+'(4, 4))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(3, 7)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 3), binding("J", 7), binding("_start", 0), binding("Finish", 6), binding("_value", 8)]),
                    uses([
                      proof(
                        goal(interval(3, 0, 6, 8)),
                        by(fact("weighted-interval-scheduling.pl", clause(6)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 3), >=(Startk, 6)), 7, 7)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(3, 0, 6, 8)),
                    by(fact("weighted-interval-scheduling.pl", clause(6)))
                  ),
                  proof(
                    goal(is(12, '+'(8, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(12, 8), =(12, 12)), =(12, 8))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(2, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 2), binding("J", 6), binding("_start", 3), binding("Finish", 5), binding("_value", 1)]),
                uses([
                  proof(
                    goal(interval(2, 3, 5, 1)),
                    by(fact("weighted-interval-scheduling.pl", clause(5)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 2), >=(Startk, 5)), 6, 6)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(6, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(6, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(7, '+'(6, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(7, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(7, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(8, '+'(7, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(8, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(8, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(9, '+'(8, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(next_compatible(8, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                            uses([
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal(is(4, '+'(4, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(7, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                        uses([
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(7, 6, 10, 2)),
                        by(fact("weighted-interval-scheduling.pl", clause(10)))
                      ),
                      proof(
                        goal(is(2, '+'(2, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(6, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                    uses([
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(6, 5, 9, 3)),
                    by(fact("weighted-interval-scheduling.pl", clause(9)))
                  ),
                  proof(
                    goal(is(3, '+'(3, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(2, 3, 5, 1)),
                by(fact("weighted-interval-scheduling.pl", clause(5)))
              ),
              proof(
                goal(is(5, '+'(1, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(5, 12), =(12, 5)), =(12, 12))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(next_compatible(1, 4)),
            by(rule("weighted-interval-scheduling.pl", clause(12))),
            bindings([binding("I", 1), binding("J", 4), binding("_start", 1), binding("Finish", 4), binding("_value", 5)]),
            uses([
              proof(
                goal(interval(1, 1, 4, 5)),
                by(fact("weighted-interval-scheduling.pl", clause(4)))
              ),
              proof(
                goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 1), >=(Startk, 4)), 4, 4)),
                by(library(aggregate_min, 5))
              )
            ])
          ),
          proof(
            goal(best_from(4, 8)),
            by(rule("weighted-interval-scheduling.pl", clause(15))),
            bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(last_interval(8)),
                by(fact("weighted-interval-scheduling.pl", clause(2)))
              ),
              proof(
                goal(=<(4, 8)),
                by(builtin(=<, 2))
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                by(builtin(';', 2))
              )
            ])
          ),
          proof(
            goal(interval(1, 1, 4, 5)),
            by(fact("weighted-interval-scheduling.pl", clause(4)))
          ),
          proof(
            goal(is(13, '+'(5, 8))),
            by(builtin(is, 2))
          ),
          proof(
            goal(=(13, 13)),
            by(builtin(=, 2))
          ),
          proof(
            goal(>=(13, 12)),
            by(builtin(>=, 2))
          ),
          proof(
            goal(chosen_from(4, 8)),
            by(rule("weighted-interval-scheduling.pl", clause(17))),
            bindings([binding("I", 4), binding("Chosen", 8), binding("Best", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
            uses([
              proof(
                goal(best_from(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 4), binding("Best", 8), binding("Last", 8), binding("Next", 5), binding("Skip", 6), binding("Compatible", 8), binding("Tail", 4), binding("_start", 4), binding("_finish", 7), binding("Value", 4), binding("Take", 8)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(4, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(5, '+'(4, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(5, 6)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(5, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(6, '+'(5, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(6, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(6, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(7, '+'(6, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(7, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(7, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(8, '+'(7, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(8, 4)),
                                by(rule("weighted-interval-scheduling.pl", clause(15))),
                                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                                uses([
                                  proof(
                                    goal(last_interval(8)),
                                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                                  ),
                                  proof(
                                    goal(=<(8, 8)),
                                    by(builtin(=<, 2))
                                  ),
                                  proof(
                                    goal(is(9, '+'(8, 1))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(next_compatible(8, 9)),
                                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                    uses([
                                      proof(
                                        goal(interval(8, 8, 11, 4)),
                                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                                      ),
                                      proof(
                                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                        by(builtin('\\+', 1))
                                      )
                                    ])
                                  ),
                                  proof(
                                    goal(best_from(9, 0)),
                                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                                  ),
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal(is(4, '+'(4, 0))),
                                    by(builtin(is, 2))
                                  ),
                                  proof(
                                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                    by(builtin(';', 2))
                                  )
                                ])
                              ),
                              proof(
                                goal(next_compatible(7, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                                uses([
                                  proof(
                                    goal(interval(7, 6, 10, 2)),
                                    by(fact("weighted-interval-scheduling.pl", clause(10)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal(is(2, '+'(2, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(6, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                            uses([
                              proof(
                                goal(interval(6, 5, 9, 3)),
                                by(fact("weighted-interval-scheduling.pl", clause(9)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal(is(3, '+'(3, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(5, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                        uses([
                          proof(
                            goal(interval(5, 3, 9, 6)),
                            by(fact("weighted-interval-scheduling.pl", clause(8)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal(is(6, '+'(6, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(4, 8)),
                    by(rule("weighted-interval-scheduling.pl", clause(12))),
                    bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(4, 4, 7, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(7)))
                      ),
                      proof(
                        goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                        by(library(aggregate_min, 5))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(is(8, '+'(4, 4))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(8, 6), =(8, 8)), =(8, 6))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(is(5, '+'(4, 1))),
                by(builtin(is, 2))
              ),
              proof(
                goal(best_from(5, 6)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 5), binding("Best", 6), binding("Last", 8), binding("Next", 6), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 3), binding("_finish", 9), binding("Value", 6), binding("Take", 6)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(5, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(6, '+'(5, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(6, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 6), binding("Best", 4), binding("Last", 8), binding("Next", 7), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 5), binding("_finish", 9), binding("Value", 3), binding("Take", 3)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(6, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(7, '+'(6, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(7, 4)),
                        by(rule("weighted-interval-scheduling.pl", clause(15))),
                        bindings([binding("I", 7), binding("Best", 4), binding("Last", 8), binding("Next", 8), binding("Skip", 4), binding("Compatible", 9), binding("Tail", 0), binding("_start", 6), binding("_finish", 10), binding("Value", 2), binding("Take", 2)]),
                        uses([
                          proof(
                            goal(last_interval(8)),
                            by(fact("weighted-interval-scheduling.pl", clause(2)))
                          ),
                          proof(
                            goal(=<(7, 8)),
                            by(builtin(=<, 2))
                          ),
                          proof(
                            goal(is(8, '+'(7, 1))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(best_from(8, 4)),
                            by(rule("weighted-interval-scheduling.pl", clause(15))),
                            bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                            uses([
                              proof(
                                goal(last_interval(8)),
                                by(fact("weighted-interval-scheduling.pl", clause(2)))
                              ),
                              proof(
                                goal(=<(8, 8)),
                                by(builtin(=<, 2))
                              ),
                              proof(
                                goal(is(9, '+'(8, 1))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(next_compatible(8, 9)),
                                by(rule("weighted-interval-scheduling.pl", clause(13))),
                                bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                                uses([
                                  proof(
                                    goal(interval(8, 8, 11, 4)),
                                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                                  ),
                                  proof(
                                    goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                                    by(builtin('\\+', 1))
                                  )
                                ])
                              ),
                              proof(
                                goal(best_from(9, 0)),
                                by(fact("weighted-interval-scheduling.pl", clause(14)))
                              ),
                              proof(
                                goal(interval(8, 8, 11, 4)),
                                by(fact("weighted-interval-scheduling.pl", clause(11)))
                              ),
                              proof(
                                goal(is(4, '+'(4, 0))),
                                by(builtin(is, 2))
                              ),
                              proof(
                                goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                                by(builtin(';', 2))
                              )
                            ])
                          ),
                          proof(
                            goal(next_compatible(7, 9)),
                            by(rule("weighted-interval-scheduling.pl", clause(13))),
                            bindings([binding("I", 7), binding("_start", 6), binding("Finish", 10), binding("_value", 2)]),
                            uses([
                              proof(
                                goal(interval(7, 6, 10, 2)),
                                by(fact("weighted-interval-scheduling.pl", clause(10)))
                              ),
                              proof(
                                goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 7), >=(Startk, 10)))),
                                by(builtin('\\+', 1))
                              )
                            ])
                          ),
                          proof(
                            goal(best_from(9, 0)),
                            by(fact("weighted-interval-scheduling.pl", clause(14)))
                          ),
                          proof(
                            goal(interval(7, 6, 10, 2)),
                            by(fact("weighted-interval-scheduling.pl", clause(10)))
                          ),
                          proof(
                            goal(is(2, '+'(2, 0))),
                            by(builtin(is, 2))
                          ),
                          proof(
                            goal(';'(->(>=(2, 4), =(4, 2)), =(4, 4))),
                            by(builtin(';', 2))
                          )
                        ])
                      ),
                      proof(
                        goal(next_compatible(6, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 6), binding("_start", 5), binding("Finish", 9), binding("_value", 3)]),
                        uses([
                          proof(
                            goal(interval(6, 5, 9, 3)),
                            by(fact("weighted-interval-scheduling.pl", clause(9)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 6), >=(Startk, 9)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(6, 5, 9, 3)),
                        by(fact("weighted-interval-scheduling.pl", clause(9)))
                      ),
                      proof(
                        goal(is(3, '+'(3, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(3, 4), =(4, 3)), =(4, 4))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(next_compatible(5, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 5), binding("_start", 3), binding("Finish", 9), binding("_value", 6)]),
                    uses([
                      proof(
                        goal(interval(5, 3, 9, 6)),
                        by(fact("weighted-interval-scheduling.pl", clause(8)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 5), >=(Startk, 9)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(5, 3, 9, 6)),
                    by(fact("weighted-interval-scheduling.pl", clause(8)))
                  ),
                  proof(
                    goal(is(6, '+'(6, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(6, 4), =(6, 6)), =(6, 4))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(next_compatible(4, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(12))),
                bindings([binding("I", 4), binding("J", 8), binding("_start", 4), binding("Finish", 7), binding("_value", 4)]),
                uses([
                  proof(
                    goal(interval(4, 4, 7, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(7)))
                  ),
                  proof(
                    goal(aggregate_min(Value, Value, (interval(Value, Startk, _finishk, _valuek), >(Value, 4), >=(Startk, 7)), 8, 8)),
                    by(library(aggregate_min, 5))
                  )
                ])
              ),
              proof(
                goal(best_from(8, 4)),
                by(rule("weighted-interval-scheduling.pl", clause(15))),
                bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(last_interval(8)),
                    by(fact("weighted-interval-scheduling.pl", clause(2)))
                  ),
                  proof(
                    goal(=<(8, 8)),
                    by(builtin(=<, 2))
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                    by(builtin(';', 2))
                  )
                ])
              ),
              proof(
                goal(interval(4, 4, 7, 4)),
                by(fact("weighted-interval-scheduling.pl", clause(7)))
              ),
              proof(
                goal(is(8, '+'(4, 4))),
                by(builtin(is, 2))
              ),
              proof(
                goal(=(8, 8)),
                by(builtin(=, 2))
              ),
              proof(
                goal(>=(8, 6)),
                by(builtin(>=, 2))
              ),
              proof(
                goal(chosen_from(8, 8)),
                by(rule("weighted-interval-scheduling.pl", clause(16))),
                bindings([binding("I", 8), binding("Best", 4), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                uses([
                  proof(
                    goal(best_from(8, 4)),
                    by(rule("weighted-interval-scheduling.pl", clause(15))),
                    bindings([binding("I", 8), binding("Best", 4), binding("Last", 8), binding("Next", 9), binding("Skip", 0), binding("Compatible", 9), binding("Tail", 0), binding("_start", 8), binding("_finish", 11), binding("Value", 4), binding("Take", 4)]),
                    uses([
                      proof(
                        goal(last_interval(8)),
                        by(fact("weighted-interval-scheduling.pl", clause(2)))
                      ),
                      proof(
                        goal(=<(8, 8)),
                        by(builtin(=<, 2))
                      ),
                      proof(
                        goal(is(9, '+'(8, 1))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(next_compatible(8, 9)),
                        by(rule("weighted-interval-scheduling.pl", clause(13))),
                        bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                        uses([
                          proof(
                            goal(interval(8, 8, 11, 4)),
                            by(fact("weighted-interval-scheduling.pl", clause(11)))
                          ),
                          proof(
                            goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                            by(builtin('\\+', 1))
                          )
                        ])
                      ),
                      proof(
                        goal(best_from(9, 0)),
                        by(fact("weighted-interval-scheduling.pl", clause(14)))
                      ),
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal(is(4, '+'(4, 0))),
                        by(builtin(is, 2))
                      ),
                      proof(
                        goal(';'(->(>=(4, 0), =(4, 4)), =(4, 0))),
                        by(builtin(';', 2))
                      )
                    ])
                  ),
                  proof(
                    goal(is(9, '+'(8, 1))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(next_compatible(8, 9)),
                    by(rule("weighted-interval-scheduling.pl", clause(13))),
                    bindings([binding("I", 8), binding("_start", 8), binding("Finish", 11), binding("_value", 4)]),
                    uses([
                      proof(
                        goal(interval(8, 8, 11, 4)),
                        by(fact("weighted-interval-scheduling.pl", clause(11)))
                      ),
                      proof(
                        goal('\\+'((interval(K, Startk, _finishk, _valuek), >(K, 8), >=(Startk, 11)))),
                        by(builtin('\\+', 1))
                      )
                    ])
                  ),
                  proof(
                    goal(best_from(9, 0)),
                    by(fact("weighted-interval-scheduling.pl", clause(14)))
                  ),
                  proof(
                    goal(interval(8, 8, 11, 4)),
                    by(fact("weighted-interval-scheduling.pl", clause(11)))
                  ),
                  proof(
                    goal(is(4, '+'(4, 0))),
                    by(builtin(is, 2))
                  ),
                  proof(
                    goal(=(4, 4)),
                    by(builtin(=, 2))
                  ),
                  proof(
                    goal(>=(4, 0)),
                    by(builtin(>=, 2))
                  )
                ])
              )
            ])
          )
        ])
      ),
      proof(
        goal(interval(8, 8, 11, 4)),
        by(fact("weighted-interval-scheduling.pl", clause(11)))
      )
    ])
  )
).

weighted_interval_answer(candidate_count, 8).
why(
  weighted_interval_answer(candidate_count, 8),
  proof(
    goal(weighted_interval_answer(candidate_count, 8)),
    by(rule("weighted-interval-scheduling.pl", clause(21))),
    bindings([binding("Count", 8)]),
    uses([
      proof(
        goal(countall(interval(_i, _start, _finish, _value), 8)),
        by(library(countall, 2))
      )
    ])
  )
).

