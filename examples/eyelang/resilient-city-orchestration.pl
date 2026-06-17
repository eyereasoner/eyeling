% Resilient-city orchestration scenario.
%
% This example is intentionally richer than a single puzzle.  It combines raw
% incident signals, policy-as-data, route search, team capabilities, negation,
% aggregation, finite optimization, and materialized audit output.  The result is
% a compact declarative emergency plan: facts describe the world; rules decide
% which missions are lawful, reachable, and worth funding under cost/risk caps.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(incidentSummary, 2).
materialize(activeSignal, 2).
materialize(criticalNeed, 2).
materialize(policyClearance, 2).
materialize(usableRoute, 2).
materialize(eligibleAssignment, 2).
materialize(candidateMission, 2).
materialize(blockedMission, 2).
materialize(bestResponse, 2).
materialize(selectedMission, 2).
materialize(selectedTeam, 2).
materialize(selectedRoute, 2).
materialize(coveredNeed, 2).
materialize(unmetNeed, 2).
materialize(readinessCheck, 2).
materialize(auditTrail, 2).
materialize(recommendation, 2).

% Program structure: facts set up the storm response, and rules derive the final plan.
incident(civic_storm).
incident_label(civic_storm, "CivicStorm Alpha").
incident_goal(civic_storm, "protect people, medicine, and power without using prohibited surveillance").
budget_cap(civic_storm, 105).
risk_cap(civic_storm, 60).
route_risk_cap(civic_storm, 20).
route_minutes_cap(civic_storm, 45).

% Sensor readings are deliberately low-level; rules below turn them into needs.
reading(river_gauge_cm, 318).
threshold(river_gauge_cm, 280).
reading(hospital_generator_hours, 5).
threshold_low(hospital_generator_hours, 8).
reading(clinic_refrigerator_hours, 4).
threshold_low(clinic_refrigerator_hours, 6).
reading(substation_load_percent, 94).
threshold(substation_load_percent, 85).

% The deployable skills are stored as quoted formula data and projected by
% holds/2, showing how policy documents can be reasoned over as data.
policy_bundle(response_policy, (
  permission(medical_transport, deploy),
  permission(cold_chain, deploy),
  permission(grid_repair, deploy),
  permission(shelter_ops, deploy),
  permission(drone_mapping, deploy),
  permission(public_info, deploy),
  prohibition(public_face_recognition, deploy)
)).

% Teams can only serve missions whose skill they possess and whose route is usable.
team(alpha_ambulance).
teamSkill(alpha_ambulance, medical_transport).
teamStatus(alpha_ambulance, ready).
team(beta_coldchain).
teamSkill(beta_coldchain, cold_chain).
teamStatus(beta_coldchain, ready).
team(delta_grid).
teamSkill(delta_grid, grid_repair).
teamStatus(delta_grid, ready).
team(gamma_shelter).
teamSkill(gamma_shelter, shelter_ops).
teamStatus(gamma_shelter, ready).
team(echo_drone).
teamSkill(echo_drone, drone_mapping).
teamStatus(echo_drone, ready).
team(foxtrot_comms).
teamSkill(foxtrot_comms, public_info).
teamStatus(foxtrot_comms, ready).
team(omega_vision).
teamSkill(omega_vision, public_face_recognition).
teamStatus(omega_vision, ready).

% The road graph is directed.  bounded_path/5 discovers simple bounded routes.
road(base, north_gate).
road(north_gate, hospital_quay).
road(base, cold_depot).
road(cold_depot, clinic_east).
road(north_gate, substation_east).
road(base, civic_center).
road(civic_center, high_school).
road(civic_center, riverside).
road(civic_center, civic_square).
road(base, west_bridge).
road(west_bridge, west_bank).

zone(hospital_quay).
zone(clinic_east).
zone(substation_east).
zone(high_school).
zone(riverside).
zone(civic_square).
zone(west_bank).

routeRisk(hospital_quay, 9).
routeRisk(clinic_east, 5).
routeRisk(substation_east, 10).
routeRisk(high_school, 4).
routeRisk(riverside, 6).
routeRisk(civic_square, 3).
routeRisk(west_bank, 24).
routeMinutes(hospital_quay, 22).
routeMinutes(clinic_east, 19).
routeMinutes(substation_east, 31).
routeMinutes(high_school, 17).
routeMinutes(riverside, 21).
routeMinutes(civic_square, 15).
routeMinutes(west_bank, 42).

% Mission facts carry the operational need, location, required skill, value,
% budget cost, and base risk.  Route risk is added by candidateMission/2.
missionBase(evacuate_hospital, evacuate_hospital, hospital_quay, medical_transport, 95, 34, 5).
missionBase(deliver_insulin, deliver_medicine, clinic_east, cold_chain, 70, 16, 4).
missionBase(stabilize_substation, stabilize_substation, substation_east, grid_repair, 85, 25, 8).
missionBase(open_school_shelter, open_shelter, high_school, shelter_ops, 60, 14, 2).
missionBase(map_flood_front, map_flood_front, riverside, drone_mapping, 45, 8, 2).
missionBase(public_dashboard, public_information, civic_square, public_info, 28, 12, 1).
missionBase(face_scan_crowds, situational_awareness, civic_square, public_face_recognition, 90, 20, 2).
missionBase(resupply_west_bank, shelter_supply, west_bank, shelter_ops, 50, 20, 5).

% Memoized derived predicates keep the example readable while avoiding repeated finite searches.
memoize(usableRoute, 2).
memoize(candidateMission, 2).
memoize(bestResponse, 2).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
incidentSummary(Incident, summary(Label, Goal, budget(Budget), riskCap(RiskCap))) :-
  incident_label(Incident, Label),
  incident_goal(Incident, Goal),
  budget_cap(Incident, Budget),
  risk_cap(Incident, RiskCap).

activeSignal(civic_storm, river_surge) :-
  reading(river_gauge_cm, Value),
  threshold(river_gauge_cm, Threshold),
  ge(Value, Threshold).
activeSignal(civic_storm, hospital_power_risk) :-
  reading(hospital_generator_hours, Value),
  threshold_low(hospital_generator_hours, Threshold),
  le(Value, Threshold).
activeSignal(civic_storm, medicine_cold_chain_risk) :-
  reading(clinic_refrigerator_hours, Value),
  threshold_low(clinic_refrigerator_hours, Threshold),
  le(Value, Threshold).
activeSignal(civic_storm, grid_stress) :-
  reading(substation_load_percent, Value),
  threshold(substation_load_percent, Threshold),
  ge(Value, Threshold).

criticalNeed(civic_storm, evacuate_hospital) :-
  activeSignal(civic_storm, river_surge),
  activeSignal(civic_storm, hospital_power_risk).
criticalNeed(civic_storm, deliver_medicine) :-
  activeSignal(civic_storm, medicine_cold_chain_risk).
criticalNeed(civic_storm, stabilize_substation) :-
  activeSignal(civic_storm, grid_stress).
criticalNeed(civic_storm, open_shelter) :-
  activeSignal(civic_storm, river_surge).
criticalNeed(civic_storm, map_flood_front) :-
  activeSignal(civic_storm, river_surge).

policyClearance(Skill, deploy) :-
  policy_bundle(response_policy, Context),
  holds(Context, permission(Skill, deploy)),
  not(policyBlocked(Skill, deploy)).

policyBlocked(Skill, deploy) :-
  policy_bundle(response_policy, Context),
  holds(Context, prohibition(Skill, deploy)).

usableRoute(Zone, route(Path, minutes(Minutes), risk(RouteRisk))) :-
  zone(Zone),
  bounded_path(road, base, Zone, 3, Path),
  routeMinutes(Zone, Minutes),
  routeRisk(Zone, RouteRisk),
  route_minutes_cap(civic_storm, MinutesCap),
  route_risk_cap(civic_storm, RiskCap),
  le(Minutes, MinutesCap),
  le(RouteRisk, RiskCap).

eligibleAssignment(Mission, assignment(Team, Path)) :-
  missionBase(Mission, _Need, Zone, Skill, _Value, _Cost, _BaseRisk),
  policyClearance(Skill, deploy),
  teamSkill(Team, Skill),
  teamStatus(Team, ready),
  usableRoute(Zone, route(Path, minutes(_Minutes), risk(_RouteRisk))).

candidateMission(Mission, score(Value, Cost, TotalRisk, Team, Path)) :-
  missionBase(Mission, _Need, Zone, Skill, Value, Cost, BaseRisk),
  policyClearance(Skill, deploy),
  teamSkill(Team, Skill),
  teamStatus(Team, ready),
  usableRoute(Zone, route(Path, minutes(_Minutes), risk(RouteRisk))),
  add(BaseRisk, RouteRisk, TotalRisk).

blockedMission(Mission, policy_prohibition) :-
  missionBase(Mission, _Need, _Zone, Skill, _Value, _Cost, _BaseRisk),
  policyBlocked(Skill, deploy).
blockedMission(Mission, route_risk_too_high) :-
  missionBase(Mission, _Need, Zone, _Skill, _Value, _Cost, _BaseRisk),
  routeRisk(Zone, RouteRisk),
  route_risk_cap(civic_storm, Cap),
  gt(RouteRisk, Cap).
blockedMission(Mission, no_eligible_assignment) :-
  missionBase(Mission, _Need, _Zone, _Skill, _Value, _Cost, _BaseRisk),
  not(candidateMission(Mission, _Score)),
  not(blockedMission(Mission, policy_prohibition)),
  not(blockedMission(Mission, route_risk_too_high)).

missionItem(p(Mission, Value, Cost, Risk)) :-
  candidateMission(Mission, score(Value, Cost, Risk, _Team, _Path)).

missionItems(Items) :-
  findall(Item, missionItem(Item), Items).

missionAddressesNeed(Mission, Need) :-
  missionBase(Mission, Need, _Zone, _Skill, _Value, _Cost, _BaseRisk).

planCoversNeed(Plan, Need) :-
  member(Mission, Plan),
  missionAddressesNeed(Mission, Need).

uncoveredNeedInPlan(Plan, Need) :-
  criticalNeed(civic_storm, Need),
  not(planCoversNeed(Plan, Need)).

coversAllCriticalNeeds(Plan) :-
  not(uncoveredNeedInPlan(Plan, _Need)).

candidateResponse(Plan, Value, Cost, Risk, NegCost, NegRisk) :-
  budget_cap(civic_storm, Budget),
  risk_cap(civic_storm, RiskCap),
  missionItems(Items),
  bounded_subset(Items, Budget, RiskCap, Plan, Value, Cost, Risk),
  coversAllCriticalNeeds(Plan),
  neg(Cost, NegCost),
  neg(Risk, NegRisk).

bestResponse(civic_storm, response(value(Value), cost(Cost), risk(Risk), missions(Plan))) :-
  aggregate_max(
    [Value, NegCost, NegRisk, Plan],
    response(value(Value), cost(Cost), risk(Risk), missions(Plan)),
    candidateResponse(Plan, Value, Cost, Risk, NegCost, NegRisk),
    _Key,
    response(value(Value), cost(Cost), risk(Risk), missions(Plan))).

selectedMission(civic_storm, Mission) :-
  bestResponse(civic_storm, response(value(_Value), cost(_Cost), risk(_Risk), missions(Plan))),
  member(Mission, Plan).

selectedTeam(Mission, Team) :-
  selectedMission(civic_storm, Mission),
  candidateMission(Mission, score(_Value, _Cost, _Risk, Team, _Path)).

selectedRoute(Mission, Path) :-
  selectedMission(civic_storm, Mission),
  candidateMission(Mission, score(_Value, _Cost, _Risk, _Team, Path)).

coveredNeed(civic_storm, Need) :-
  selectedMission(civic_storm, Mission),
  missionAddressesNeed(Mission, Need).

unmetNeed(civic_storm, Need) :-
  bestResponse(civic_storm, response(value(_Value), cost(_Cost), risk(_Risk), missions(Plan))),
  uncoveredNeedInPlan(Plan, Need).
unmetNeed(civic_storm, none) :-
  bestResponse(civic_storm, response(value(_Value), cost(_Cost), risk(_Risk), missions(Plan))),
  coversAllCriticalNeeds(Plan).

readinessCheck(civic_storm, all_critical_needs_covered) :-
  unmetNeed(civic_storm, none).
readinessCheck(civic_storm, budget_and_risk_caps_respected) :-
  bestResponse(civic_storm, response(value(_Value), cost(Cost), risk(Risk), missions(_Plan))),
  budget_cap(civic_storm, Budget),
  risk_cap(civic_storm, Cap),
  le(Cost, Budget),
  le(Risk, Cap).
readinessCheck(civic_storm, prohibited_surveillance_rejected) :-
  blockedMission(face_scan_crowds, policy_prohibition).
readinessCheck(civic_storm, dangerous_west_bank_route_rejected) :-
  blockedMission(resupply_west_bank, route_risk_too_high).

auditTrail(civic_storm, "raw sensor thresholds derive operational needs before search") :-
  eq(ok, ok).
auditTrail(civic_storm, "policy formula data is projected into deployable skill clearances") :-
  eq(ok, ok).
auditTrail(civic_storm, "bounded route search and team capabilities create candidate missions") :-
  eq(ok, ok).
auditTrail(civic_storm, "bounded_subset and aggregate_max choose the highest-value safe portfolio") :-
  eq(ok, ok).

recommendation(civic_storm, "activate the selected mission portfolio; do not deploy face recognition; defer west-bank resupply until route risk drops") :-
  readinessCheck(civic_storm, all_critical_needs_covered),
  readinessCheck(civic_storm, prohibited_surveillance_rejected),
  readinessCheck(civic_storm, dangerous_west_bank_route_rejected).
