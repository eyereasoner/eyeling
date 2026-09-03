#!/usr/bin/env node
// Unified test runner used by `npm test`.
// Running all suites in one process keeps the numbering continuous and avoids
// npm's intermediate script banners between conformance, regression, and examples.
import { runStandalone } from './test-style.mjs';
import { runConformance } from './run-conformance.mjs';
import { runRegression } from './run-regression.mjs';
import { runIsoStrict } from './run-iso-strict.mjs';
import { runPlayground } from './run-playground.mjs';
import { runExamples } from './run-examples.mjs';
import { runBookExamples } from './run-book-examples.mjs';
import { runWg17 } from './run-wg17.mjs';
import { runOpenRuleBenchChecks } from './run-openrulebench.mjs';
import { runArchitecture } from './run-architecture.mjs';
import { runCleanup } from './run-cleanup.mjs';

await runStandalone(async (reporter) => {
  runConformance(reporter);
  runIsoStrict(reporter);
  runWg17(reporter);
  runOpenRuleBenchChecks(reporter);
  runArchitecture(reporter);
  runCleanup(reporter);
  await runRegression(reporter);
  await runPlayground(reporter);
  await runExamples(reporter);
  runBookExamples(reporter);
});
