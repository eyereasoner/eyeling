incidentSummary(civic_storm, summary("CivicStorm Alpha", "protect people, medicine, and power without using prohibited surveillance", budget(105), riskCap(60))).
activeSignal(civic_storm, river_surge).
activeSignal(civic_storm, hospital_power_risk).
activeSignal(civic_storm, medicine_cold_chain_risk).
activeSignal(civic_storm, grid_stress).
criticalNeed(civic_storm, evacuate_hospital).
criticalNeed(civic_storm, deliver_medicine).
criticalNeed(civic_storm, stabilize_substation).
criticalNeed(civic_storm, open_shelter).
criticalNeed(civic_storm, map_flood_front).
policyClearance(medical_transport, deploy).
policyClearance(cold_chain, deploy).
policyClearance(grid_repair, deploy).
policyClearance(shelter_ops, deploy).
policyClearance(drone_mapping, deploy).
policyClearance(public_info, deploy).
usableRoute(hospital_quay, route([base, north_gate, hospital_quay], minutes(22), risk(9))).
usableRoute(clinic_east, route([base, cold_depot, clinic_east], minutes(19), risk(5))).
usableRoute(substation_east, route([base, north_gate, substation_east], minutes(31), risk(10))).
usableRoute(high_school, route([base, civic_center, high_school], minutes(17), risk(4))).
usableRoute(riverside, route([base, civic_center, riverside], minutes(21), risk(6))).
usableRoute(civic_square, route([base, civic_center, civic_square], minutes(15), risk(3))).
eligibleAssignment(evacuate_hospital, assignment(alpha_ambulance, [base, north_gate, hospital_quay])).
eligibleAssignment(deliver_insulin, assignment(beta_coldchain, [base, cold_depot, clinic_east])).
eligibleAssignment(stabilize_substation, assignment(delta_grid, [base, north_gate, substation_east])).
eligibleAssignment(open_school_shelter, assignment(gamma_shelter, [base, civic_center, high_school])).
eligibleAssignment(map_flood_front, assignment(echo_drone, [base, civic_center, riverside])).
eligibleAssignment(public_dashboard, assignment(foxtrot_comms, [base, civic_center, civic_square])).
candidateMission(evacuate_hospital, score(95, 34, 14, alpha_ambulance, [base, north_gate, hospital_quay])).
candidateMission(deliver_insulin, score(70, 16, 9, beta_coldchain, [base, cold_depot, clinic_east])).
candidateMission(stabilize_substation, score(85, 25, 18, delta_grid, [base, north_gate, substation_east])).
candidateMission(open_school_shelter, score(60, 14, 6, gamma_shelter, [base, civic_center, high_school])).
candidateMission(map_flood_front, score(45, 8, 8, echo_drone, [base, civic_center, riverside])).
candidateMission(public_dashboard, score(28, 12, 4, foxtrot_comms, [base, civic_center, civic_square])).
blockedMission(face_scan_crowds, policy_prohibition).
blockedMission(resupply_west_bank, route_risk_too_high).
bestResponse(civic_storm, response(value(355), cost(97), risk(55), missions([evacuate_hospital, deliver_insulin, stabilize_substation, open_school_shelter, map_flood_front]))).
selectedMission(civic_storm, evacuate_hospital).
selectedMission(civic_storm, deliver_insulin).
selectedMission(civic_storm, stabilize_substation).
selectedMission(civic_storm, open_school_shelter).
selectedMission(civic_storm, map_flood_front).
selectedTeam(evacuate_hospital, alpha_ambulance).
selectedTeam(deliver_insulin, beta_coldchain).
selectedTeam(stabilize_substation, delta_grid).
selectedTeam(open_school_shelter, gamma_shelter).
selectedTeam(map_flood_front, echo_drone).
selectedRoute(evacuate_hospital, [base, north_gate, hospital_quay]).
selectedRoute(deliver_insulin, [base, cold_depot, clinic_east]).
selectedRoute(stabilize_substation, [base, north_gate, substation_east]).
selectedRoute(open_school_shelter, [base, civic_center, high_school]).
selectedRoute(map_flood_front, [base, civic_center, riverside]).
coveredNeed(civic_storm, evacuate_hospital).
coveredNeed(civic_storm, deliver_medicine).
coveredNeed(civic_storm, stabilize_substation).
coveredNeed(civic_storm, open_shelter).
coveredNeed(civic_storm, map_flood_front).
unmetNeed(civic_storm, none).
readinessCheck(civic_storm, all_critical_needs_covered).
readinessCheck(civic_storm, budget_and_risk_caps_respected).
readinessCheck(civic_storm, prohibited_surveillance_rejected).
readinessCheck(civic_storm, dangerous_west_bank_route_rejected).
auditTrail(civic_storm, "raw sensor thresholds derive operational needs before search").
auditTrail(civic_storm, "policy formula data is projected into deployable skill clearances").
auditTrail(civic_storm, "bounded route search and team capabilities create candidate missions").
auditTrail(civic_storm, "bounded_subset and aggregate_max choose the highest-value safe portfolio").
recommendation(civic_storm, "activate the selected mission portfolio; do not deploy face recognition; defer west-bank resupply until route risk drops").
