% Knowledge-engineering alignment flow in eyelang.
% Local source predicates are aligned once and then reused to produce a target-shaped flow view.
% fpv_* atoms denote a tiny local Flow/Policy Vocabulary profile.

materialize(type, 2).
materialize(target_fact, 3).
materialize(runtime_rule, 2).
materialize(target_predicate, 2).
materialize(flow_emits, 2).
materialize(trusted_by, 2).

sub_class(local_observation, sosa_observation).
sub_class(temperature_probe, sosa_sensor).
sub_property(observed_by, sosa_madeBySensor).
sub_property(observed_at, sosa_resultTime).
sub_property(temperature_celsius, sosa_hasSimpleResult).
sub_property(in_flow, fpv_hasFlowStep).
equivalent_property(observed_feature, sosa_hasFeatureOfInterest).

type(msg1, local_observation).
type(probe7, temperature_probe).
triple(msg1, observed_by, probe7).
triple(msg1, observed_at, "2026-06-17T12:34:56Z").
triple(msg1, temperature_celsius, 18.6).
triple(msg1, observed_feature, platform_b).
triple(msg1, in_flow, ingest_step).

% Generic alignment rules.
type(Thing, Super) :- type(Thing, Class), sub_class(Class, Super).
target_fact(Subject, SuperPredicate, Object) :- triple(Subject, Predicate, Object), sub_property(Predicate, SuperPredicate).
target_fact(Subject, TargetPredicate, Object) :- triple(Subject, Predicate, Object), equivalent_property(Predicate, TargetPredicate).
target_fact(Subject, SourcePredicate, Object) :- triple(Subject, Predicate, Object), equivalent_property(SourcePredicate, Predicate).

runtime_rule(SourcePredicate, copy_to_target) :- sub_property(SourcePredicate, _TargetPredicate).
runtime_rule(SourcePredicate, copy_to_target) :- equivalent_property(SourcePredicate, _TargetPredicate).
target_predicate(SourcePredicate, TargetPredicate) :- sub_property(SourcePredicate, TargetPredicate).
target_predicate(SourcePredicate, TargetPredicate) :- equivalent_property(SourcePredicate, TargetPredicate).

flow_emits(Step, Message) :- type(Message, sosa_observation), target_fact(Message, fpv_hasFlowStep, Step), target_fact(Message, sosa_madeBySensor, _Sensor).
trusted_by(Step, Sensor) :- type(Message, sosa_observation), target_fact(Message, fpv_hasFlowStep, Step), target_fact(Message, sosa_madeBySensor, Sensor).
