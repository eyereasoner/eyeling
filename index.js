'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const bundleApi = require('./eyeling.js');
const { dataFactory, normalizeReasonerInputSync } = require('./lib/rdfjs');
const { isN3SourceListInput } = require('./lib/multisource');
const engine = require('./lib/engine');

function reason(opt = {}, input = '') {
  if (input == null) input = '';

  // allow passing an args array directly
  if (Array.isArray(opt)) opt = { args: opt };
  if (opt == null || typeof opt !== 'object') opt = {};

  const args = [];

  // default: proof comments OFF for API output (machine-friendly)
  // set { proofComments: true } to keep them
  const proofCommentsSpecified = typeof opt.proofComments === 'boolean' || typeof opt.noProofComments === 'boolean';

  const proofComments =
    typeof opt.proofComments === 'boolean'
      ? opt.proofComments
      : typeof opt.noProofComments === 'boolean'
        ? !opt.noProofComments
        : false;

  // Only pass a flag when the caller explicitly asked.
  // (CLI default is now: no proof comments.)
  if (proofCommentsSpecified) {
    if (proofComments) args.push('--proof-comments');
    else args.push('--no-proof-comments');
  }

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

module.exports = {
  reason,
  reasonStream: bundleApi.reasonStream,
  reasonRdfJs: bundleApi.reasonRdfJs,
  rdfjs: dataFactory,
  registerBuiltin: engine.registerBuiltin,
  unregisterBuiltin: engine.unregisterBuiltin,
  registerBuiltinModule: engine.registerBuiltinModule,
  loadBuiltinModule: engine.loadBuiltinModule,
  listBuiltinIris: engine.listBuiltinIris,
};

// small interop nicety for ESM default import
module.exports.default = module.exports;
