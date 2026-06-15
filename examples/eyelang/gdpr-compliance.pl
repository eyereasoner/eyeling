% GDPR-style compliance check: purpose, basis, minimisation, safeguards, and export.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% case_alpha is intended to pass; case_beta is intentionally incomplete.
processing(case_alpha).
processing(case_beta).

purpose(case_alpha, care_coordination).
purpose(case_beta, marketing).

legal_basis(case_alpha, explicit_consent).
% case_beta intentionally has no legal basis.

minimized(case_alpha).
not_minimized(case_beta).

special_category(case_alpha, health_data).
special_category(case_beta, health_data).

safeguard(case_alpha, encryption).
safeguard(case_alpha, access_logging).
safeguard(case_beta, encryption).

third_country_transfer(case_beta).
adequacy_decision(case_alpha).

% Compliance is decomposed into reusable checks so reasons can be reported.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
has_required_basis(Case) :- legal_basis(Case, explicit_consent).
has_required_basis(Case) :- legal_basis(Case, medical_care).

has_health_safeguards(Case) :-
  special_category(Case, health_data),
  safeguard(Case, encryption),
  safeguard(Case, access_logging).

transfer_ok(Case) :- not(third_country_transfer(Case)).
transfer_ok(Case) :- adequacy_decision(Case).

compliant(Case) :-
  processing(Case),
  has_required_basis(Case),
  minimized(Case),
  has_health_safeguards(Case),
  transfer_ok(Case).

% Individual failure rules explain why a case is noncompliant.
noncompliance_reason(Case, missing_legal_basis) :-
  processing(Case),
  not(has_required_basis(Case)).

noncompliance_reason(Case, not_minimized) :-
  not_minimized(Case).

noncompliance_reason(Case, missing_access_logging) :-
  special_category(Case, health_data),
  not(safeguard(Case, access_logging)).

noncompliance_reason(Case, transfer_without_adequacy) :-
  third_country_transfer(Case),
  not(adequacy_decision(Case)).

status(Case, gdpr_compliant) :- compliant(Case).
status(Case, gdpr_noncompliant) :- noncompliance_reason(Case, _Reason).
reason(Case, Reason) :- noncompliance_reason(Case, Reason).
