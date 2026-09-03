subgroups(d3_group, [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]]).
why(
  subgroups(d3_group, [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]]),
  proof(
    goal(subgroups(d3_group, [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])),
    by(rule("d3-group.pl", clause(57))),
    bindings([binding("Groups", [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])]),
    uses([
      proof(
        goal(all_subgroups([[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])),
        by(rule("d3-group.pl", clause(56))),
        bindings([binding("Groups", [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]]), binding("Raw", [[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]])]),
        uses([
          proof(
            goal(findall(G, valid_group(G), [[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]])),
            by(builtin(findall, 3))
          ),
          proof(
            goal(sort([[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]], [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])),
            by(builtin(sort, 2))
          )
        ])
      )
    ])
  )
).

subgroupCount(d3_group, 6).
why(
  subgroupCount(d3_group, 6),
  proof(
    goal(subgroupCount(d3_group, 6)),
    by(rule("d3-group.pl", clause(58))),
    bindings([binding("Count", 6), binding("Groups", [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])]),
    uses([
      proof(
        goal(all_subgroups([[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])),
        by(rule("d3-group.pl", clause(56))),
        bindings([binding("Groups", [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]]), binding("Raw", [[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]])]),
        uses([
          proof(
            goal(findall(G, valid_group(G), [[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]])),
            by(builtin(findall, 3))
          ),
          proof(
            goal(sort([[identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_a], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240], [identity]], [[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]])),
            by(builtin(sort, 2))
          )
        ])
      ),
      proof(
        goal(length([[identity], [identity, reflection_a], [identity, reflection_a, reflection_b, reflection_c, rotation_120, rotation_240], [identity, reflection_b], [identity, reflection_c], [identity, rotation_120, rotation_240]], 6)),
        by(library(length, 2))
      )
    ])
  )
).

