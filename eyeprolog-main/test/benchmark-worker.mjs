import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { measureBenchmark } from './benchmark-core.mjs';

function parseInteger(value, name, minimum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return number;
}

function parseNumber(value, name, minimum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) throw new Error(`${name} must be a number >= ${minimum}`);
  return number;
}

const [fileArg, goalsJson = '[]', runsArg = '5', warmupArg = '1', targetMsArg = '400'] = process.argv.slice(2);
if (!fileArg) throw new Error('benchmark worker requires a file');
const goals = JSON.parse(goalsJson);
if (!Array.isArray(goals) || !goals.every((goal) => typeof goal === 'string')) throw new Error('benchmark worker goals must be a JSON array of strings');
const source = await fs.readFile(path.resolve(fileArg), 'utf8');
const result = measureBenchmark(source, goals, {
  runs: parseInteger(runsArg, 'runs', 1),
  warmup: parseInteger(warmupArg, 'warmup', 0),
  targetMs: parseNumber(targetMsArg, 'targetMs', 0),
});
process.stdout.write(`${JSON.stringify(result)}\n`);
