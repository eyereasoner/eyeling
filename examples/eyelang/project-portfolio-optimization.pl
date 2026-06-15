% Capital project portfolio optimization.
%
% This is a practical finite-search benchmark: enumerate project portfolios
% under budget and risk caps, pruning infeasible branches as cost and risk
% accumulate, then use aggregate builtins to select useful optima without
% building and sorting a large bag of candidate portfolios.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(bestPortfolio, 2).
materialize(lowRiskTarget, 2).
materialize(feasibleCount, 2).
materialize(projectCount, 2).
materialize(totalAvailableValue, 2).
materialize(note, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
budget(portfolio2026, 75).
riskCap(portfolio2026, 28).
targetValue(portfolio2026, 125).

allProjectData([
  p(solar, 22, 15, 4),
  p(battery, 28, 20, 5),
  p(hvac, 20, 13, 3),
  p(analytics, 18, 8, 7),
  p(training, 16, 6, 2),
  p(robotics, 35, 30, 9),
  p(iot, 24, 12, 8),
  p(quality, 19, 9, 4),
  p(resilience, 26, 18, 6),
  p(recycling, 14, 5, 3),
  p(cloud, 21, 11, 5),
  p(security, 25, 16, 7)
]).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
project(Name, Value, Cost, Risk) :-
  allProjectData(Projects),
  member(p(Name, Value, Cost, Risk), Projects).

% Cache this finite relation so bestPortfolio/2, lowRiskTarget/2, and
% feasibleCount/2 do not re-enumerate the same search space independently.
memoize(feasiblePortfolio, 4).

choosePortfolio([], _BudgetLeft, _RiskLeft, [], 0, 0, 0).
choosePortfolio([p(Name, ProjectValue, ProjectCost, ProjectRisk) | Rest], BudgetLeft, RiskLeft, [Name | Chosen], Value, Cost, Risk) :-
  le(ProjectCost, BudgetLeft),
  le(ProjectRisk, RiskLeft),
  sub(BudgetLeft, ProjectCost, NextBudget),
  sub(RiskLeft, ProjectRisk, NextRisk),
  choosePortfolio(Rest, NextBudget, NextRisk, Chosen, RestValue, RestCost, RestRisk),
  add(ProjectValue, RestValue, Value),
  add(ProjectCost, RestCost, Cost),
  add(ProjectRisk, RestRisk, Risk).
choosePortfolio([_Project | Rest], BudgetLeft, RiskLeft, Chosen, Value, Cost, Risk) :-
  choosePortfolio(Rest, BudgetLeft, RiskLeft, Chosen, Value, Cost, Risk).

feasiblePortfolio(Selected, Value, Cost, Risk) :-
  budget(portfolio2026, Budget),
  riskCap(portfolio2026, Cap),
  allProjectData(Projects),
  bounded_subset(Projects, Budget, Cap, Selected, Value, Cost, Risk),
  gt(Value, 0).

scoredPortfolio(Selected, Value, Cost, Risk, NegCost, NegRisk) :-
  feasiblePortfolio(Selected, Value, Cost, Risk),
  neg(Cost, NegCost),
  neg(Risk, NegRisk).

targetPortfolio(Target, Selected, Value, Cost, Risk) :-
  feasiblePortfolio(Selected, Value, Cost, Risk),
  ge(Value, Target).

bestPortfolio(portfolio2026, result(Value, Cost, Risk, Selected)) :-
  aggregate_max(
    [Value, NegCost, NegRisk, Selected],
    result(Value, Cost, Risk, Selected),
    scoredPortfolio(Selected, Value, Cost, Risk, NegCost, NegRisk),
    _Key,
    result(Value, Cost, Risk, Selected)).

lowRiskTarget(portfolio2026, result(Value, Cost, Risk, Selected)) :-
  targetValue(portfolio2026, Target),
  aggregate_min(
    [Risk, Cost, Selected],
    result(Value, Cost, Risk, Selected),
    targetPortfolio(Target, Selected, Value, Cost, Risk),
    _Key,
    result(Value, Cost, Risk, Selected)).

feasibleCount(portfolio2026, Count) :-
  countall(feasiblePortfolio(_Selected, _Value, _Cost, _Risk), Count).

projectCount(portfolio2026, Count) :-
  countall(project(_Name, _Value, _Cost, _Risk), Count).

totalAvailableValue(portfolio2026, Total) :-
  sumall(Value, project(_Name, Value, _Cost, _Risk), Total).

note(portfolio2026, "aggregate builtins combine with pruning and memoization to avoid sorted candidate bags") :-
  eq(ok, ok).
