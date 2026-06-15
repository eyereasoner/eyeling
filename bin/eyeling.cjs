#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

function extractEngineArg(argv) {
  const filtered = [];
  let engine = null;
  let endOptions = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!endOptions && arg === '--') {
      endOptions = true;
      filtered.push(arg);
    } else if (!endOptions && arg === '--engine') {
      engine = argv[++i];
      if (!engine) throw new Error('--engine needs a value');
    } else if (!endOptions && arg.startsWith('--engine=')) {
      engine = arg.slice('--engine='.length);
    } else {
      filtered.push(arg);
    }
  }

  return { engine, argv: filtered };
}

function normalizeEngineName(value) {
  if (value == null || value === '') return 'n3';
  const name = String(value).toLowerCase();
  if (name === 'n3' || name === 'eyeling') return 'n3';
  if (name === 'eyelang' || name === 'prolog' || name === 'horn') return 'eyelang';
  throw new Error(`unknown Eyeling engine: ${value}`);
}

async function runEyelangCli(argv) {
  const cliUrl = pathToFileURL(path.join(__dirname, '..', 'lib', 'eyelang', 'cli.js')).href;
  const cli = await import(cliUrl);
  await cli.main(argv);
}

const parsed = extractEngineArg(process.argv.slice(2));
const engine = normalizeEngineName(parsed.engine);

if (engine === 'eyelang') {
  runEyelangCli(parsed.argv).catch((error) => {
    console.error(`eyeling: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
  });
} else {
  const bundle = require('../eyeling.js');

  if (!bundle || typeof bundle.main !== 'function') {
    throw new Error('Eyeling CLI bundle did not expose main()');
  }

  process.argv = [process.argv[0], process.argv[1], ...parsed.argv];
  bundle.main();
}
