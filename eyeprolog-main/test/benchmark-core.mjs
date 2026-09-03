import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { run } from '../index.js';

function digest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value && power < 1024) power *= 2;
  return power;
}

export function measureBenchmark(source, goals, { runs = 5, warmup = 1, targetMs = 400 } = {}) {
  let referenceStdout = null;
  let referenceDigest = null;
  let answerLines = null;
  let outputBytes = null;

  function execute() {
    return run(source, { goals });
  }

  function validateResult(result) {
    if (result.haltCode != null) throw new Error(`benchmark halted with code ${result.haltCode}`);
    if (referenceStdout == null) {
      referenceStdout = result.stdout;
      referenceDigest = digest(result.stdout);
      answerLines = result.stdout.split('\n').filter((line) => line.length > 0).length;
      outputBytes = Buffer.byteLength(result.stdout);
    } else if (result.stdout !== referenceStdout) {
      throw new Error(`non-deterministic output digest: ${referenceDigest} != ${digest(result.stdout)}`);
    }
  }

  function runBatch(batchSize) {
    const results = new Array(batchSize);
    const started = performance.now();
    for (let i = 0; i < batchSize; i++) results[i] = execute();
    const elapsed = performance.now() - started;
    for (const result of results) validateResult(result);
    return elapsed;
  }

  let batchSize = 1;
  let calibrationMs = 0;
  if (targetMs > 0) {
    runBatch(1); // prime parser/JIT/module state before sizing the measured batch
    calibrationMs = runBatch(1);
    if (calibrationMs < targetMs) {
      batchSize = nextPowerOfTwo(Math.ceil(targetMs / Math.max(calibrationMs, 0.01)));
      calibrationMs = runBatch(batchSize);
      while (calibrationMs < targetMs * 0.8 && batchSize < 1024) {
        batchSize = Math.min(batchSize * 2, 1024);
        calibrationMs = runBatch(batchSize);
      }
      while (calibrationMs > targetMs * 2 && batchSize > 1) {
        batchSize = Math.max(Math.floor(batchSize / 2), 1);
        calibrationMs = runBatch(batchSize);
      }
    }
  }

  for (let i = 0; i < warmup; i++) runBatch(batchSize);

  // Warm-up can materially change short-workload cost. Re-check the chosen batch
  // in the warmed state and grow it until samples are long enough to be useful.
  if (targetMs > 0) {
    calibrationMs = runBatch(batchSize);
    while (calibrationMs < targetMs * 0.8 && batchSize < 1024) {
      batchSize = Math.min(batchSize * 2, 1024);
      calibrationMs = runBatch(batchSize);
    }
  }

  const samplesMs = [];
  const batchSamplesMs = [];
  for (let i = 0; i < runs; i++) {
    const elapsed = runBatch(batchSize);
    batchSamplesMs.push(elapsed);
    samplesMs.push(elapsed / batchSize);
  }

  return {
    digest: referenceDigest,
    answerLines,
    outputBytes,
    batchSize,
    calibrationMs,
    batchSamplesMs,
    samplesMs,
  };
}
