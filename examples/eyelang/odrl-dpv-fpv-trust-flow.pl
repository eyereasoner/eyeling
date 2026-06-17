% ODRL + DPV + local FPV trust-flow decisioning in eyelang.

materialize(decision, 2).
materialize(confidence, 2).
materialize(status, 2).
materialize(risk, 2).

trust_score(hospital_a, 0.92).
trust_score(small_clinic, 0.63).
trust_score(ad_network, 0.28).

flow(flow_care, hospital_a, research_partner, lab_result, dpv_use, dpv_healthcare).
flow(flow_clinic, small_clinic, research_partner, lab_result, dpv_use, dpv_healthcare).
flow(flow_ads, hospital_a, ad_network, lab_result, dpv_share, dpv_marketing).

permission(permit_healthcare_research, research_partner, lab_result, dpv_use, dpv_healthcare, 0.80).
prohibition(prohibit_marketing_disclosure, ad_network, lab_result, dpv_share, dpv_marketing).

permitted_flow(Flow, Score) :-
  flow(Flow, Source, Recipient, Data, Action, Purpose),
  permission(_Permission, Recipient, Data, Action, Purpose, MinTrust),
  trust_score(Source, Score),
  ge(Score, MinTrust).

review_flow(Flow, Score) :-
  flow(Flow, Source, Recipient, Data, Action, Purpose),
  permission(_Permission, Recipient, Data, Action, Purpose, MinTrust),
  trust_score(Source, Score),
  lt(Score, MinTrust).

denied_flow(Flow) :-
  flow(Flow, _Source, Recipient, Data, Action, Purpose),
  prohibition(_Prohibition, Recipient, Data, Action, Purpose).

decision(Flow, fpv_permit) :- permitted_flow(Flow, _Score).
decision(Flow, fpv_review) :- review_flow(Flow, _Score).
decision(Flow, fpv_deny) :- denied_flow(Flow).
confidence(Flow, Score) :- permitted_flow(Flow, Score).
confidence(Flow, Score) :- review_flow(Flow, Score).
status(Flow, fpv_executable_flow) :- permitted_flow(Flow, _Score).
status(Flow, fpv_blocked_flow) :- denied_flow(Flow).
risk(Flow, risk_trustworthiness_risk) :- review_flow(Flow, _Score).
risk(Flow, risk_unwanted_disclosure_data) :- denied_flow(Flow).
