#!/usr/bin/env node
'use strict';

const CITY = {
  GENT: 0,
  BRUGGE: 1,
  KORTRIJK: 2,
  OOSTENDE: 3,
};

const ACTION = {
  DRIVE_GENT_BRUGGE: 0,
  DRIVE_GENT_KORTRIJK: 1,
  DRIVE_KORTRIJK_BRUGGE: 2,
  DRIVE_BRUGGE_OOSTENDE: 3,
};

const DESCRIPTIONS = [
  { from: CITY.GENT, to: CITY.BRUGGE, action: ACTION.DRIVE_GENT_BRUGGE, durationSeconds: 1500, costMilli: 6, beliefPpm: 960000, comfortPpm: 990000 },
  { from: CITY.GENT, to: CITY.KORTRIJK, action: ACTION.DRIVE_GENT_KORTRIJK, durationSeconds: 1600, costMilli: 7, beliefPpm: 960000, comfortPpm: 990000 },
  { from: CITY.KORTRIJK, to: CITY.BRUGGE, action: ACTION.DRIVE_KORTRIJK_BRUGGE, durationSeconds: 1600, costMilli: 7, beliefPpm: 960000, comfortPpm: 990000 },
  { from: CITY.BRUGGE, to: CITY.OOSTENDE, action: ACTION.DRIVE_BRUGGE_OOSTENDE, durationSeconds: 900, costMilli: 4, beliefPpm: 980000, comfortPpm: 1000000 },
];

const GOAL = {
  maxDurationSeconds: 5000,
  maxCostMilli: 5000,
  minBeliefPpm: 200000,
  minComfortPpm: 400000,
  maxStages: 1,
};

function multiplyPpm(left, right) {
  return Math.floor((left * right) / 1000000);
}

function actionName(action) {
  switch (action) {
    case ACTION.DRIVE_GENT_BRUGGE:
      return 'drive_gent_brugge';
    case ACTION.DRIVE_GENT_KORTRIJK:
      return 'drive_gent_kortrijk';
    case ACTION.DRIVE_KORTRIJK_BRUGGE:
      return 'drive_kortrijk_brugge';
    case ACTION.DRIVE_BRUGGE_OOSTENDE:
      return 'drive_brugge_oostende';
    default:
      return '?';
  }
}

function stageCount(route) {
  return route.actions.length > 0 ? 1 : 0;
}

function routeSatisfies(route, c) {
  return (
    route.durationSeconds <= c.maxDurationSeconds &&
    route.costMilli <= c.maxCostMilli &&
    route.beliefPpm >= c.minBeliefPpm &&
    route.comfortPpm >= c.minComfortPpm &&
    stageCount(route) <= c.maxStages
  );
}

function routeEquals(a, b) {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.actions.length === b.actions.length &&
    a.durationSeconds === b.durationSeconds &&
    a.costMilli === b.costMilli &&
    a.beliefPpm === b.beliefPpm &&
    a.comfortPpm === b.comfortPpm &&
    a.actions.every((action, i) => action === b.actions[i])
  );
}

function compareRoutes(left, right) {
  if (left.actions.length < right.actions.length) return -1;
  if (left.actions.length > right.actions.length) return 1;
  for (let i = 0; i < left.actions.length && i < right.actions.length; i += 1) {
    if (left.actions[i] < right.actions[i]) return -1;
    if (left.actions[i] > right.actions[i]) return 1;
  }
  return 0;
}

function routeMatchesDescriptions(route) {
  let current = route.from;
  let durationSeconds = 0;
  let costMilli = 0;
  let beliefPpm = 1000000;
  let comfortPpm = 1000000;

  for (const action of route.actions) {
    let found = false;
    for (const d of DESCRIPTIONS) {
      if (d.from === current && d.action === action) {
        current = d.to;
        durationSeconds += d.durationSeconds;
        costMilli += d.costMilli;
        beliefPpm = multiplyPpm(beliefPpm, d.beliefPpm);
        comfortPpm = multiplyPpm(comfortPpm, d.comfortPpm);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return (
    current === route.to &&
    durationSeconds === route.durationSeconds &&
    costMilli === route.costMilli &&
    beliefPpm === route.beliefPpm &&
    comfortPpm === route.comfortPpm
  );
}

function inferGoalRoutes() {
  const known = [];
  let agendaHead = 0;

  for (const d of DESCRIPTIONS) {
    known.push({
      from: d.from,
      to: d.to,
      actions: [d.action],
      durationSeconds: d.durationSeconds,
      costMilli: d.costMilli,
      beliefPpm: d.beliefPpm,
      comfortPpm: d.comfortPpm,
    });
  }

  while (agendaHead < known.length) {
    const rest = known[agendaHead++];
    for (const d of DESCRIPTIONS) {
      if (d.to === rest.from) {
        const route = {
          from: d.from,
          to: rest.to,
          actions: [d.action, ...rest.actions],
          durationSeconds: d.durationSeconds + rest.durationSeconds,
          costMilli: d.costMilli + rest.costMilli,
          beliefPpm: multiplyPpm(d.beliefPpm, rest.beliefPpm),
          comfortPpm: multiplyPpm(d.comfortPpm, rest.comfortPpm),
        };
        let duplicate = false;
        for (const knownRoute of known) {
          if (routeEquals(knownRoute, route)) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate) known.push(route);
      }
    }
  }

  return known
    .filter((route) => route.from === CITY.GENT && route.to === CITY.OOSTENDE && routeSatisfies(route, GOAL))
    .sort(compareRoutes);
}

function formatDecimal(value, scale, digits) {
  const fractionalScale = 10 ** digits;
  const scaled = value * fractionalScale;
  const rounded = Math.floor((scaled + Math.floor(scale / 2)) / scale);
  const whole = Math.floor(rounded / fractionalScale);
  const fractional = rounded % fractionalScale;
  return `${whole}.${String(fractional).padStart(digits, '0')}`;
}

function routeLines(index, route) {
  const lines = [];
  lines.push(`Route #${index}`);
  lines.push(` Steps    : ${route.actions.length}`);
  lines.push(` Duration : ${route.durationSeconds} s (≤ ${GOAL.maxDurationSeconds})`);
  lines.push(` Cost     : ${formatDecimal(route.costMilli, 1000, 3)} (≤ ${formatDecimal(GOAL.maxCostMilli, 1000, 1)})`);
  lines.push(` Belief   : ${formatDecimal(route.beliefPpm, 1000000, 3)} (≥ ${formatDecimal(GOAL.minBeliefPpm, 1000000, 1)})`);
  lines.push(` Comfort  : ${formatDecimal(route.comfortPpm, 1000000, 3)} (≥ ${formatDecimal(GOAL.minComfortPpm, 1000000, 1)})`);
  lines.push(` Stages   : ${stageCount(route)} (≤ ${GOAL.maxStages})`);
  for (let i = 0; i < route.actions.length; i += 1) {
    lines.push(`   ${i + 1}. ${actionName(route.actions[i])}`);
  }
  return lines;
}

function main() {
  const routes = inferGoalRoutes();

  let allRoutesSatisfyConstraints = true;
  let allRoutesHitGoalEndpoints = true;
  let allMetricsRecompute = true;
  for (const route of routes) {
    allRoutesSatisfyConstraints &&= routeSatisfies(route, GOAL);
    allRoutesHitGoalEndpoints &&= route.from === CITY.GENT && route.to === CITY.OOSTENDE;
    allMetricsRecompute &&= routeMatchesDescriptions(route);
  }

  const ok =
    routes.length === 2 &&
    allRoutesSatisfyConstraints &&
    allRoutesHitGoalEndpoints &&
    allMetricsRecompute;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('The GPS case finds all goal routes from Gent to Oostende that satisfy the route constraints.');
  lines.push('case      : gps');
  lines.push(`routes    : ${routes.length}`);
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('Routes are built compositionally from direct descriptions, with duration and cost added and belief and comfort combined multiplicatively.');
  for (let i = 0; i < routes.length; i += 1) {
    lines.push(...routeLines(i + 1, routes[i]));
    if (i + 1 !== routes.length) lines.push('');
  }
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`all routes satisfy constraints : ${allRoutesSatisfyConstraints ? 'yes' : 'no'}`);
  lines.push(`all routes hit goal endpoints  : ${allRoutesHitGoalEndpoints ? 'yes' : 'no'}`);
  lines.push(`metrics recompute from steps   : ${allMetricsRecompute ? 'yes' : 'no'}`);
  lines.push(`expected route count (= 2)     : ${routes.length === 2 ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
