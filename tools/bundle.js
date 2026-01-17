#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'lib', 'entry.js');
const OUT = path.join(ROOT, 'eyeling.js');

function normalizeRel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function isInternalRequest(req) {
  return typeof req === 'string' && (req.startsWith('./') || req.startsWith('../'));
}

function resolveInternal(fromFile, req) {
  const baseDir = path.dirname(fromFile);
  let abs = path.resolve(baseDir, req);

  // If no extension, assume .js
  if (!path.extname(abs)) abs = abs + '.js';

  // If it's a directory, prefer index.js
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    abs = path.join(abs, 'index.js');
  }

  return abs;
}

function parseRequires(src) {
  // Very small/naive scanner – good enough for this repo.
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

/** @type {Map<string,string>} */
const modules = new Map(); // rel -> source

function addModule(absFile) {
  const rel = normalizeRel(absFile);
  if (modules.has(rel)) return;

  const src = fs.readFileSync(absFile, 'utf8');
  modules.set(rel, src);

  for (const req of parseRequires(src)) {
    // Keep JSON and bare imports external.
    if (!isInternalRequest(req)) continue;
    if (req.endsWith('.json')) continue;

    const depAbs = resolveInternal(absFile, req);
    // Only bundle files inside ROOT.
    if (!normalizeRel(depAbs) || !path.resolve(depAbs).startsWith(ROOT)) continue;
    if (!fs.existsSync(depAbs)) continue;
    addModule(depAbs);
  }
}

addModule(ENTRY);

const keys = Array.from(modules.keys()).sort();

const out = [];
out.push('#!/usr/bin/env node');
out.push('\'use strict\';');
out.push('');
out.push('(function(){');
out.push('  const __outerRequire = (typeof require === "function") ? require : null;');
out.push('  const __outerModule = (typeof module !== "undefined") ? module : null;');
out.push('  const __outerSelf = (typeof self !== "undefined") ? self : null;');
out.push('  const __modules = Object.create(null);');
out.push('  const __cache = Object.create(null);');
out.push('');
out.push('  // ---- bundled modules ----');
for (const k of keys) {
  out.push(`  __modules[${JSON.stringify(k)}] = function(require, module, exports){`);
  out.push(modules.get(k).replace(/\r\n/g, '\n'));
  out.push('  };');
}

out.push('');
out.push('  function __normPath(p){');
out.push('    const segs = [];');
out.push('    for (const part of p.split("/")) {');
out.push('      if (!part || part === ".") continue;');
out.push('      if (part === "..") segs.pop();');
out.push('      else segs.push(part);');
out.push('    }');
out.push('    return segs.join("/");');
out.push('  }');

out.push('  function __resolve(fromId, req){');
out.push('    if (!(req && (req.startsWith("./") || req.startsWith("../")))) return req;');
out.push('    const base = fromId.split("/").slice(0, -1).join("/");');
out.push('    let p = base ? (base + "/" + req) : req;');
out.push('    p = __normPath(p);');
out.push('    if (!p.endsWith(".js") && !p.endsWith(".json")) p += ".js";');
out.push('    return p;');
out.push('  }');

out.push('  function __makeRequire(fromId){');
out.push('    function r(req){');
out.push('      if (!(req && (req.startsWith("./") || req.startsWith("../")))) {');
out.push('        if (__outerRequire) return __outerRequire(req);');
out.push('        throw new Error("Cannot require external module: " + req);');
out.push('      }');
out.push('      const id = __resolve(fromId, req);');
out.push('      if (!__modules[id]) {');
out.push('        if (__outerRequire) return __outerRequire(req);');
out.push('        throw new Error("Cannot find bundled module: " + id);');
out.push('      }');
out.push('      if (__cache[id]) return __cache[id].exports;');
out.push('      const m = { exports: {} };');
out.push('      __cache[id] = m;');
out.push('      __modules[id](__makeRequire(id), m, m.exports);');
out.push('      return m.exports;');
out.push('    }');
out.push('    r.main = (__outerRequire && __outerRequire.main) ? __outerRequire.main : null;');
out.push('    return r;');
out.push('  }');

out.push('');
out.push('  function __loadEntry(){');
out.push(`    const id = ${JSON.stringify(normalizeRel(ENTRY))};`);
out.push('    if (!__modules[id]) throw new Error("Missing entry module: " + id);');
out.push('    if (__cache[id]) return __cache[id].exports;');
out.push('    const m = { exports: {} };');
out.push('    __cache[id] = m;');
out.push('    __modules[id](__makeRequire(id), m, m.exports);');
out.push('    return m.exports;');
out.push('  }');

out.push('  const __entry = __loadEntry();');
out.push('  const __api = { reasonStream: __entry.reasonStream };');
out.push('');
  out.push('  try { if (__outerModule && __outerModule.exports) __outerModule.exports = __api; } catch (_e) {}');
  out.push('  try { if (__outerSelf) __outerSelf.eyeling = __api; } catch (_e) {}');
  out.push('');
  out.push('  // ---- demo.html compatibility ----');
  out.push('  // The original monolithic eyeling.js exposed internal functions/flags as globals.');
  out.push('  // demo.html still uses these via importScripts(...) inside a web worker.');
  out.push('  try {');
  out.push('    if (__outerSelf && __entry) {');
  out.push('      if (typeof __entry.lex === "function") __outerSelf.lex = __entry.lex;');
  out.push('      if (typeof __entry.Parser === "function") __outerSelf.Parser = __entry.Parser;');
  out.push('      if (typeof __entry.forwardChain === "function") __outerSelf.forwardChain = __entry.forwardChain;');
  out.push('      if (typeof __entry.materializeRdfLists === "function") __outerSelf.materializeRdfLists = __entry.materializeRdfLists;');
  out.push('      if (typeof __entry.isGroundTriple === "function") __outerSelf.isGroundTriple = __entry.isGroundTriple;');
  out.push('      if (typeof __entry.printExplanation === "function") __outerSelf.printExplanation = __entry.printExplanation;');
  out.push('      if (typeof __entry.tripleToN3 === "function") __outerSelf.tripleToN3 = __entry.tripleToN3;');
  out.push('');
  out.push('      // Expose flags as mutable globals (with live linkage to engine module state).');
  out.push('      const def = (name, getFn, setFn) => {');
  out.push('        try {');
  out.push('          if (typeof Object.defineProperty === "function") {');
  out.push('            Object.defineProperty(__outerSelf, name, {');
  out.push('              configurable: true,');
  out.push('              get: (typeof getFn === "function") ? getFn : undefined,');
  out.push('              set: (typeof setFn === "function") ? setFn : undefined,');
  out.push('            });');
  out.push('          } else {');
  out.push('            // Fallback (no live linkage)');
  out.push('            if (typeof getFn === "function") __outerSelf[name] = getFn();');
  out.push('          }');
  out.push('        } catch (_e) {}');
  out.push('      };');
  out.push('');
  out.push('      def("enforceHttpsEnabled", __entry.getEnforceHttpsEnabled, __entry.setEnforceHttpsEnabled);');
  out.push('      def("proofCommentsEnabled", __entry.getProofCommentsEnabled, __entry.setProofCommentsEnabled);');
  out.push('      def("__tracePrefixes", __entry.getTracePrefixes, __entry.setTracePrefixes);');
  out.push('    }');
  out.push('  } catch (_e) {}');
out.push('');
out.push('  try {');
out.push('    if (__outerModule && __outerRequire && __outerRequire.main === __outerModule && typeof __entry.main === "function") {');
out.push('      __entry.main();');
out.push('    }');
out.push('  } catch (_e) {}');
out.push('})();');

fs.writeFileSync(OUT, out.join('\n') + '\n', { encoding: 'utf8' });
try {
  fs.chmodSync(OUT, 0o755);
} catch (_) {}

console.log(`Wrote ${path.relative(process.cwd(), OUT)} with ${keys.length} modules`);
