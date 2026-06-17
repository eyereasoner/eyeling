'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');

const bundleApi = require('./eyeling.js');
const { dataFactory, normalizeReasonerInputSync } = require('./lib/rdfjs');
const { isN3SourceListInput } = require('./lib/multisource');
const engine = require('./lib/engine');


function normalizeEngineName(value) {
  if (value == null || value === '') return 'n3';
  const name = String(value).toLowerCase();
  if (name === 'n3' || name === 'eyeling') return 'n3';
  if (name === 'eyelang' || name === 'prolog' || name === 'horn') return 'eyelang';
  throw new TypeError(`unknown Eyeling engine: ${value}`);
}

function normalizeEyelangSourceForTempFile(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const text =
      typeof source.eyelang === 'string' ? source.eyelang
        : typeof source.prolog === 'string' ? source.prolog
          : typeof source.text === 'string' ? source.text
            : null;
    if (text !== null) return text;
  }
  throw new TypeError('reason({ engine: "eyelang" }, input): each source must be a string or an object with an eyelang/prolog/text field');
}

function normalizeEyelangInput(input) {
  if (typeof input === 'string') return [input];
  if (input == null) return [''];
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (Array.isArray(input.sources)) return input.sources.map(normalizeEyelangSourceForTempFile);
    return [normalizeEyelangSourceForTempFile(input)];
  }
  throw new TypeError('reason({ engine: "eyelang" }, input): input must be a string, source object, or { sources } list');
}

function reasonEyelangSync(opt = {}, input = '') {
  const args = [];

  if (opt.proof || opt.why || opt.explain) args.push('--proof');
  if (opt.stats) args.push('--stats');
  if (Array.isArray(opt.args)) args.push(...opt.args);

  const maxBuffer = Number.isFinite(opt.maxBuffer) ? opt.maxBuffer : 50 * 1024 * 1024;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-eyelang-'));

  try {
    const inputFiles = normalizeEyelangInput(input).map((text, index) => {
      const inputFile = path.join(dir, `input-${index + 1}.pl`);
      fs.writeFileSync(inputFile, text, 'utf8');
      return inputFile;
    });

    const eyelangCliPath = path.join(__dirname, 'lib', 'eyelang', 'bin.js');
    const res = cp.spawnSync(process.execPath, [eyelangCliPath, ...args, ...inputFiles], { encoding: 'utf8', maxBuffer });

    if (res.error) throw res.error;
    if (res.stderr) process.stderr.write(res.stderr);

    if (res.status !== 0) {
      const err = new Error(res.stderr || `eyelang exited with code ${res.status}`);
      err.code = res.status;
      err.stdout = res.stdout;
      err.stderr = res.stderr;
      throw err;
    }

    return res.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function loadEyelangModule() {
  return import(pathToFileURL(path.join(__dirname, 'lib', 'eyelang', 'index.js')).href);
}

async function runEyelang(input = '', opt = {}) {
  const eyelang = await loadEyelangModule();
  return eyelang.run(input, opt || {});
}

async function reasonEyelang(input = '', opt = {}) {
  const result = await runEyelang(input, opt || {});
  return result.stdout;
}

function reason(opt = {}, input = '') {
  if (input == null) input = '';

  // allow passing an args array directly
  if (Array.isArray(opt)) opt = { args: opt };
  if (opt == null || typeof opt !== 'object') opt = {};

  if (normalizeEngineName(opt.engine) === 'eyelang') return reasonEyelangSync(opt, input);

  const args = [];

  // default: proof output OFF for API output (machine-friendly)
  // set { proof: true } to include N3 proof explanations.
  // proofComments/noProofComments are accepted as legacy aliases.
  const proofSpecified =
    typeof opt.proof === 'boolean' || typeof opt.proofComments === 'boolean' || typeof opt.noProofComments === 'boolean';

  const proof =
    typeof opt.proof === 'boolean'
      ? opt.proof
      : typeof opt.proofComments === 'boolean'
        ? opt.proofComments
        : typeof opt.noProofComments === 'boolean'
          ? !opt.noProofComments
          : false;

  // Only pass a flag when the caller explicitly asked.
  if (proofSpecified) {
    if (proof) args.push('--proof');
    else args.push('--no-proof-comments');
  }

  if (opt.rdf) args.push('--rdf');

  if (typeof opt.store === 'string' && opt.store) args.push('--store', opt.store);
  else if (opt.store && typeof opt.store === 'object') {
    if (opt.store.name) args.push('--store', String(opt.store.name));
    if (opt.store.clear) args.push('--store-clear');
    if (opt.store.path) args.push('--store-path', String(opt.store.path));
  }
  if (opt.storePath) args.push('--store-path', String(opt.storePath));
  if (opt.storeClear) args.push('--store-clear');

  if (Array.isArray(opt.args)) args.push(...opt.args);

  const builtinModules = Array.isArray(opt.builtinModules)
    ? opt.builtinModules
    : typeof opt.builtinModules === 'string' && opt.builtinModules
      ? [opt.builtinModules]
      : [];
  for (const spec of builtinModules) args.push('--builtin', spec);

  const maxBuffer = Number.isFinite(opt.maxBuffer) ? opt.maxBuffer : 50 * 1024 * 1024;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-'));

  function normalizeSourceForTempFile(source) {
    if (typeof source === 'string') return source;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const text = typeof source.n3 === 'string' ? source.n3 : typeof source.text === 'string' ? source.text : null;
      if (text !== null) {
        return typeof source.baseIri === 'string' && source.baseIri ? `@base <${source.baseIri}> .\n${text}` : text;
      }
    }
    throw new TypeError('reason(opt, input): each source must be a string or an object with an n3/text field');
  }

  try {
    const inputFiles = [];
    if (isN3SourceListInput(input)) {
      input.sources.forEach((source, index) => {
        const inputFile = path.join(dir, `input-${index + 1}.n3`);
        fs.writeFileSync(inputFile, normalizeSourceForTempFile(source), 'utf8');
        inputFiles.push(inputFile);
      });
    } else {
      const n3Input = normalizeReasonerInputSync(input);
      if (typeof n3Input !== 'string') {
        throw new TypeError('reason(opt, input): input must resolve to an N3 string');
      }
      const inputFile = path.join(dir, 'input.n3');
      fs.writeFileSync(inputFile, n3Input, 'utf8');
      inputFiles.push(inputFile);
    }

    const eyelingPath = path.join(__dirname, 'eyeling.js');
    const res = cp.spawnSync(process.execPath, [eyelingPath, ...args, ...inputFiles], { encoding: 'utf8', maxBuffer });

    if (res.error) throw res.error;

    // Always forward stderr (log:trace, warnings, parse errors, etc.)
    if (res.stderr) process.stderr.write(res.stderr);

    if (res.status !== 0) {
      const err = new Error(res.stderr || `eyeling exited with code ${res.status}`);
      err.code = res.status;
      err.stdout = res.stdout;
      err.stderr = res.stderr;
      throw err;
    }

    return res.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function runAsync(input = '', opt = {}) {
  const options = opt || {};
  if (normalizeEngineName(options.engine) === 'eyelang') return runEyelang(input, options);
  return engine.runAsync(input, options);
}

module.exports = {
  reason,
  runAsync,
  runEyelang,
  reasonEyelang,
  reasonStream: bundleApi.reasonStream,
  reasonRdfJs: bundleApi.reasonRdfJs,
  rdfjs: dataFactory,
  registerBuiltin: engine.registerBuiltin,
  unregisterBuiltin: engine.unregisterBuiltin,
  registerBuiltinModule: engine.registerBuiltinModule,
  loadBuiltinModule: engine.loadBuiltinModule,
  listBuiltinIris: engine.listBuiltinIris,
  createFactStore: engine.createFactStore,
  MemoryFactStore: engine.MemoryFactStore,
  PersistentFactStore: engine.PersistentFactStore,
};

// small interop nicety for ESM default import
module.exports.default = module.exports;
