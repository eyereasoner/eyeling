#!/usr/bin/env node

(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/reasoner.ts
  function isRdfJsonDatatype(dt) {
    return dt === null || dt === RDF_JSON_DT || dt === "rdf:JSON";
  }
  function termToJsonText(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (!isRdfJsonDatatype(dt)) return null;
    return termToJsStringDecoded(t);
  }
  function makeRdfJsonLiteral(jsonText) {
    if (!jsonText.includes('"""')) {
      return internLiteral('"""' + jsonText + '"""^^<' + RDF_JSON_DT + ">");
    }
    return internLiteral(JSON.stringify(jsonText) + "^^<" + RDF_JSON_DT + ">");
  }
  function setEnforceHttpsEnabled(v) {
    enforceHttpsEnabled = !!v;
  }
  function getEnforceHttpsEnabled() {
    return enforceHttpsEnabled;
  }
  function __maybeEnforceHttps(iri) {
    if (!enforceHttpsEnabled) return iri;
    return typeof iri === "string" && iri.startsWith("http://") ? "https://" + iri.slice("http://".length) : iri;
  }
  function __hasXmlHttpRequest() {
    return typeof XMLHttpRequest !== "undefined";
  }
  function __resolveBrowserUrl(ref) {
    if (!ref) return ref;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref;
    const base = typeof document !== "undefined" && document.baseURI || typeof location !== "undefined" && location.href || "";
    try {
      return new URL(ref, base).toString();
    } catch {
      return ref;
    }
  }
  function __fetchHttpTextSyncBrowser(url2) {
    if (!__hasXmlHttpRequest()) return null;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url2, false);
      try {
        xhr.setRequestHeader(
          "Accept",
          "text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01"
        );
      } catch {
      }
      xhr.send(null);
      const sc = xhr.status || 0;
      if (sc < 200 || sc >= 300) return null;
      return xhr.responseText;
    } catch {
      return null;
    }
  }
  function __normalizeDerefIri(iriNoFrag) {
    if (__IS_NODE) return __maybeEnforceHttps(iriNoFrag);
    return __maybeEnforceHttps(__resolveBrowserUrl(iriNoFrag));
  }
  function __stripFragment(iri) {
    const i = iri.indexOf("#");
    return i >= 0 ? iri.slice(0, i) : iri;
  }
  function __isHttpIri(iri) {
    return typeof iri === "string" && (iri.startsWith("http://") || iri.startsWith("https://"));
  }
  function __isFileIri(iri) {
    return typeof iri === "string" && iri.startsWith("file://");
  }
  function __fileIriToPath(fileIri) {
    try {
      const u = new URL(fileIri);
      return decodeURIComponent(u.pathname);
    } catch {
      return decodeURIComponent(fileIri.replace(/^file:\/\//, ""));
    }
  }
  function __readFileText(pathOrFileIri) {
    if (!__IS_NODE) return null;
    const fs = eval("require")("fs");
    let path = pathOrFileIri;
    if (__isFileIri(pathOrFileIri)) path = __fileIriToPath(pathOrFileIri);
    try {
      return fs.readFileSync(path, { encoding: "utf8" });
    } catch {
      return null;
    }
  }
  function __fetchHttpTextViaSubprocess(url) {
    if (!__IS_NODE) return null;
    const cp = eval("require")("child_process");
    const script = `
    const enforceHttps = ${enforceHttpsEnabled ? "true" : "false"};
    const url = process.argv[1];
    const maxRedirects = 10;
    function norm(u) {
      if (enforceHttps && typeof u === 'string' && u.startsWith('http://')) {
        return 'https://' + u.slice('http://'.length);
      }
      return u;
    }
    function get(u, n) {
      u = norm(u);
      if (n > maxRedirects) { console.error('Too many redirects'); process.exit(3); }
      let mod;
      if (u.startsWith('https://')) mod = require('https');
      else if (u.startsWith('http://')) mod = require('http');
      else { console.error('Not http(s)'); process.exit(2); }

      const { URL } = require('url');
      const uu = new URL(u);
      const opts = {
        protocol: uu.protocol,
        hostname: uu.hostname,
        port: uu.port || undefined,
        path: uu.pathname + uu.search,
        headers: {
          'accept': 'text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01',
          'user-agent': 'eyeling-log-builtins'
        }
      };
      const req = mod.request(opts, (res) => {
        const sc = res.statusCode || 0;
        if (sc >= 300 && sc < 400 && res.headers && res.headers.location) {
          let next = new URL(res.headers.location, u).toString();
          next = norm(next);
          res.resume();
          return get(next, n + 1);
        }
        if (sc < 200 || sc >= 300) {
          res.resume();
          console.error('HTTP status ' + sc);
          process.exit(4);
        }
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => { process.stdout.write(data); });
      });
      req.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
      req.end();
    }
    get(url, 0);
  `;
    const r = cp.spawnSync(process.execPath, ["-e", script, url], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024
    });
    if (r.status !== 0) return null;
    return r.stdout;
  }
  function __derefTextSync(iriNoFrag) {
    const norm = __normalizeDerefIri(iriNoFrag);
    const key = typeof norm === "string" && norm ? norm : iriNoFrag;
    if (__logContentCache.has(key)) return __logContentCache.get(key);
    let text = null;
    if (__IS_NODE) {
      if (__isHttpIri(key)) {
        text = __fetchHttpTextViaSubprocess(key);
      } else {
        text = __readFileText(key);
      }
    } else {
      const url2 = typeof norm === "string" && norm ? norm : key;
      if (__isHttpIri(url2)) text = __fetchHttpTextSyncBrowser(url2);
    }
    __logContentCache.set(key, text);
    return text;
  }
  function __parseSemanticsToFormula(text, baseIri) {
    if (typeof __n3Lex !== "function" || typeof __N3ParserCtor !== "function") {
      throw new Error("N3 parser not installed (installN3Input not called)");
    }
    const toks = __n3Lex(text);
    const parser = new __N3ParserCtor(toks);
    if (typeof baseIri === "string" && baseIri) parser.prefixes.setBase(baseIri);
    const [_prefixes, triples, frules, brules] = parser.parseDocument();
    const all = triples.slice();
    const impliesPred = internIri(LOG_NS + "implies");
    const impliedByPred = internIri(LOG_NS + "impliedBy");
    for (const r2 of frules) {
      all.push(new Triple(new GraphTerm(r2.premise), impliesPred, new GraphTerm(r2.conclusion)));
    }
    for (const r2 of brules) {
      all.push(new Triple(new GraphTerm(r2.conclusion), impliedByPred, new GraphTerm(r2.premise)));
    }
    return new GraphTerm(all);
  }
  function __derefSemanticsSync(iriNoFrag) {
    const norm = __normalizeDerefIri(iriNoFrag);
    const key = typeof norm === "string" && norm ? norm : iriNoFrag;
    if (__logSemanticsCache.has(key)) return __logSemanticsCache.get(key);
    const text = __derefTextSync(iriNoFrag);
    if (typeof text !== "string") {
      __logSemanticsCache.set(key, null);
      return null;
    }
    try {
      const baseIri = typeof key === "string" && key ? key : iriNoFrag;
      const formula = __parseSemanticsToFormula(text, baseIri);
      __logSemanticsCache.set(key, formula);
      return formula;
    } catch {
      __logSemanticsCache.set(key, null);
      return null;
    }
  }
  function __makeRuleFromTerms(left, right, isForward) {
    let premiseTerm, conclTerm;
    if (isForward) {
      premiseTerm = left;
      conclTerm = right;
    } else {
      premiseTerm = right;
      conclTerm = left;
    }
    let isFuse = false;
    if (isForward) {
      if (conclTerm instanceof Literal && conclTerm.value === "false") {
        isFuse = true;
      }
    }
    let rawPremise;
    if (premiseTerm instanceof GraphTerm) {
      rawPremise = premiseTerm.triples;
    } else if (premiseTerm instanceof Literal && premiseTerm.value === "true") {
      rawPremise = [];
    } else {
      rawPremise = [];
    }
    let rawConclusion;
    if (conclTerm instanceof GraphTerm) {
      rawConclusion = conclTerm.triples;
    } else if (conclTerm instanceof Literal && conclTerm.value === "false") {
      rawConclusion = [];
    } else {
      rawConclusion = [];
    }
    const headBlankLabels = collectBlankLabelsInTriples(rawConclusion);
    const [premise0, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);
    const premise = isForward ? reorderPremiseForConstraints(premise0) : premise0;
    return new Rule(premise, conclusion, isForward, isFuse, headBlankLabels);
  }
  function __computeConclusionFromFormula(formula) {
    if (!(formula instanceof GraphTerm)) return null;
    const cached = __logConclusionCache.get(formula);
    if (cached) return cached;
    const facts2 = formula.triples.slice();
    const fw = [];
    const bw = [];
    for (const tr of formula.triples) {
      if (isLogImplies(tr.p)) {
        fw.push(__makeRuleFromTerms(tr.s, tr.o, true));
        continue;
      }
      if (isLogImpliedBy(tr.p)) {
        fw.push(__makeRuleFromTerms(tr.o, tr.s, true));
        bw.push(__makeRuleFromTerms(tr.s, tr.o, false));
        continue;
      }
    }
    forwardChain(facts2, fw, bw);
    const out = new GraphTerm(facts2.slice());
    __logConclusionCache.set(formula, out);
    return out;
  }
  function setProofCommentsEnabled(v) {
    proofCommentsEnabled = !!v;
  }
  function getProofCommentsEnabled() {
    return proofCommentsEnabled;
  }
  function setSuperRestrictedMode(v) {
    superRestrictedMode = !!v;
  }
  function getSuperRestrictedMode() {
    return superRestrictedMode;
  }
  function installTraceFormatting(termFormatter, defaultPrefixes) {
    __traceTermFormatter = termFormatter;
    __traceDefaultPrefixes = defaultPrefixes;
  }
  function setTracePrefixes(prefixes) {
    __tracePrefixes = prefixes;
  }
  function installN3Input(lexFn, ParserCtor) {
    __n3Lex = lexFn;
    __N3ParserCtor = ParserCtor;
  }
  function __traceWriteLine(line) {
    try {
      if (__IS_NODE && typeof process !== "undefined" && process.stderr && typeof process.stderr.write === "function") {
        process.stderr.write(String(line) + "\n");
        return;
      }
    } catch (_) {
    }
    try {
      if (typeof console !== "undefined" && typeof console.error === "function") console.error(line);
    } catch (_) {
    }
  }
  function localIsoDateTimeString(d) {
    function pad(n, width = 2) {
      return String(n).padStart(width, "0");
    }
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours();
    const min = d.getMinutes();
    const sec = d.getSeconds();
    const ms = d.getMilliseconds();
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const oh = Math.floor(abs / 60);
    const om = abs % 60;
    const msPart = ms ? "." + String(ms).padStart(3, "0") : "";
    return pad(year, 4) + "-" + pad(month) + "-" + pad(day) + "T" + pad(hour) + ":" + pad(min) + ":" + pad(sec) + msPart + sign + pad(oh) + ":" + pad(om);
  }
  function utcIsoDateTimeStringFromEpochSeconds(sec) {
    const ms = sec * 1e3;
    const d = new Date(ms);
    function pad(n, w = 2) {
      return String(n).padStart(w, "0");
    }
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const hour = d.getUTCHours();
    const min = d.getUTCMinutes();
    const s2 = d.getUTCSeconds();
    const ms2 = d.getUTCMilliseconds();
    const msPart = ms2 ? "." + String(ms2).padStart(3, "0") : "";
    return pad(year, 4) + "-" + pad(month) + "-" + pad(day) + "T" + pad(hour) + ":" + pad(min) + ":" + pad(s2) + msPart + "+00:00";
  }
  function getNowLex() {
    if (fixedNowLex) return fixedNowLex;
    if (runNowLex) return runNowLex;
    runNowLex = localIsoDateTimeString(/* @__PURE__ */ new Date());
    return runNowLex;
  }
  function deterministicSkolemIdFromKey(key) {
    let h1 = 2166136261;
    let h2 = 2166136261;
    let h3 = 2166136261;
    let h4 = 2166136261;
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      h1 ^= c;
      h1 = h1 * 16777619 >>> 0;
      h2 ^= c + 1;
      h2 = h2 * 16777619 >>> 0;
      h3 ^= c + 2;
      h3 = h3 * 16777619 >>> 0;
      h4 ^= c + 3;
      h4 = h4 * 16777619 >>> 0;
    }
    const hex = [h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }
  function internIri(value) {
    let t = __iriIntern.get(value);
    if (!t) {
      t = new Iri(value);
      __iriIntern.set(value, t);
    }
    return t;
  }
  function internLiteral(value) {
    let t = __literalIntern.get(value);
    if (!t) {
      t = new Literal(value);
      __literalIntern.set(value, t);
    }
    return t;
  }
  function collectVarsInTerm(t, acc) {
    if (t instanceof Var) {
      acc.add(t.name);
    } else if (t instanceof ListTerm) {
      for (const x of t.elems) collectVarsInTerm(x, acc);
    } else if (t instanceof OpenListTerm) {
      for (const x of t.prefix) collectVarsInTerm(x, acc);
      acc.add(t.tailVar);
    } else if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        collectVarsInTerm(tr.s, acc);
        collectVarsInTerm(tr.p, acc);
        collectVarsInTerm(tr.o, acc);
      }
    }
  }
  function varsInRule(rule) {
    const acc = /* @__PURE__ */ new Set();
    for (const tr of rule.premise) {
      collectVarsInTerm(tr.s, acc);
      collectVarsInTerm(tr.p, acc);
      collectVarsInTerm(tr.o, acc);
    }
    for (const tr of rule.conclusion) {
      collectVarsInTerm(tr.s, acc);
      collectVarsInTerm(tr.p, acc);
      collectVarsInTerm(tr.o, acc);
    }
    return acc;
  }
  function collectBlankLabelsInTerm(t, acc) {
    if (t instanceof Blank) {
      acc.add(t.label);
    } else if (t instanceof ListTerm) {
      for (const x of t.elems) collectBlankLabelsInTerm(x, acc);
    } else if (t instanceof OpenListTerm) {
      for (const x of t.prefix) collectBlankLabelsInTerm(x, acc);
    } else if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        collectBlankLabelsInTerm(tr.s, acc);
        collectBlankLabelsInTerm(tr.p, acc);
        collectBlankLabelsInTerm(tr.o, acc);
      }
    }
  }
  function collectBlankLabelsInTriples(triples) {
    const acc = /* @__PURE__ */ new Set();
    for (const tr of triples) {
      collectBlankLabelsInTerm(tr.s, acc);
      collectBlankLabelsInTerm(tr.p, acc);
      collectBlankLabelsInTerm(tr.o, acc);
    }
    return acc;
  }
  function liftBlankRuleVars(premise, conclusion) {
    function convertTerm(t, mapping2, counter2) {
      if (t instanceof Blank) {
        const label = t.label;
        if (!mapping2.hasOwnProperty(label)) {
          counter2[0] += 1;
          mapping2[label] = `_b${counter2[0]}`;
        }
        return new Var(mapping2[label]);
      }
      if (t instanceof ListTerm) {
        return new ListTerm(t.elems.map((e) => convertTerm(e, mapping2, counter2)));
      }
      if (t instanceof OpenListTerm) {
        return new OpenListTerm(
          t.prefix.map((e) => convertTerm(e, mapping2, counter2)),
          t.tailVar
        );
      }
      if (t instanceof GraphTerm) {
        const triples = t.triples.map(
          (tr) => new Triple(
            convertTerm(tr.s, mapping2, counter2),
            convertTerm(tr.p, mapping2, counter2),
            convertTerm(tr.o, mapping2, counter2)
          )
        );
        return new GraphTerm(triples);
      }
      return t;
    }
    function convertTriple(tr, mapping2, counter2) {
      return new Triple(
        convertTerm(tr.s, mapping2, counter2),
        convertTerm(tr.p, mapping2, counter2),
        convertTerm(tr.o, mapping2, counter2)
      );
    }
    const mapping = {};
    const counter = [0];
    const newPremise = premise.map((tr) => convertTriple(tr, mapping, counter));
    return [newPremise, conclusion];
  }
  function skolemizeTermForHeadBlanks(t, headBlankLabels, mapping, skCounter, firingKey, globalMap) {
    if (t instanceof Blank) {
      const label = t.label;
      if (!headBlankLabels || !headBlankLabels.has(label)) {
        return t;
      }
      if (!mapping.hasOwnProperty(label)) {
        if (globalMap && firingKey) {
          const gk = `${firingKey}|${label}`;
          let sk = globalMap.get(gk);
          if (!sk) {
            const idx = skCounter[0];
            skCounter[0] += 1;
            sk = `_:sk_${idx}`;
            globalMap.set(gk, sk);
          }
          mapping[label] = sk;
        } else {
          const idx = skCounter[0];
          skCounter[0] += 1;
          mapping[label] = `_:sk_${idx}`;
        }
      }
      return new Blank(mapping[label]);
    }
    if (t instanceof ListTerm) {
      return new ListTerm(
        t.elems.map((e) => skolemizeTermForHeadBlanks(e, headBlankLabels, mapping, skCounter, firingKey, globalMap))
      );
    }
    if (t instanceof OpenListTerm) {
      return new OpenListTerm(
        t.prefix.map((e) => skolemizeTermForHeadBlanks(e, headBlankLabels, mapping, skCounter, firingKey, globalMap)),
        t.tailVar
      );
    }
    if (t instanceof GraphTerm) {
      return new GraphTerm(
        t.triples.map(
          (tr) => skolemizeTripleForHeadBlanks(tr, headBlankLabels, mapping, skCounter, firingKey, globalMap)
        )
      );
    }
    return t;
  }
  function skolemizeTripleForHeadBlanks(tr, headBlankLabels, mapping, skCounter, firingKey, globalMap) {
    return new Triple(
      skolemizeTermForHeadBlanks(tr.s, headBlankLabels, mapping, skCounter, firingKey, globalMap),
      skolemizeTermForHeadBlanks(tr.p, headBlankLabels, mapping, skCounter, firingKey, globalMap),
      skolemizeTermForHeadBlanks(tr.o, headBlankLabels, mapping, skCounter, firingKey, globalMap)
    );
  }
  function termsEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.constructor !== b.constructor) return false;
    if (a instanceof Iri) return a.value === b.value;
    if (a instanceof Literal) {
      if (a.value === b.value) return true;
      if (literalsEquivalentAsXsdString(a.value, b.value)) return true;
      const ai = parseNumericLiteralInfo(a);
      const bi = parseNumericLiteralInfo(b);
      if (ai && bi) {
        if (ai.dt === bi.dt) {
          if (ai.kind === "bigint" && bi.kind === "bigint") return ai.value === bi.value;
          const an = ai.kind === "bigint" ? Number(ai.value) : ai.value;
          const bn = bi.kind === "bigint" ? Number(bi.value) : bi.value;
          return !Number.isNaN(an) && !Number.isNaN(bn) && an === bn;
        }
      }
      return false;
    }
    if (a instanceof Var) return a.name === b.name;
    if (a instanceof Blank) return a.label === b.label;
    if (a instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return false;
      for (let i = 0; i < a.elems.length; i++) {
        if (!termsEqual(a.elems[i], b.elems[i])) return false;
      }
      return true;
    }
    if (a instanceof OpenListTerm) {
      if (a.tailVar !== b.tailVar) return false;
      if (a.prefix.length !== b.prefix.length) return false;
      for (let i = 0; i < a.prefix.length; i++) {
        if (!termsEqual(a.prefix[i], b.prefix[i])) return false;
      }
      return true;
    }
    if (a instanceof GraphTerm) {
      return alphaEqGraphTriples(a.triples, b.triples);
    }
    return false;
  }
  function termsEqualNoIntDecimal(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.constructor !== b.constructor) return false;
    if (a instanceof Iri) return a.value === b.value;
    if (a instanceof Literal) {
      if (a.value === b.value) return true;
      if (literalsEquivalentAsXsdString(a.value, b.value)) return true;
      const ai = parseNumericLiteralInfo(a);
      const bi = parseNumericLiteralInfo(b);
      if (ai && bi && ai.dt === bi.dt) {
        if (ai.kind === "bigint" && bi.kind === "bigint") return ai.value === bi.value;
        if (ai.dt === XSD_NS + "decimal") {
          const da = parseXsdDecimalToBigIntScale(ai.lexStr);
          const db = parseXsdDecimalToBigIntScale(bi.lexStr);
          if (da && db) {
            const scale = Math.max(da.scale, db.scale);
            const na = da.num * pow10n(scale - da.scale);
            const nb = db.num * pow10n(scale - db.scale);
            return na === nb;
          }
        }
        const an = ai.kind === "bigint" ? Number(ai.value) : ai.value;
        const bn = bi.kind === "bigint" ? Number(bi.value) : bi.value;
        return !Number.isNaN(an) && !Number.isNaN(bn) && an === bn;
      }
      return false;
    }
    if (a instanceof Var) return a.name === b.name;
    if (a instanceof Blank) return a.label === b.label;
    if (a instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return false;
      for (let i = 0; i < a.elems.length; i++) {
        if (!termsEqualNoIntDecimal(a.elems[i], b.elems[i])) return false;
      }
      return true;
    }
    if (a instanceof OpenListTerm) {
      if (a.tailVar !== b.tailVar) return false;
      if (a.prefix.length !== b.prefix.length) return false;
      for (let i = 0; i < a.prefix.length; i++) {
        if (!termsEqualNoIntDecimal(a.prefix[i], b.prefix[i])) return false;
      }
      return true;
    }
    if (a instanceof GraphTerm) {
      return alphaEqGraphTriples(a.triples, b.triples);
    }
    return false;
  }
  function triplesEqual(a, b) {
    return termsEqual(a.s, b.s) && termsEqual(a.p, b.p) && termsEqual(a.o, b.o);
  }
  function triplesListEqual(xs, ys) {
    if (xs.length !== ys.length) return false;
    for (let i = 0; i < xs.length; i++) {
      if (!triplesEqual(xs[i], ys[i])) return false;
    }
    return true;
  }
  function alphaEqVarName(x, y, vmap) {
    if (vmap.hasOwnProperty(x)) return vmap[x] === y;
    vmap[x] = y;
    return true;
  }
  function alphaEqTermInGraph(a, b, vmap, bmap) {
    if (a instanceof Blank && b instanceof Blank) {
      const x = a.label;
      const y = b.label;
      if (bmap.hasOwnProperty(x)) return bmap[x] === y;
      bmap[x] = y;
      return true;
    }
    if (a instanceof Var && b instanceof Var) {
      return alphaEqVarName(a.name, b.name, vmap);
    }
    if (a instanceof Iri && b instanceof Iri) return a.value === b.value;
    if (a instanceof Literal && b instanceof Literal) return a.value === b.value;
    if (a instanceof ListTerm && b instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return false;
      for (let i = 0; i < a.elems.length; i++) {
        if (!alphaEqTermInGraph(a.elems[i], b.elems[i], vmap, bmap)) return false;
      }
      return true;
    }
    if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
      if (a.prefix.length !== b.prefix.length) return false;
      for (let i = 0; i < a.prefix.length; i++) {
        if (!alphaEqTermInGraph(a.prefix[i], b.prefix[i], vmap, bmap)) return false;
      }
      return alphaEqVarName(a.tailVar, b.tailVar, vmap);
    }
    if (a instanceof GraphTerm && b instanceof GraphTerm) {
      return alphaEqGraphTriples(a.triples, b.triples);
    }
    return false;
  }
  function alphaEqTripleInGraph(a, b, vmap, bmap) {
    return alphaEqTermInGraph(a.s, b.s, vmap, bmap) && alphaEqTermInGraph(a.p, b.p, vmap, bmap) && alphaEqTermInGraph(a.o, b.o, vmap, bmap);
  }
  function alphaEqGraphTriples(xs, ys) {
    if (xs.length !== ys.length) return false;
    if (triplesListEqual(xs, ys)) return true;
    const used = new Array(ys.length).fill(false);
    function step(i, vmap, bmap) {
      if (i >= xs.length) return true;
      const x = xs[i];
      for (let j = 0; j < ys.length; j++) {
        if (used[j]) continue;
        const y = ys[j];
        if (x.p instanceof Iri && y.p instanceof Iri && x.p.value !== y.p.value) continue;
        const v2 = { ...vmap };
        const b2 = { ...bmap };
        if (!alphaEqTripleInGraph(x, y, v2, b2)) continue;
        used[j] = true;
        if (step(i + 1, v2, b2)) return true;
        used[j] = false;
      }
      return false;
    }
    return step(0, {}, {});
  }
  function alphaEqTerm(a, b, bmap) {
    if (a instanceof Blank && b instanceof Blank) {
      const x = a.label;
      const y = b.label;
      if (bmap.hasOwnProperty(x)) {
        return bmap[x] === y;
      } else {
        bmap[x] = y;
        return true;
      }
    }
    if (a instanceof Iri && b instanceof Iri) return a.value === b.value;
    if (a instanceof Literal && b instanceof Literal) return a.value === b.value;
    if (a instanceof Var && b instanceof Var) return a.name === b.name;
    if (a instanceof ListTerm && b instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return false;
      for (let i = 0; i < a.elems.length; i++) {
        if (!alphaEqTerm(a.elems[i], b.elems[i], bmap)) return false;
      }
      return true;
    }
    if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
      if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return false;
      for (let i = 0; i < a.prefix.length; i++) {
        if (!alphaEqTerm(a.prefix[i], b.prefix[i], bmap)) return false;
      }
      return true;
    }
    if (a instanceof GraphTerm && b instanceof GraphTerm) {
      return alphaEqGraphTriples(a.triples, b.triples);
    }
    return false;
  }
  function alphaEqTriple(a, b) {
    const bmap = {};
    return alphaEqTerm(a.s, b.s, bmap) && alphaEqTerm(a.p, b.p, bmap) && alphaEqTerm(a.o, b.o, bmap);
  }
  function termFastKey(t) {
    if (t instanceof Iri) return "I:" + t.value;
    if (t instanceof Literal) return "L:" + normalizeLiteralForFastKey(t.value);
    return null;
  }
  function tripleFastKey(tr) {
    const ks = termFastKey(tr.s);
    const kp = termFastKey(tr.p);
    const ko = termFastKey(tr.o);
    if (ks === null || kp === null || ko === null) return null;
    return ks + "	" + kp + "	" + ko;
  }
  function ensureFactIndexes(facts) {
    if (facts.__byPred && facts.__byPS && facts.__byPO && facts.__keySet) return;
    Object.defineProperty(facts, "__byPred", {
      value: /* @__PURE__ */ new Map(),
      enumerable: false,
      writable: true
    });
    Object.defineProperty(facts, "__byPS", {
      value: /* @__PURE__ */ new Map(),
      enumerable: false,
      writable: true
    });
    Object.defineProperty(facts, "__byPO", {
      value: /* @__PURE__ */ new Map(),
      enumerable: false,
      writable: true
    });
    Object.defineProperty(facts, "__keySet", {
      value: /* @__PURE__ */ new Set(),
      enumerable: false,
      writable: true
    });
    for (const f of facts) indexFact(facts, f);
  }
  function indexFact(facts, tr) {
    if (tr.p instanceof Iri) {
      const pk = tr.p.value;
      let pb = facts.__byPred.get(pk);
      if (!pb) {
        pb = [];
        facts.__byPred.set(pk, pb);
      }
      pb.push(tr);
      const sk = termFastKey(tr.s);
      if (sk !== null) {
        let ps = facts.__byPS.get(pk);
        if (!ps) {
          ps = /* @__PURE__ */ new Map();
          facts.__byPS.set(pk, ps);
        }
        let psb = ps.get(sk);
        if (!psb) {
          psb = [];
          ps.set(sk, psb);
        }
        psb.push(tr);
      }
      const ok = termFastKey(tr.o);
      if (ok !== null) {
        let po = facts.__byPO.get(pk);
        if (!po) {
          po = /* @__PURE__ */ new Map();
          facts.__byPO.set(pk, po);
        }
        let pob = po.get(ok);
        if (!pob) {
          pob = [];
          po.set(ok, pob);
        }
        pob.push(tr);
      }
    }
    const key = tripleFastKey(tr);
    if (key !== null) facts.__keySet.add(key);
  }
  function candidateFacts(facts, goal) {
    ensureFactIndexes(facts);
    if (goal.p instanceof Iri) {
      const pk = goal.p.value;
      const sk = termFastKey(goal.s);
      const ok = termFastKey(goal.o);
      let byPS = null;
      if (sk !== null) {
        const ps = facts.__byPS.get(pk);
        if (ps) byPS = ps.get(sk) || null;
      }
      let byPO = null;
      if (ok !== null) {
        const po = facts.__byPO.get(pk);
        if (po) byPO = po.get(ok) || null;
      }
      if (byPS && byPO) return byPS.length <= byPO.length ? byPS : byPO;
      if (byPS) return byPS;
      if (byPO) return byPO;
      return facts.__byPred.get(pk) || [];
    }
    return facts;
  }
  function hasFactIndexed(facts, tr) {
    ensureFactIndexes(facts);
    const key = tripleFastKey(tr);
    if (key !== null) return facts.__keySet.has(key);
    if (tr.p instanceof Iri) {
      const pk = tr.p.value;
      const ok = termFastKey(tr.o);
      if (ok !== null) {
        const po = facts.__byPO.get(pk);
        if (po) {
          const pob = po.get(ok) || [];
          return pob.some((t) => triplesEqual(t, tr));
        }
      }
      const pb = facts.__byPred.get(pk) || [];
      return pb.some((t) => triplesEqual(t, tr));
    }
    return facts.some((t) => triplesEqual(t, tr));
  }
  function pushFactIndexed(facts, tr) {
    ensureFactIndexes(facts);
    facts.push(tr);
    indexFact(facts, tr);
  }
  function ensureBackRuleIndexes(backRules) {
    if (backRules.__byHeadPred && backRules.__wildHeadPred) return;
    Object.defineProperty(backRules, "__byHeadPred", {
      value: /* @__PURE__ */ new Map(),
      enumerable: false,
      writable: true
    });
    Object.defineProperty(backRules, "__wildHeadPred", {
      value: [],
      enumerable: false,
      writable: true
    });
    for (const r2 of backRules) indexBackRule(backRules, r2);
  }
  function indexBackRule(backRules, r2) {
    if (!r2 || !r2.conclusion || r2.conclusion.length !== 1) return;
    const head = r2.conclusion[0];
    if (head && head.p instanceof Iri) {
      const k = head.p.value;
      let bucket = backRules.__byHeadPred.get(k);
      if (!bucket) {
        bucket = [];
        backRules.__byHeadPred.set(k, bucket);
      }
      bucket.push(r2);
    } else {
      backRules.__wildHeadPred.push(r2);
    }
  }
  function isRdfTypePred(p) {
    return p instanceof Iri && p.value === RDF_NS + "type";
  }
  function isOwlSameAsPred(t) {
    return t instanceof Iri && t.value === OWL_NS + "sameAs";
  }
  function isLogImplies(p) {
    return p instanceof Iri && p.value === LOG_NS + "implies";
  }
  function isLogImpliedBy(p) {
    return p instanceof Iri && p.value === LOG_NS + "impliedBy";
  }
  function isConstraintBuiltin(tr) {
    if (!(tr.p instanceof Iri)) return false;
    const v = tr.p.value;
    if (v === MATH_NS + "equalTo" || v === MATH_NS + "greaterThan" || v === MATH_NS + "lessThan" || v === MATH_NS + "notEqualTo" || v === MATH_NS + "notGreaterThan" || v === MATH_NS + "notLessThan") {
      return true;
    }
    if (v === LIST_NS + "notMember") {
      return true;
    }
    if (v === LOG_NS + "forAllIn" || v === LOG_NS + "notEqualTo" || v === LOG_NS + "notIncludes" || v === LOG_NS + "outputString") {
      return true;
    }
    if (v === STRING_NS + "contains" || v === STRING_NS + "containsIgnoringCase" || v === STRING_NS + "endsWith" || v === STRING_NS + "equalIgnoringCase" || v === STRING_NS + "greaterThan" || v === STRING_NS + "lessThan" || v === STRING_NS + "matches" || v === STRING_NS + "notEqualIgnoringCase" || v === STRING_NS + "notGreaterThan" || v === STRING_NS + "notLessThan" || v === STRING_NS + "notMatches" || v === STRING_NS + "startsWith") {
      return true;
    }
    return false;
  }
  function reorderPremiseForConstraints(premise) {
    if (!premise || premise.length === 0) return premise;
    const normal = [];
    const delayed = [];
    for (const tr of premise) {
      if (isConstraintBuiltin(tr)) delayed.push(tr);
      else normal.push(tr);
    }
    return normal.concat(delayed);
  }
  function containsVarTerm(t, v) {
    if (t instanceof Var) return t.name === v;
    if (t instanceof ListTerm) return t.elems.some((e) => containsVarTerm(e, v));
    if (t instanceof OpenListTerm) return t.prefix.some((e) => containsVarTerm(e, v)) || t.tailVar === v;
    if (t instanceof GraphTerm)
      return t.triples.some((tr) => containsVarTerm(tr.s, v) || containsVarTerm(tr.p, v) || containsVarTerm(tr.o, v));
    return false;
  }
  function isGroundTermInGraph(t) {
    if (t instanceof OpenListTerm) return false;
    if (t instanceof ListTerm) return t.elems.every((e) => isGroundTermInGraph(e));
    if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
    return true;
  }
  function isGroundTripleInGraph(tr) {
    return isGroundTermInGraph(tr.s) && isGroundTermInGraph(tr.p) && isGroundTermInGraph(tr.o);
  }
  function isGroundTerm(t) {
    if (t instanceof Var) return false;
    if (t instanceof ListTerm) return t.elems.every((e) => isGroundTerm(e));
    if (t instanceof OpenListTerm) return false;
    if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
    return true;
  }
  function isGroundTriple(tr) {
    return isGroundTerm(tr.s) && isGroundTerm(tr.p) && isGroundTerm(tr.o);
  }
  function skolemKeyFromTerm(t) {
    function enc(u) {
      if (u instanceof Iri) return ["I", u.value];
      if (u instanceof Literal) return ["L", u.value];
      if (u instanceof Blank) return ["B", u.label];
      if (u instanceof Var) return ["V", u.name];
      if (u instanceof ListTerm) return ["List", u.elems.map(enc)];
      if (u instanceof OpenListTerm) return ["OpenList", u.prefix.map(enc), u.tailVar];
      if (u instanceof GraphTerm) return ["Graph", u.triples.map((tr) => [enc(tr.s), enc(tr.p), enc(tr.o)])];
      return ["Other", String(u)];
    }
    return JSON.stringify(enc(t));
  }
  function applySubstTerm(t, s) {
    if (t instanceof Var) {
      const first = s[t.name];
      if (first === void 0) {
        return t;
      }
      let cur = first;
      const seen = /* @__PURE__ */ new Set([t.name]);
      while (cur instanceof Var) {
        const name = cur.name;
        if (seen.has(name)) break;
        seen.add(name);
        const nxt = s[name];
        if (!nxt) break;
        cur = nxt;
      }
      if (cur instanceof Var) {
        return cur;
      }
      return applySubstTerm(cur, s);
    }
    if (t instanceof ListTerm) {
      return new ListTerm(t.elems.map((e) => applySubstTerm(e, s)));
    }
    if (t instanceof OpenListTerm) {
      const newPrefix = t.prefix.map((e) => applySubstTerm(e, s));
      const tailTerm = s[t.tailVar];
      if (tailTerm !== void 0) {
        const tailApplied = applySubstTerm(tailTerm, s);
        if (tailApplied instanceof ListTerm) {
          return new ListTerm(newPrefix.concat(tailApplied.elems));
        } else if (tailApplied instanceof OpenListTerm) {
          return new OpenListTerm(newPrefix.concat(tailApplied.prefix), tailApplied.tailVar);
        } else {
          return new OpenListTerm(newPrefix, t.tailVar);
        }
      } else {
        return new OpenListTerm(newPrefix, t.tailVar);
      }
    }
    if (t instanceof GraphTerm) {
      return new GraphTerm(t.triples.map((tr) => applySubstTriple(tr, s)));
    }
    return t;
  }
  function applySubstTriple(tr, s) {
    return new Triple(applySubstTerm(tr.s, s), applySubstTerm(tr.p, s), applySubstTerm(tr.o, s));
  }
  function iriValue(t) {
    return t instanceof Iri ? t.value : null;
  }
  function unifyOpenWithList(prefix, tailv, ys, subst) {
    if (ys.length < prefix.length) return null;
    let s2 = { ...subst };
    for (let i = 0; i < prefix.length; i++) {
      s2 = unifyTerm(prefix[i], ys[i], s2);
      if (s2 === null) return null;
    }
    const rest = new ListTerm(ys.slice(prefix.length));
    s2 = unifyTerm(new Var(tailv), rest, s2);
    if (s2 === null) return null;
    return s2;
  }
  function unifyGraphTriples(xs, ys, subst) {
    if (xs.length !== ys.length) return null;
    if (triplesListEqual(xs, ys)) return { ...subst };
    const used = new Array(ys.length).fill(false);
    function step(i, s) {
      if (i >= xs.length) return s;
      const x = xs[i];
      for (let j = 0; j < ys.length; j++) {
        if (used[j]) continue;
        const y = ys[j];
        if (x.p instanceof Iri && y.p instanceof Iri && x.p.value !== y.p.value) continue;
        const s2 = unifyTriple(x, y, s);
        if (s2 === null) continue;
        used[j] = true;
        const s3 = step(i + 1, s2);
        if (s3 !== null) return s3;
        used[j] = false;
      }
      return null;
    }
    return step(0, { ...subst });
  }
  function unifyTerm(a, b, subst) {
    return unifyTermWithOptions(a, b, subst, {
      boolValueEq: true,
      intDecimalEq: false
    });
  }
  function unifyTermListAppend(a, b, subst) {
    return unifyTermWithOptions(a, b, subst, {
      boolValueEq: false,
      intDecimalEq: true
    });
  }
  function unifyTermWithOptions(a, b, subst, opts) {
    a = applySubstTerm(a, subst);
    b = applySubstTerm(b, subst);
    if (a instanceof Var) {
      const v = a.name;
      const t = b;
      if (t instanceof Var && t.name === v) return { ...subst };
      if (containsVarTerm(t, v)) return null;
      const s2 = { ...subst };
      s2[v] = t;
      return s2;
    }
    if (b instanceof Var) {
      return unifyTermWithOptions(b, a, subst, opts);
    }
    if (a instanceof Iri && b instanceof Iri && a.value === b.value) return { ...subst };
    if (a instanceof Literal && b instanceof Literal && a.value === b.value) return { ...subst };
    if (a instanceof Blank && b instanceof Blank && a.label === b.label) return { ...subst };
    if (a instanceof Literal && b instanceof Literal) {
      if (literalsEquivalentAsXsdString(a.value, b.value)) return { ...subst };
    }
    if (opts.boolValueEq && a instanceof Literal && b instanceof Literal) {
      const ai = parseBooleanLiteralInfo(a);
      const bi = parseBooleanLiteralInfo(b);
      if (ai && bi && ai.value === bi.value) return { ...subst };
    }
    if (a instanceof Literal && b instanceof Literal) {
      const ai = parseNumericLiteralInfo(a);
      const bi = parseNumericLiteralInfo(b);
      if (ai && bi) {
        if (ai.dt === bi.dt) {
          if (ai.kind === "bigint" && bi.kind === "bigint") {
            if (ai.value === bi.value) return { ...subst };
          } else {
            const an = ai.kind === "bigint" ? Number(ai.value) : ai.value;
            const bn = bi.kind === "bigint" ? Number(bi.value) : bi.value;
            if (!Number.isNaN(an) && !Number.isNaN(bn) && an === bn) return { ...subst };
          }
        }
        if (opts.intDecimalEq) {
          const intDt = XSD_NS + "integer";
          const decDt = XSD_NS + "decimal";
          if (ai.dt === intDt && bi.dt === decDt || ai.dt === decDt && bi.dt === intDt) {
            const intInfo = ai.dt === intDt ? ai : bi;
            const decInfo = ai.dt === decDt ? ai : bi;
            const dec = parseXsdDecimalToBigIntScale(decInfo.lexStr);
            if (dec) {
              const scaledInt = intInfo.value * pow10n(dec.scale);
              if (scaledInt === dec.num) return { ...subst };
            }
          }
        }
      }
    }
    if (a instanceof OpenListTerm && b instanceof ListTerm) {
      return unifyOpenWithList(a.prefix, a.tailVar, b.elems, subst);
    }
    if (a instanceof ListTerm && b instanceof OpenListTerm) {
      return unifyOpenWithList(b.prefix, b.tailVar, a.elems, subst);
    }
    if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
      if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return null;
      let s2 = { ...subst };
      for (let i = 0; i < a.prefix.length; i++) {
        s2 = unifyTermWithOptions(a.prefix[i], b.prefix[i], s2, opts);
        if (s2 === null) return null;
      }
      return s2;
    }
    if (a instanceof ListTerm && b instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return null;
      let s2 = { ...subst };
      for (let i = 0; i < a.elems.length; i++) {
        s2 = unifyTermWithOptions(a.elems[i], b.elems[i], s2, opts);
        if (s2 === null) return null;
      }
      return s2;
    }
    if (a instanceof GraphTerm && b instanceof GraphTerm) {
      if (alphaEqGraphTriples(a.triples, b.triples)) return { ...subst };
      return unifyGraphTriples(a.triples, b.triples, subst);
    }
    return null;
  }
  function unifyTriple(pat, fact, subst) {
    const s1 = unifyTerm(pat.p, fact.p, subst);
    if (s1 === null) return null;
    const s2 = unifyTerm(pat.s, fact.s, s1);
    if (s2 === null) return null;
    const s3 = unifyTerm(pat.o, fact.o, s2);
    return s3;
  }
  function composeSubst(outer, delta) {
    if (!delta || Object.keys(delta).length === 0) {
      return { ...outer };
    }
    const out = { ...outer };
    for (const [k, v] of Object.entries(delta)) {
      if (out.hasOwnProperty(k)) {
        if (!termsEqual(out[k], v)) return null;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  function literalParts2(lit) {
    const cached = __literalPartsCache.get(lit);
    if (cached) return cached;
    const idx = lit.indexOf("^^");
    let lex2 = lit;
    let dt = null;
    if (idx >= 0) {
      lex2 = lit.slice(0, idx);
      dt = lit.slice(idx + 2).trim();
      if (dt.startsWith("<") && dt.endsWith(">")) {
        dt = dt.slice(1, -1);
      }
    }
    if (lex2.length >= 2 && lex2[0] === '"') {
      const lastQuote = lex2.lastIndexOf('"');
      if (lastQuote > 0 && lastQuote < lex2.length - 1 && lex2[lastQuote + 1] === "@") {
        const lang = lex2.slice(lastQuote + 2);
        if (/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/.test(lang)) {
          lex2 = lex2.slice(0, lastQuote + 1);
        }
      }
    }
    const res = [lex2, dt];
    __literalPartsCache.set(lit, res);
    return res;
  }
  function literalHasLangTag(lit) {
    if (typeof lit !== "string") return false;
    if (lit.indexOf("^^") >= 0) return false;
    if (!lit.startsWith('"')) return false;
    if (lit.startsWith('"""')) {
      const end = lit.lastIndexOf('"""');
      if (end < 0) return false;
      const after2 = end + 3;
      return after2 < lit.length && lit[after2] === "@";
    }
    const lastQuote = lit.lastIndexOf('"');
    if (lastQuote < 0) return false;
    const after = lastQuote + 1;
    return after < lit.length && lit[after] === "@";
  }
  function isPlainStringLiteralValue(lit) {
    if (typeof lit !== "string") return false;
    if (lit.indexOf("^^") >= 0) return false;
    if (!isQuotedLexical(lit)) return false;
    return !literalHasLangTag(lit);
  }
  function literalsEquivalentAsXsdString(aLit, bLit) {
    if (typeof aLit !== "string" || typeof bLit !== "string") return false;
    const [alex, adt] = literalParts2(aLit);
    const [blex, bdt] = literalParts2(bLit);
    if (alex !== blex) return false;
    const aPlain = adt === null && isPlainStringLiteralValue(aLit);
    const bPlain = bdt === null && isPlainStringLiteralValue(bLit);
    const aXsdStr = adt === XSD_NS + "string";
    const bXsdStr = bdt === XSD_NS + "string";
    return aPlain && bXsdStr || bPlain && aXsdStr;
  }
  function normalizeLiteralForFastKey(lit) {
    if (typeof lit !== "string") return lit;
    const [lex2, dt] = literalParts2(lit);
    if (dt === XSD_NS + "string") {
      return `${lex2}^^<${XSD_NS}string>`;
    }
    if (dt === null && isPlainStringLiteralValue(lit)) {
      return `${lex2}^^<${XSD_NS}string>`;
    }
    return lit;
  }
  function decodeN3StringEscapes(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c !== "\\") {
        out += c;
        continue;
      }
      if (i + 1 >= s.length) {
        out += "\\";
        continue;
      }
      const e = s[++i];
      switch (e) {
        case "t":
          out += "	";
          break;
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case '"':
          out += '"';
          break;
        case "'":
          out += "'";
          break;
        case "\\":
          out += "\\";
          break;
        case "u": {
          const hex = s.slice(i + 1, i + 5);
          if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          } else {
            out += "\\u";
          }
          break;
        }
        case "U": {
          const hex = s.slice(i + 1, i + 9);
          if (/^[0-9A-Fa-f]{8}$/.test(hex)) {
            const cp2 = parseInt(hex, 16);
            if (cp2 >= 0 && cp2 <= 1114111) out += String.fromCodePoint(cp2);
            else out += "\\U" + hex;
            i += 8;
          } else {
            out += "\\U";
          }
          break;
        }
        default:
          out += "\\" + e;
      }
    }
    return out;
  }
  function stripQuotes(lex2) {
    if (typeof lex2 !== "string") return lex2;
    if (lex2.length >= 6) {
      if (lex2.startsWith('"""') && lex2.endsWith('"""')) return lex2.slice(3, -3);
      if (lex2.startsWith("'''") && lex2.endsWith("'''")) return lex2.slice(3, -3);
    }
    if (lex2.length >= 2) {
      const a = lex2[0];
      const b = lex2[lex2.length - 1];
      if (a === '"' && b === '"' || a === "'" && b === "'") return lex2.slice(1, -1);
    }
    return lex2;
  }
  function termToJsXsdStringNoLang(t) {
    if (!(t instanceof Literal)) return null;
    if (literalHasLangTag(t.value)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (!isQuotedLexical(lex2)) return null;
    if (dt !== null && dt !== XSD_NS + "string" && dt !== "xsd:string") return null;
    return decodeN3StringEscapes(stripQuotes(lex2));
  }
  function termToJsString(t) {
    if (t instanceof Iri) return t.value;
    if (!(t instanceof Literal)) return null;
    const [lex2, _dt] = literalParts2(t.value);
    if (isQuotedLexical(lex2)) {
      return decodeN3StringEscapes(stripQuotes(lex2));
    }
    return typeof lex2 === "string" ? lex2 : String(lex2);
  }
  function makeStringLiteral(str) {
    return internLiteral(JSON.stringify(str));
  }
  function termToJsStringDecoded(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, _dt] = literalParts2(t.value);
    if (lex2.length >= 6 && lex2.startsWith('"""') && lex2.endsWith('"""')) {
      return lex2.slice(3, -3);
    }
    if (lex2.length >= 2 && lex2[0] === '"' && lex2[lex2.length - 1] === '"') {
      try {
        return JSON.parse(lex2);
      } catch (e) {
      }
      return stripQuotes(lex2);
    }
    return stripQuotes(lex2);
  }
  function jsonPointerUnescape(seg) {
    let out = "";
    for (let i = 0; i < seg.length; i++) {
      const c = seg[i];
      if (c !== "~") {
        out += c;
        continue;
      }
      if (i + 1 >= seg.length) return null;
      const n = seg[i + 1];
      if (n === "0") out += "~";
      else if (n === "1") out += "/";
      else return null;
      i++;
    }
    return out;
  }
  function jsonToTerm(v) {
    if (v === null) return makeStringLiteral("null");
    if (typeof v === "string") return makeStringLiteral(v);
    if (typeof v === "number") return internLiteral(String(v));
    if (typeof v === "boolean") return internLiteral(v ? "true" : "false");
    if (Array.isArray(v)) return new ListTerm(v.map(jsonToTerm));
    if (v && typeof v === "object") {
      return makeRdfJsonLiteral(JSON.stringify(v));
    }
    return null;
  }
  function jsonPointerLookup(jsonText, pointer) {
    let ptr = pointer;
    if (ptr.startsWith("#")) {
      try {
        ptr = decodeURIComponent(ptr.slice(1));
      } catch {
        return null;
      }
    }
    let entry = jsonPointerCache.get(jsonText);
    if (!entry) {
      let parsed = null;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        parsed = null;
      }
      entry = { parsed, ptrCache: /* @__PURE__ */ new Map() };
      jsonPointerCache.set(jsonText, entry);
    }
    if (entry.parsed === null) return null;
    if (entry.ptrCache.has(ptr)) return entry.ptrCache.get(ptr);
    let cur = entry.parsed;
    if (ptr === "") {
      const t = jsonToTerm(cur);
      entry.ptrCache.set(ptr, t);
      return t;
    }
    if (!ptr.startsWith("/")) {
      entry.ptrCache.set(ptr, null);
      return null;
    }
    const parts = ptr.split("/").slice(1);
    for (const raw of parts) {
      const seg = jsonPointerUnescape(raw);
      if (seg === null) {
        entry.ptrCache.set(ptr, null);
        return null;
      }
      if (Array.isArray(cur)) {
        if (!/^(0|[1-9]\d*)$/.test(seg)) {
          entry.ptrCache.set(ptr, null);
          return null;
        }
        const idx = Number(seg);
        if (idx < 0 || idx >= cur.length) {
          entry.ptrCache.set(ptr, null);
          return null;
        }
        cur = cur[idx];
      } else if (cur !== null && typeof cur === "object") {
        if (!Object.prototype.hasOwnProperty.call(cur, seg)) {
          entry.ptrCache.set(ptr, null);
          return null;
        }
        cur = cur[seg];
      } else {
        entry.ptrCache.set(ptr, null);
        return null;
      }
    }
    const out = jsonToTerm(cur);
    entry.ptrCache.set(ptr, out);
    return out;
  }
  function simpleStringFormat(fmt, args) {
    let out = "";
    let argIndex = 0;
    for (let i = 0; i < fmt.length; i++) {
      const ch = fmt[i];
      if (ch === "%" && i + 1 < fmt.length) {
        const spec = fmt[i + 1];
        if (spec === "s") {
          const arg = argIndex < args.length ? args[argIndex++] : "";
          out += arg;
          i++;
          continue;
        }
        if (spec === "%") {
          out += "%";
          i++;
          continue;
        }
        return null;
      }
      out += ch;
    }
    return out;
  }
  function regexNeedsUnicodeMode(pattern) {
    return /\\[pP]\{/.test(pattern) || /\\u\{/.test(pattern);
  }
  function sanitizeForUnicodeMode(pattern) {
    const KEEP = "^$\\.*+?()[]{}|/-";
    return pattern.replace(/\\([^A-Za-z0-9])/g, (m, ch) => {
      return KEEP.includes(ch) ? m : ch;
    });
  }
  function compileSwapRegex(pattern, extraFlags) {
    const needU = regexNeedsUnicodeMode(pattern);
    const flags = (extraFlags || "") + (needU ? "u" : "");
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      if (needU) {
        const p2 = sanitizeForUnicodeMode(pattern);
        if (p2 !== pattern) {
          try {
            return new RegExp(p2, flags);
          } catch (_e2) {
          }
        }
      }
      return null;
    }
  }
  function parseBooleanLiteralInfo(t) {
    if (!(t instanceof Literal)) return null;
    const boolDt = XSD_NS + "boolean";
    const v = t.value;
    const [lex2, dt] = literalParts2(v);
    if (dt !== null) {
      if (dt !== boolDt) return null;
      const s = stripQuotes(lex2);
      if (s === "true" || s === "1") return { dt: boolDt, value: true };
      if (s === "false" || s === "0") return { dt: boolDt, value: false };
      return null;
    }
    if (v === "true") return { dt: boolDt, value: true };
    if (v === "false") return { dt: boolDt, value: false };
    return null;
  }
  function parseXsdFloatSpecialLex(s) {
    if (s === "INF" || s === "+INF") return Infinity;
    if (s === "-INF") return -Infinity;
    if (s === "NaN") return NaN;
    return null;
  }
  function formatXsdFloatSpecialLex(n) {
    if (n === Infinity) return "INF";
    if (n === -Infinity) return "-INF";
    if (Number.isNaN(n)) return "NaN";
    return null;
  }
  function isQuotedLexical(lex2) {
    if (typeof lex2 !== "string") return false;
    const n = lex2.length;
    if (n >= 6 && (lex2.startsWith('"""') && lex2.endsWith('"""') || lex2.startsWith("'''") && lex2.endsWith("'''")))
      return true;
    if (n >= 2) {
      const a = lex2[0];
      const b = lex2[n - 1];
      return a === '"' && b === '"' || a === "'" && b === "'";
    }
    return false;
  }
  function isXsdNumericDatatype(dt) {
    if (dt === null) return false;
    return dt === XSD_DECIMAL_DT || dt === XSD_DOUBLE_DT || dt === XSD_FLOAT_DT || XSD_INTEGER_DERIVED_DTS.has(dt);
  }
  function isXsdIntegerDatatype(dt) {
    if (dt === null) return false;
    return XSD_INTEGER_DERIVED_DTS.has(dt);
  }
  function looksLikeUntypedNumericTokenLex(lex2) {
    if (isQuotedLexical(lex2)) return false;
    if (/^[+-]?\d+$/.test(lex2)) return true;
    if (/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(lex2)) return true;
    if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)$/.test(lex2)) return true;
    return false;
  }
  function parseNum(t) {
    if (!(t instanceof Literal)) return null;
    const key = t.value;
    if (__parseNumCache.has(key)) return __parseNumCache.get(key);
    const [lex2, dt] = literalParts2(key);
    if (dt !== null) {
      if (!isXsdNumericDatatype(dt)) {
        __parseNumCache.set(key, null);
        return null;
      }
      const val = stripQuotes(lex2);
      if (dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) {
        const sp = parseXsdFloatSpecialLex(val);
        if (sp !== null) {
          __parseNumCache.set(key, sp);
          return sp;
        }
        const n3 = Number(val);
        if (Number.isNaN(n3)) {
          __parseNumCache.set(key, null);
          return null;
        }
        __parseNumCache.set(key, n3);
        return n3;
      }
      const n2 = Number(val);
      if (!Number.isFinite(n2)) {
        __parseNumCache.set(key, null);
        return null;
      }
      __parseNumCache.set(key, n2);
      return n2;
    }
    if (!looksLikeUntypedNumericTokenLex(lex2)) {
      __parseNumCache.set(key, null);
      return null;
    }
    const n = Number(lex2);
    if (!Number.isFinite(n)) {
      __parseNumCache.set(key, null);
      return null;
    }
    __parseNumCache.set(key, n);
    return n;
  }
  function parseIntLiteral(t) {
    if (!(t instanceof Literal)) return null;
    const key = t.value;
    if (__parseIntCache.has(key)) return __parseIntCache.get(key);
    const [lex2, dt] = literalParts2(key);
    if (dt !== null) {
      if (!isXsdIntegerDatatype(dt)) {
        __parseIntCache.set(key, null);
        return null;
      }
      const val = stripQuotes(lex2);
      if (!/^[+-]?\d+$/.test(val)) {
        __parseIntCache.set(key, null);
        return null;
      }
      try {
        const out = BigInt(val);
        __parseIntCache.set(key, out);
        return out;
      } catch {
        __parseIntCache.set(key, null);
        return null;
      }
    }
    if (isQuotedLexical(lex2)) {
      __parseIntCache.set(key, null);
      return null;
    }
    if (!/^[+-]?\d+$/.test(lex2)) {
      __parseIntCache.set(key, null);
      return null;
    }
    try {
      const out = BigInt(lex2);
      __parseIntCache.set(key, out);
      return out;
    } catch {
      __parseIntCache.set(key, null);
      return null;
    }
  }
  function formatNum(n) {
    return String(n);
  }
  function parseXsdDecimalToBigIntScale(s) {
    let t = String(s).trim();
    let sign = 1n;
    if (t.startsWith("+")) t = t.slice(1);
    else if (t.startsWith("-")) {
      sign = -1n;
      t = t.slice(1);
    }
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) return null;
    let intPart = "0";
    let fracPart = "";
    if (t.includes(".")) {
      const parts = t.split(".");
      intPart = parts[0] === "" ? "0" : parts[0];
      fracPart = parts[1] || "";
    } else {
      intPart = t;
    }
    intPart = intPart.replace(/^0+(?=\d)/, "");
    fracPart = fracPart.replace(/0+$/, "");
    const scale = fracPart.length;
    const digits = intPart + fracPart || "0";
    return { num: sign * BigInt(digits), scale };
  }
  function pow10n(k) {
    return 10n ** BigInt(k);
  }
  function parseXsdDateTerm(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (dt !== XSD_NS + "date") return null;
    const val = stripQuotes(lex2);
    const d = /* @__PURE__ */ new Date(val + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  function parseXsdDatetimeTerm(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (dt !== XSD_NS + "dateTime") return null;
    const val = stripQuotes(lex2);
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  function parseXsdDateTimeLexParts(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (dt !== XSD_NS + "dateTime") return null;
    const val = stripQuotes(lex2);
    const m = /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(val);
    if (!m) return null;
    const yearStr = m[1];
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const second = parseInt(m[6], 10);
    const tz = m[7] || null;
    if (!(month >= 1 && month <= 12)) return null;
    if (!(day >= 1 && day <= 31)) return null;
    if (!(hour >= 0 && hour <= 23)) return null;
    if (!(minute >= 0 && minute <= 59)) return null;
    if (!(second >= 0 && second <= 59)) return null;
    return { yearStr, month, day, hour, minute, second, tz };
  }
  function parseDatetimeLike(t) {
    const d = parseXsdDateTerm(t);
    if (d !== null) return d;
    return parseXsdDatetimeTerm(t);
  }
  function parseIso8601DurationToSeconds(s) {
    if (!s) return null;
    if (s[0] !== "P") return null;
    const it = s.slice(1);
    let num = "";
    let inTime = false;
    let years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0;
    for (const c of it) {
      if (c === "T") {
        inTime = true;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        num += c;
        continue;
      }
      if (!num) return null;
      const val = Number(num);
      if (Number.isNaN(val)) return null;
      num = "";
      if (!inTime && c === "Y") years += val;
      else if (!inTime && c === "M") months += val;
      else if (!inTime && c === "W") weeks += val;
      else if (!inTime && c === "D") days += val;
      else if (inTime && c === "H") hours += val;
      else if (inTime && c === "M") minutes += val;
      else if (inTime && c === "S") seconds += val;
      else return null;
    }
    const totalDays = years * 365.2425 + months * 30.436875 + weeks * 7 + days + hours / 24 + minutes / (24 * 60) + seconds / (24 * 3600);
    return totalDays * 86400;
  }
  function parseNumericForCompareTerm(t) {
    const bi = parseIntLiteral(t);
    if (bi !== null) return { kind: "bigint", value: bi };
    const nDur = parseNumOrDuration(t);
    if (nDur !== null) return { kind: "number", value: nDur };
    return null;
  }
  function cmpNumericInfo(aInfo, bInfo, op) {
    if (!aInfo || !bInfo) return false;
    if (aInfo.kind === "bigint" && bInfo.kind === "bigint") {
      if (op === ">") return aInfo.value > bInfo.value;
      if (op === "<") return aInfo.value < bInfo.value;
      if (op === ">=") return aInfo.value >= bInfo.value;
      if (op === "<=") return aInfo.value <= bInfo.value;
      if (op === "==") return aInfo.value == bInfo.value;
      if (op === "!=") return aInfo.value != bInfo.value;
      return false;
    }
    const a = typeof aInfo.value === "bigint" ? Number(aInfo.value) : aInfo.value;
    const b = typeof bInfo.value === "bigint" ? Number(bInfo.value) : bInfo.value;
    if (op === ">") return a > b;
    if (op === "<") return a < b;
    if (op === ">=") return a >= b;
    if (op === "<=") return a <= b;
    if (op === "==") return a == b;
    if (op === "!=") return a != b;
    return false;
  }
  function evalNumericComparisonBuiltin(g, subst, op) {
    const aInfo = parseNumericForCompareTerm(g.s);
    const bInfo = parseNumericForCompareTerm(g.o);
    if (aInfo && bInfo && cmpNumericInfo(aInfo, bInfo, op)) return [{ ...subst }];
    if (g.s instanceof ListTerm && g.s.elems.length === 2) {
      const a2 = parseNumericForCompareTerm(g.s.elems[0]);
      const b2 = parseNumericForCompareTerm(g.s.elems[1]);
      if (a2 && b2 && cmpNumericInfo(a2, b2, op)) return [{ ...subst }];
    }
    return [];
  }
  function parseNumOrDuration(t) {
    const n = parseNum(t);
    if (n !== null) return n;
    if (t instanceof Literal) {
      const [lex2, dt] = literalParts2(t.value);
      if (dt === XSD_NS + "duration") {
        const val = stripQuotes(lex2);
        const negative = val.startsWith("-");
        const core = negative ? val.slice(1) : val;
        if (!core.startsWith("P")) return null;
        const secs = parseIso8601DurationToSeconds(core);
        if (secs === null) return null;
        return negative ? -secs : secs;
      }
    }
    const dtval = parseDatetimeLike(t);
    if (dtval !== null) {
      return dtval.getTime() / 1e3;
    }
    return null;
  }
  function formatDurationLiteralFromSeconds(secs) {
    const neg = secs < 0;
    const days = Math.round(Math.abs(secs) / 86400);
    const literalLex = neg ? `"-P${days}D"` : `"P${days}D"`;
    return internLiteral(`${literalLex}^^<${XSD_NS}duration>`);
  }
  function numEqualTerm(t, n, eps = 1e-9) {
    const v = parseNum(t);
    if (v === null) return false;
    if (Number.isNaN(v) || Number.isNaN(n)) return false;
    if (!Number.isFinite(v) || !Number.isFinite(n)) return v === n;
    return Math.abs(v - n) < eps;
  }
  function numericDatatypeFromLex(lex2) {
    if (/[eE]/.test(lex2)) return XSD_DOUBLE_DT;
    if (lex2.includes(".")) return XSD_DECIMAL_DT;
    return XSD_INTEGER_DT;
  }
  function parseNumericLiteralInfo(t) {
    if (!(t instanceof Literal)) return null;
    const key = t.value;
    if (__parseNumericInfoCache.has(key)) return __parseNumericInfoCache.get(key);
    const v = key;
    const [lex2, dt] = literalParts2(v);
    let dt2 = dt;
    let lexStr;
    if (dt2 !== null) {
      if (!isXsdNumericDatatype(dt2)) {
        __parseNumericInfoCache.set(key, null);
        return null;
      }
      if (isXsdIntegerDatatype(dt2)) dt2 = XSD_INTEGER_DT;
      lexStr = stripQuotes(lex2);
    } else {
      if (typeof v !== "string") {
        __parseNumericInfoCache.set(key, null);
        return null;
      }
      if (v.startsWith('"')) {
        __parseNumericInfoCache.set(key, null);
        return null;
      }
      if (!/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(v)) {
        __parseNumericInfoCache.set(key, null);
        return null;
      }
      dt2 = numericDatatypeFromLex(v);
      lexStr = v;
    }
    if (dt2 === XSD_INTEGER_DT) {
      try {
        const info2 = { dt: dt2, kind: "bigint", value: BigInt(lexStr), lexStr };
        __parseNumericInfoCache.set(key, info2);
        return info2;
      } catch {
        __parseNumericInfoCache.set(key, null);
        return null;
      }
    }
    if (dt2 === XSD_FLOAT_DT || dt2 === XSD_DOUBLE_DT) {
      const sp = parseXsdFloatSpecialLex(lexStr);
      if (sp !== null) {
        const info2 = { dt: dt2, kind: "number", value: sp, lexStr };
        __parseNumericInfoCache.set(key, info2);
        return info2;
      }
    }
    const num = Number(lexStr);
    if (Number.isNaN(num)) {
      __parseNumericInfoCache.set(key, null);
      return null;
    }
    if (dt2 === XSD_DECIMAL_DT && !Number.isFinite(num)) {
      __parseNumericInfoCache.set(key, null);
      return null;
    }
    const info = { dt: dt2, kind: "number", value: num, lexStr };
    __parseNumericInfoCache.set(key, info);
    return info;
  }
  function numericRank(dt) {
    if (dt === XSD_INTEGER_DT) return 0;
    if (dt === XSD_DECIMAL_DT) return 1;
    if (dt === XSD_FLOAT_DT) return 2;
    if (dt === XSD_DOUBLE_DT) return 3;
    return -1;
  }
  function numericDatatypeOfTerm(t) {
    if (!(t instanceof Literal)) return null;
    const [lex2, dt] = literalParts2(t.value);
    if (dt !== null) {
      if (!isXsdNumericDatatype(dt)) return null;
      if (isXsdIntegerDatatype(dt)) return XSD_INTEGER_DT;
      if (dt === XSD_DECIMAL_DT || dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) return dt;
      return null;
    }
    if (!looksLikeUntypedNumericTokenLex(lex2)) return null;
    return numericDatatypeFromLex(lex2);
  }
  function commonNumericDatatype(terms, outTerm) {
    let r2 = 0;
    const all = Array.isArray(terms) ? terms.slice() : [];
    if (outTerm) all.push(outTerm);
    for (const t of all) {
      const dt = numericDatatypeOfTerm(t);
      if (!dt) continue;
      const rr = numericRank(dt);
      if (rr > r2) r2 = rr;
    }
    if (r2 === 3) return XSD_DOUBLE_DT;
    if (r2 === 2) return XSD_FLOAT_DT;
    if (r2 === 1) return XSD_DECIMAL_DT;
    return XSD_INTEGER_DT;
  }
  function makeNumericOutputLiteral(val, dt) {
    if (dt === XSD_INTEGER_DT) {
      if (typeof val === "bigint") return internLiteral(val.toString());
      if (Number.isInteger(val)) return internLiteral(String(val));
      return internLiteral(`"${formatNum(val)}"^^<${XSD_DECIMAL_DT}>`);
    }
    if (dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) {
      const sp = formatXsdFloatSpecialLex(val);
      const lex3 = sp !== null ? sp : formatNum(val);
      return internLiteral(`"${lex3}"^^<${dt}>`);
    }
    const lex2 = typeof val === "bigint" ? val.toString() : formatNum(val);
    return internLiteral(`"${lex2}"^^<${dt}>`);
  }
  function evalUnaryMathRel(g, subst, forwardFn, inverseFn) {
    const sIsUnbound = g.s instanceof Var || g.s instanceof Blank;
    const oIsUnbound = g.o instanceof Var || g.o instanceof Blank;
    const a = parseNum(g.s);
    const b = parseNum(g.o);
    if (a !== null) {
      const outVal = forwardFn(a);
      if (!Number.isFinite(outVal)) return [];
      let outDt = commonNumericDatatype([g.s], g.o);
      if (outDt === XSD_INTEGER_DT && !Number.isInteger(outVal)) outDt = XSD_DECIMAL_DT;
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = makeNumericOutputLiteral(outVal, outDt);
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, outVal)) return [{ ...subst }];
      return [];
    }
    if (b !== null && typeof inverseFn === "function") {
      const inVal = inverseFn(b);
      if (!Number.isFinite(inVal)) return [];
      let inDt = commonNumericDatatype([g.o], g.s);
      if (inDt === XSD_INTEGER_DT && !Number.isInteger(inVal)) inDt = XSD_DECIMAL_DT;
      if (g.s instanceof Var) {
        const s2 = { ...subst };
        s2[g.s.name] = makeNumericOutputLiteral(inVal, inDt);
        return [s2];
      }
      if (g.s instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.s, inVal)) return [{ ...subst }];
      return [];
    }
    if (sIsUnbound && oIsUnbound) return [{ ...subst }];
    return [];
  }
  function listAppendSplit(parts, resElems, subst) {
    if (!parts.length) {
      if (!resElems.length) return [{ ...subst }];
      return [];
    }
    const out = [];
    const n = resElems.length;
    for (let k = 0; k <= n; k++) {
      const left = new ListTerm(resElems.slice(0, k));
      let s1 = unifyTermListAppend(parts[0], left, subst);
      if (s1 === null) continue;
      const restElems = resElems.slice(k);
      out.push(...listAppendSplit(parts.slice(1), restElems, s1));
    }
    return out;
  }
  function evalListFirstLikeBuiltin(sTerm, oTerm, subst) {
    if (!(sTerm instanceof ListTerm)) return [];
    if (!sTerm.elems.length) return [];
    const first = sTerm.elems[0];
    const s2 = unifyTerm(oTerm, first, subst);
    return s2 !== null ? [s2] : [];
  }
  function evalListRestLikeBuiltin(sTerm, oTerm, subst) {
    if (sTerm instanceof ListTerm) {
      if (!sTerm.elems.length) return [];
      const rest = new ListTerm(sTerm.elems.slice(1));
      const s2 = unifyTerm(oTerm, rest, subst);
      return s2 !== null ? [s2] : [];
    }
    if (sTerm instanceof OpenListTerm) {
      if (!sTerm.prefix.length) return [];
      if (sTerm.prefix.length === 1) {
        const s22 = unifyTerm(oTerm, new Var(sTerm.tailVar), subst);
        return s22 !== null ? [s22] : [];
      }
      const rest = new OpenListTerm(sTerm.prefix.slice(1), sTerm.tailVar);
      const s2 = unifyTerm(oTerm, rest, subst);
      return s2 !== null ? [s2] : [];
    }
    return [];
  }
  function hashLiteralTerm(t, algo) {
    if (!(t instanceof Literal)) return null;
    const [lex2] = literalParts2(t.value);
    const input = stripQuotes(lex2);
    try {
      const digest = nodeCrypto.createHash(algo).update(input, "utf8").digest("hex");
      return internLiteral(JSON.stringify(digest));
    } catch (e) {
      return null;
    }
  }
  function evalCryptoHashBuiltin(g, subst, algo) {
    const lit = hashLiteralTerm(g.s, algo);
    if (!lit) return [];
    if (g.o instanceof Var) {
      const s22 = { ...subst };
      s22[g.o.name] = lit;
      return [s22];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }
  function __logNaturalPriorityFromTerm(t) {
    const info = parseNumericLiteralInfo(t);
    if (!info) return null;
    if (info.dt !== XSD_INTEGER_DT) return null;
    const v = info.value;
    if (typeof v === "bigint") {
      if (v < 1n) return null;
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      return Number(v);
    }
    if (typeof v === "number") {
      if (!Number.isInteger(v) || v < 1) return null;
      return v;
    }
    return null;
  }
  function evalBuiltin(goal, subst, facts, backRules, depth, varGen, maxResults) {
    const g = applySubstTriple(goal, subst);
    const pv = iriValue(g.p);
    if (pv === null) return null;
    if (superRestrictedMode) {
      const allow1 = LOG_NS + "implies";
      const allow2 = LOG_NS + "impliedBy";
      if (pv !== allow1 && pv !== allow2) return [];
    }
    const cryptoAlgo = pv === CRYPTO_NS + "sha" ? "sha1" : pv === CRYPTO_NS + "md5" ? "md5" : pv === CRYPTO_NS + "sha256" ? "sha256" : pv === CRYPTO_NS + "sha512" ? "sha512" : null;
    if (cryptoAlgo) return evalCryptoHashBuiltin(g, subst, cryptoAlgo);
    const mathCmpOp = pv === MATH_NS + "greaterThan" ? ">" : pv === MATH_NS + "lessThan" ? "<" : pv === MATH_NS + "notLessThan" ? ">=" : pv === MATH_NS + "notGreaterThan" ? "<=" : pv === MATH_NS + "equalTo" ? "==" : pv === MATH_NS + "notEqualTo" ? "!=" : null;
    if (mathCmpOp) return evalNumericComparisonBuiltin(g, subst, mathCmpOp);
    if (pv === MATH_NS + "sum") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length < 2) return [];
      const xs = g.s.elems;
      const dtOut0 = commonNumericDatatype(xs, g.o);
      if (dtOut0 === XSD_INTEGER_DT) {
        let total2 = 0n;
        for (const t of xs) {
          const v = parseIntLiteral(t);
          if (v === null) return [];
          total2 += v;
        }
        if (g.o instanceof Var) {
          const s2 = { ...subst };
          s2[g.o.name] = makeNumericOutputLiteral(total2, XSD_INTEGER_DT);
          return [s2];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        const oi = parseIntLiteral(g.o);
        if (oi !== null && oi === total2) return [{ ...subst }];
        if (numEqualTerm(g.o, Number(total2))) return [{ ...subst }];
        return [];
      }
      let total = 0;
      for (const t of xs) {
        const v = parseNum(t);
        if (v === null) return [];
        total += v;
      }
      let dtOut = dtOut0;
      if (dtOut === XSD_INTEGER_DT && !Number.isInteger(total)) dtOut = XSD_DECIMAL_DT;
      const lit = makeNumericOutputLiteral(total, dtOut);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, total)) return [{ ...subst }];
      return [];
    }
    if (pv === MATH_NS + "product") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length < 2) return [];
      const xs = g.s.elems;
      const dtOut0 = commonNumericDatatype(xs, g.o);
      if (dtOut0 === XSD_INTEGER_DT) {
        let prod2 = 1n;
        for (const t of xs) {
          const v = parseIntLiteral(t);
          if (v === null) return [];
          prod2 *= v;
        }
        if (g.o instanceof Var) {
          const s2 = { ...subst };
          s2[g.o.name] = makeNumericOutputLiteral(prod2, XSD_INTEGER_DT);
          return [s2];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        const oi = parseIntLiteral(g.o);
        if (oi !== null && oi === prod2) return [{ ...subst }];
        if (numEqualTerm(g.o, Number(prod2))) return [{ ...subst }];
        return [];
      }
      let prod = 1;
      for (const t of xs) {
        const v = parseNum(t);
        if (v === null) return [];
        prod *= v;
      }
      let dtOut = dtOut0;
      if (dtOut === XSD_INTEGER_DT && !Number.isInteger(prod)) dtOut = XSD_DECIMAL_DT;
      const lit = makeNumericOutputLiteral(prod, dtOut);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, prod)) return [{ ...subst }];
      return [];
    }
    if (pv === MATH_NS + "difference") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [a0, b0] = g.s.elems;
      const aDt = parseDatetimeLike(a0);
      const bDt = parseDatetimeLike(b0);
      if (aDt !== null && bDt !== null) {
        const diffSecs = (aDt.getTime() - bDt.getTime()) / 1e3;
        const durTerm = formatDurationLiteralFromSeconds(diffSecs);
        if (g.o instanceof Var) {
          const s23 = { ...subst };
          s23[g.o.name] = durTerm;
          return [s23];
        }
        const s22 = unifyTerm(g.o, durTerm, subst);
        return s22 !== null ? [s22] : [];
      }
      if (aDt !== null) {
        const secs = parseNumOrDuration(b0);
        if (secs !== null) {
          const outSecs = aDt.getTime() / 1e3 - secs;
          const lex2 = utcIsoDateTimeStringFromEpochSeconds(outSecs);
          const lit2 = internLiteral(`"${lex2}"^^<${XSD_NS}dateTime>`);
          if (g.o instanceof Var) {
            const s23 = { ...subst };
            s23[g.o.name] = lit2;
            return [s23];
          }
          const s22 = unifyTerm(g.o, lit2, subst);
          return s22 !== null ? [s22] : [];
        }
      }
      const ai = parseIntLiteral(a0);
      const bi = parseIntLiteral(b0);
      if (ai !== null && bi !== null) {
        const ci = ai - bi;
        const lit2 = internLiteral(ci.toString());
        if (g.o instanceof Var) {
          const s23 = { ...subst };
          s23[g.o.name] = lit2;
          return [s23];
        }
        const s22 = unifyTerm(g.o, lit2, subst);
        return s22 !== null ? [s22] : [];
      }
      const a = parseNum(a0);
      const b = parseNum(b0);
      if (a === null || b === null) return [];
      const c = a - b;
      if (!Number.isFinite(c)) return [];
      if (typeof commonNumericDatatype === "function" && typeof makeNumericOutputLiteral === "function") {
        let dtOut = commonNumericDatatype([a0, b0], g.o);
        if (dtOut === XSD_INTEGER_DT && !Number.isInteger(c)) dtOut = XSD_DECIMAL_DT;
        const lit2 = makeNumericOutputLiteral(c, dtOut);
        if (g.o instanceof Var) {
          const s22 = { ...subst };
          s22[g.o.name] = lit2;
          return [s22];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        if (numEqualTerm(g.o, c)) return [{ ...subst }];
        return [];
      }
      const lit = internLiteral(formatNum(c));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === MATH_NS + "quotient") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [a0, b0] = g.s.elems;
      const a = parseNum(a0);
      const b = parseNum(b0);
      if (a === null || b === null) return [];
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];
      const c = a / b;
      if (!Number.isFinite(c)) return [];
      let dtOut = commonNumericDatatype([a0, b0], g.o);
      if (dtOut === XSD_INTEGER_DT && !Number.isInteger(c)) dtOut = XSD_DECIMAL_DT;
      const lit = makeNumericOutputLiteral(c, dtOut);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, c)) return [{ ...subst }];
      return [];
    }
    if (pv === MATH_NS + "integerQuotient") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [a0, b0] = g.s.elems;
      const ai = parseIntLiteral(a0);
      const bi = parseIntLiteral(b0);
      if (ai !== null && bi !== null) {
        if (bi === 0n) return [];
        const q2 = ai / bi;
        const lit2 = internLiteral(q2.toString());
        if (g.o instanceof Var) {
          const s23 = { ...subst };
          s23[g.o.name] = lit2;
          return [s23];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        const oi = parseIntLiteral(g.o);
        if (oi !== null && oi === q2) return [{ ...subst }];
        const qNum = Number(q2);
        if (Number.isFinite(qNum) && Math.abs(qNum) <= Number.MAX_SAFE_INTEGER) {
          if (numEqualTerm(g.o, qNum)) return [{ ...subst }];
        }
        const s22 = unifyTerm(g.o, lit2, subst);
        return s22 !== null ? [s22] : [];
      }
      const a = parseNum(a0);
      const b = parseNum(b0);
      if (a === null || b === null) return [];
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];
      if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
      const q = Math.trunc(a / b);
      const lit = internLiteral(String(q));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, q)) return [{ ...subst }];
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === MATH_NS + "exponentiation") {
      if (g.s instanceof ListTerm && g.s.elems.length === 2) {
        const baseTerm = g.s.elems[0];
        const expTerm = g.s.elems[1];
        const a = parseNum(baseTerm);
        let b = null;
        if (a !== null) b = parseNum(expTerm);
        if (a !== null && b !== null) {
          const cVal = a ** b;
          if (!Number.isFinite(cVal)) return [];
          let dtOut = commonNumericDatatype([baseTerm, expTerm], g.o);
          if (dtOut === XSD_INTEGER_DT && !Number.isInteger(cVal)) dtOut = XSD_DECIMAL_DT;
          const lit = makeNumericOutputLiteral(cVal, dtOut);
          if (g.o instanceof Var) {
            const s2 = { ...subst };
            s2[g.o.name] = lit;
            return [s2];
          }
          if (g.o instanceof Blank) return [{ ...subst }];
          if (numEqualTerm(g.o, cVal)) return [{ ...subst }];
        }
        const c = parseNum(g.o);
        if (a !== null && expTerm instanceof Var && c !== null) {
          if (a > 0 && a !== 1 && c > 0) {
            const bVal = Math.log(c) / Math.log(a);
            if (!Number.isFinite(bVal)) return [];
            let dtB = commonNumericDatatype([baseTerm, g.o], expTerm);
            if (dtB === XSD_INTEGER_DT && !Number.isInteger(bVal)) dtB = XSD_DECIMAL_DT;
            const s2 = { ...subst };
            s2[expTerm.name] = makeNumericOutputLiteral(bVal, dtB);
            return [s2];
          }
        }
        return [];
      }
    }
    if (pv === MATH_NS + "absoluteValue") {
      const a = parseNum(g.s);
      if (a === null) return [];
      const outVal = Math.abs(a);
      if (!Number.isFinite(outVal)) return [];
      let dtOut = commonNumericDatatype([g.s], g.o);
      if (dtOut === XSD_INTEGER_DT && !Number.isInteger(outVal)) dtOut = XSD_DECIMAL_DT;
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = makeNumericOutputLiteral(outVal, dtOut);
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, outVal)) return [{ ...subst }];
      return [];
    }
    if (pv === MATH_NS + "acos") {
      return evalUnaryMathRel(g, subst, Math.acos, Math.cos);
    }
    if (pv === MATH_NS + "asin") {
      return evalUnaryMathRel(g, subst, Math.asin, Math.sin);
    }
    if (pv === MATH_NS + "atan") {
      return evalUnaryMathRel(g, subst, Math.atan, Math.tan);
    }
    if (pv === MATH_NS + "sin") {
      return evalUnaryMathRel(g, subst, Math.sin, Math.asin);
    }
    if (pv === MATH_NS + "cos") {
      return evalUnaryMathRel(g, subst, Math.cos, Math.acos);
    }
    if (pv === MATH_NS + "tan") {
      return evalUnaryMathRel(g, subst, Math.tan, Math.atan);
    }
    if (pv === MATH_NS + "sinh") {
      if (typeof Math.sinh !== "function" || typeof Math.asinh !== "function") return [];
      return evalUnaryMathRel(g, subst, Math.sinh, Math.asinh);
    }
    if (pv === MATH_NS + "cosh") {
      if (typeof Math.cosh !== "function" || typeof Math.acosh !== "function") return [];
      return evalUnaryMathRel(g, subst, Math.cosh, Math.acosh);
    }
    if (pv === MATH_NS + "tanh") {
      if (typeof Math.tanh !== "function" || typeof Math.atanh !== "function") return [];
      return evalUnaryMathRel(g, subst, Math.tanh, Math.atanh);
    }
    if (pv === MATH_NS + "degrees") {
      const toDeg = (rad) => rad * 180 / Math.PI;
      const toRad = (deg) => deg * Math.PI / 180;
      return evalUnaryMathRel(g, subst, toDeg, toRad);
    }
    if (pv === MATH_NS + "negation") {
      const neg = (x) => -x;
      return evalUnaryMathRel(g, subst, neg, neg);
    }
    if (pv === MATH_NS + "remainder") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [a0, b0] = g.s.elems;
      const ai = parseIntLiteral(a0);
      const bi = parseIntLiteral(b0);
      if (ai !== null && bi !== null) {
        if (bi === 0n) return [];
        const r2 = ai % bi;
        const lit2 = makeNumericOutputLiteral(r2, XSD_INTEGER_DT);
        if (g.o instanceof Var) {
          const s2 = { ...subst };
          s2[g.o.name] = lit2;
          return [s2];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        const oi = parseIntLiteral(g.o);
        if (oi !== null && oi === r2) return [{ ...subst }];
        if (numEqualTerm(g.o, Number(r2))) return [{ ...subst }];
        return [];
      }
      const a = parseNum(a0);
      const b = parseNum(b0);
      if (a === null || b === null) return [];
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];
      if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
      const rVal = a % b;
      const lit = makeNumericOutputLiteral(rVal, XSD_INTEGER_DT);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, rVal)) return [{ ...subst }];
      return [];
    }
    if (pv === MATH_NS + "rounded") {
      const a = parseNum(g.s);
      if (a === null) return [];
      if (Number.isNaN(a)) return [];
      const rVal = Math.round(a);
      const lit = internLiteral(String(rVal));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, rVal)) return [{ ...subst }];
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "day") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.day));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.day)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "hour") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.hour));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.hour)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "minute") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.minute));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.minute)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "month") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.month));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.month)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "second") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.second));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.second)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "timeZone") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      if (parts.tz === null) return [];
      const out = internLiteral(`"${parts.tz}"`);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = out;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (termsEqual(g.o, out)) return [{ ...subst }];
      if (g.o instanceof Literal) {
        const [lexO, dtO] = literalParts2(g.o.value);
        if (dtO === XSD_NS + "string" && stripQuotes(lexO) === parts.tz) return [{ ...subst }];
      }
      return [];
    }
    if (pv === TIME_NS + "year") {
      const parts = parseXsdDateTimeLexParts(g.s);
      if (!parts) return [];
      const out = internLiteral(String(parts.yearStr));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = out;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const oi = parseIntLiteral(g.o);
      if (oi !== null) {
        try {
          if (oi === BigInt(parts.yearStr)) return [{ ...subst }];
        } catch {
        }
      }
      const s2 = unifyTerm(g.o, out, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === TIME_NS + "localTime") {
      const now = getNowLex();
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = internLiteral(`"${now}"^^<${XSD_NS}dateTime>`);
        return [s2];
      }
      if (g.o instanceof Literal) {
        const [lexO] = literalParts2(g.o.value);
        if (stripQuotes(lexO) === now) return [{ ...subst }];
      }
      return [];
    }
    if (pv === LIST_NS + "append") {
      if (!(g.s instanceof ListTerm)) return [];
      const parts = g.s.elems;
      if (g.o instanceof ListTerm) {
        return listAppendSplit(parts, g.o.elems, subst);
      }
      const outElems = [];
      for (const part of parts) {
        if (!(part instanceof ListTerm)) return [];
        outElems.push(...part.elems);
      }
      const result = new ListTerm(outElems);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = result;
        return [s2];
      }
      if (termsEqual(g.o, result)) return [{ ...subst }];
      return [];
    }
    if (pv === LIST_NS + "first" || pv === RDF_NS + "first") {
      return evalListFirstLikeBuiltin(g.s, g.o, subst);
    }
    if (pv === LIST_NS + "rest" || pv === RDF_NS + "rest") {
      return evalListRestLikeBuiltin(g.s, g.o, subst);
    }
    if (pv === LIST_NS + "iterate") {
      if (!(g.s instanceof ListTerm)) return [];
      const xs = g.s.elems;
      const outs = [];
      for (let i = 0; i < xs.length; i++) {
        const idxLit = internLiteral(String(i));
        const val = xs[i];
        if (g.o instanceof ListTerm && g.o.elems.length === 2) {
          const [idxPat, valPat] = g.o.elems;
          const s1 = unifyTerm(idxPat, idxLit, subst);
          if (s1 === null) continue;
          const valPat2 = applySubstTerm(valPat, s1);
          if (isGroundTerm(valPat2)) {
            if (termsEqualNoIntDecimal(valPat2, val)) outs.push({ ...s1 });
            continue;
          }
          const s22 = unifyTerm(valPat, val, s1);
          if (s22 !== null) outs.push(s22);
          continue;
        }
        const pair = new ListTerm([idxLit, val]);
        const s2 = unifyTerm(g.o, pair, subst);
        if (s2 !== null) outs.push(s2);
      }
      return outs;
    }
    if (pv === LIST_NS + "last") {
      if (!(g.s instanceof ListTerm)) return [];
      const xs = g.s.elems;
      if (!xs.length) return [];
      const last = xs[xs.length - 1];
      const s2 = unifyTerm(g.o, last, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LIST_NS + "memberAt") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [listTerm, indexTerm] = g.s.elems;
      if (!(listTerm instanceof ListTerm)) return [];
      const xs = listTerm.elems;
      const outs = [];
      for (let i = 0; i < xs.length; i++) {
        const idxLit = internLiteral(String(i));
        let s1 = null;
        const idxPat2 = applySubstTerm(indexTerm, subst);
        if (isGroundTerm(idxPat2)) {
          if (!termsEqualNoIntDecimal(idxPat2, idxLit)) continue;
          s1 = { ...subst };
        } else {
          s1 = unifyTerm(indexTerm, idxLit, subst);
          if (s1 === null) continue;
        }
        const o2 = applySubstTerm(g.o, s1);
        if (isGroundTerm(o2)) {
          if (termsEqualNoIntDecimal(o2, xs[i])) outs.push({ ...s1 });
          continue;
        }
        const s2 = unifyTerm(g.o, xs[i], s1);
        if (s2 !== null) outs.push(s2);
      }
      return outs;
    }
    if (pv === LIST_NS + "remove") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [listTerm, itemTerm] = g.s.elems;
      if (!(listTerm instanceof ListTerm)) return [];
      const item2 = applySubstTerm(itemTerm, subst);
      if (!isGroundTerm(item2)) return [];
      const xs = listTerm.elems;
      const filtered = [];
      for (const e of xs) {
        if (!termsEqualNoIntDecimal(e, item2)) filtered.push(e);
      }
      const resList = new ListTerm(filtered);
      const s2 = unifyTerm(g.o, resList, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LIST_NS + "member") {
      if (!(g.s instanceof ListTerm)) return [];
      const outs = [];
      for (const x of g.s.elems) {
        const s2 = unifyTerm(g.o, x, subst);
        if (s2 !== null) outs.push(s2);
      }
      return outs;
    }
    if (pv === LIST_NS + "in") {
      if (!(g.o instanceof ListTerm)) return [];
      const outs = [];
      for (const x of g.o.elems) {
        const s2 = unifyTerm(g.s, x, subst);
        if (s2 !== null) outs.push(s2);
      }
      return outs;
    }
    if (pv === LIST_NS + "length") {
      if (!(g.s instanceof ListTerm)) return [];
      const nTerm = internLiteral(String(g.s.elems.length));
      const o2 = applySubstTerm(g.o, subst);
      if (isGroundTerm(o2)) {
        return termsEqualNoIntDecimal(o2, nTerm) ? [{ ...subst }] : [];
      }
      const s2 = unifyTerm(g.o, nTerm, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LIST_NS + "notMember") {
      if (!(g.s instanceof ListTerm)) return [];
      for (const el of g.s.elems) {
        if (unifyTerm(g.o, el, subst) !== null) return [];
      }
      return [{ ...subst }];
    }
    if (pv === LIST_NS + "reverse") {
      if (g.s instanceof ListTerm) {
        const rev = [...g.s.elems].reverse();
        const rterm = new ListTerm(rev);
        const s2 = unifyTerm(g.o, rterm, subst);
        return s2 !== null ? [s2] : [];
      }
      if (g.o instanceof ListTerm) {
        const rev = [...g.o.elems].reverse();
        const rterm = new ListTerm(rev);
        const s2 = unifyTerm(g.s, rterm, subst);
        return s2 !== null ? [s2] : [];
      }
      return [];
    }
    if (pv === LIST_NS + "sort") {
      let cmpTermForSort = function(a, b) {
        if (a instanceof Literal && b instanceof Literal) {
          const [lexA] = literalParts2(a.value);
          const [lexB] = literalParts2(b.value);
          const sa2 = stripQuotes(lexA);
          const sb2 = stripQuotes(lexB);
          const na = Number(sa2);
          const nb = Number(sb2);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) {
            if (na < nb) return -1;
            if (na > nb) return 1;
            return 0;
          }
          if (sa2 < sb2) return -1;
          if (sa2 > sb2) return 1;
          return 0;
        }
        if (a instanceof ListTerm && b instanceof ListTerm) {
          const xs = a.elems;
          const ys = b.elems;
          let i = 0;
          while (true) {
            if (i >= xs.length && i >= ys.length) return 0;
            if (i >= xs.length) return -1;
            if (i >= ys.length) return 1;
            const c = cmpTermForSort(xs[i], ys[i]);
            if (c !== 0) return c;
            i++;
          }
        }
        if (a instanceof Iri && b instanceof Iri) {
          if (a.value < b.value) return -1;
          if (a.value > b.value) return 1;
          return 0;
        }
        if (a instanceof ListTerm && !(b instanceof ListTerm)) return -1;
        if (!(a instanceof ListTerm) && b instanceof ListTerm) return 1;
        const sa = JSON.stringify(a);
        const sb = JSON.stringify(b);
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
      };
      let inputList;
      if (g.s instanceof ListTerm) inputList = g.s.elems;
      else if (g.o instanceof ListTerm) inputList = g.o.elems;
      else return [];
      if (!inputList.every((e) => isGroundTerm(e))) return [];
      const sortedList = [...inputList].sort(cmpTermForSort);
      const sortedTerm = new ListTerm(sortedList);
      if (g.s instanceof ListTerm) {
        const s2 = unifyTerm(g.o, sortedTerm, subst);
        return s2 !== null ? [s2] : [];
      }
      if (g.o instanceof ListTerm) {
        const s2 = unifyTerm(g.s, sortedTerm, subst);
        return s2 !== null ? [s2] : [];
      }
      return [];
    }
    if (pv === LIST_NS + "map") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [inputTerm, predTerm] = g.s.elems;
      if (!(inputTerm instanceof ListTerm)) return [];
      const inputList = inputTerm.elems;
      if (!(predTerm instanceof Iri)) return [];
      const pred = internIri(predTerm.value);
      if (!inputList.every((e) => isGroundTerm(e))) return [];
      const results = [];
      for (const el of inputList) {
        const yvar = new Var("_mapY");
        const goal2 = new Triple(el, pred, yvar);
        const sols = proveGoals([goal2], subst, facts, backRules, depth + 1, [], varGen);
        for (const sol of sols) {
          const yval = applySubstTerm(yvar, sol);
          if (yval instanceof Var) continue;
          results.push(yval);
        }
      }
      const outList = new ListTerm(results);
      const s2 = unifyTerm(g.o, outList, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LIST_NS + "firstRest") {
      if (g.s instanceof ListTerm) {
        if (!g.s.elems.length) return [];
        const first = g.s.elems[0];
        const rest = new ListTerm(g.s.elems.slice(1));
        const pair = new ListTerm([first, rest]);
        const s2 = unifyTerm(g.o, pair, subst);
        return s2 !== null ? [s2] : [];
      }
      if (g.o instanceof ListTerm && g.o.elems.length === 2) {
        const first = g.o.elems[0];
        const rest = g.o.elems[1];
        if (rest instanceof ListTerm) {
          const xs = [first, ...rest.elems];
          const constructed = new ListTerm(xs);
          const s2 = unifyTerm(g.s, constructed, subst);
          return s2 !== null ? [s2] : [];
        }
        if (rest instanceof Var) {
          const constructed = new OpenListTerm([first], rest.name);
          const s2 = unifyTerm(g.s, constructed, subst);
          return s2 !== null ? [s2] : [];
        }
        if (rest instanceof OpenListTerm) {
          const newPrefix = [first, ...rest.prefix];
          const constructed = new OpenListTerm(newPrefix, rest.tailVar);
          const s2 = unifyTerm(g.s, constructed, subst);
          return s2 !== null ? [s2] : [];
        }
      }
      return [];
    }
    if (pv === LOG_NS + "equalTo") {
      const s2 = unifyTerm(goal.s, goal.o, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "notEqualTo") {
      const s2 = unifyTerm(goal.s, goal.o, subst);
      if (s2 !== null) return [];
      return [{ ...subst }];
    }
    if (pv === LOG_NS + "conjunction") {
      if (!(g.s instanceof ListTerm)) return [];
      const parts = g.s.elems;
      if (!parts.length) return [];
      const merged = [];
      const fastKeySet = /* @__PURE__ */ new Set();
      for (const part of parts) {
        if (part instanceof Literal && part.value === "true") continue;
        if (!(part instanceof GraphTerm)) return [];
        for (const tr of part.triples) {
          const k = tripleFastKey(tr);
          if (k !== null) {
            if (fastKeySet.has(k)) continue;
            fastKeySet.add(k);
            merged.push(tr);
            continue;
          }
          let dup = false;
          for (const ex of merged) {
            if (triplesEqual(tr, ex)) {
              dup = true;
              break;
            }
          }
          if (!dup) merged.push(tr);
        }
      }
      const outFormula = new GraphTerm(merged);
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, outFormula, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "conclusion") {
      let inFormula = null;
      if (g.s instanceof GraphTerm) inFormula = g.s;
      else if (g.s instanceof Literal && g.s.value === "true") inFormula = new GraphTerm([]);
      else return [];
      const conclusion = __computeConclusionFromFormula(inFormula);
      if (!(conclusion instanceof GraphTerm)) return [];
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = conclusion;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, conclusion, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "content") {
      const iri = iriValue(g.s);
      if (iri === null) return [];
      const docIri = __stripFragment(iri);
      const text = __derefTextSync(docIri);
      if (typeof text !== "string") return [];
      const lit = internLiteral(`${JSON.stringify(text)}^^<${XSD_NS}string>`);
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "semantics") {
      const iri = iriValue(g.s);
      if (iri === null) return [];
      const docIri = __stripFragment(iri);
      const formula = __derefSemanticsSync(docIri);
      if (!(formula instanceof GraphTerm)) return [];
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = formula;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, formula, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "semanticsOrError") {
      const iri = iriValue(g.s);
      if (iri === null) return [];
      const docIri = __stripFragment(iri);
      const norm = __normalizeDerefIri(docIri);
      const key = typeof norm === "string" && norm ? norm : docIri;
      let term = null;
      if (__logSemanticsOrErrorCache.has(key)) {
        term = __logSemanticsOrErrorCache.get(key);
      } else {
        const formula = __derefSemanticsSync(docIri);
        if (formula instanceof GraphTerm) {
          term = formula;
        } else {
          const txt = __derefTextSync(docIri);
          if (typeof txt !== "string") {
            term = makeStringLiteral(`error(dereference_failed,${docIri})`);
          } else {
            try {
              const baseIri = typeof key === "string" && key ? key : docIri;
              term = __parseSemanticsToFormula(txt, baseIri);
              __logSemanticsCache.set(key, term);
            } catch (e) {
              const msg = e && e.message ? e.message : String(e);
              term = makeStringLiteral(`error(parse_error,${msg})`);
            }
          }
        }
        __logSemanticsOrErrorCache.set(key, term);
      }
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = term;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, term, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "parsedAsN3") {
      const txt = termToJsXsdStringNoLang(g.s);
      if (txt === null) return [];
      let formula;
      try {
        formula = __parseSemanticsToFormula(txt, "");
      } catch {
        return [];
      }
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = formula;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, formula, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "rawType") {
      if (g.s instanceof Var) return [];
      let ty;
      if (g.s instanceof GraphTerm) ty = internIri(LOG_NS + "Formula");
      else if (g.s instanceof Literal) ty = internIri(LOG_NS + "Literal");
      else if (g.s instanceof ListTerm || g.s instanceof OpenListTerm) ty = internIri(RDF_NS + "List");
      else ty = internIri(LOG_NS + "Other");
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = ty;
        return [s22];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      const s2 = unifyTerm(g.o, ty, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "dtlit") {
      if (g.s instanceof Var && g.o instanceof Var) return [{ ...subst }];
      const results = [];
      if (g.o instanceof Literal) {
        const [oLex, oDt0] = literalParts2(g.o.value);
        let oDt = oDt0;
        if (oDt === null) {
          if (literalHasLangTag(g.o.value)) oDt = RDF_NS + "langString";
          else if (isPlainStringLiteralValue(g.o.value)) oDt = XSD_NS + "string";
        }
        if (oDt !== null) {
          const strLit = isQuotedLexical(oLex) ? internLiteral(oLex) : makeStringLiteral(String(oLex));
          const subjList = new ListTerm([strLit, internIri(oDt)]);
          const s2 = unifyTerm(goal.s, subjList, subst);
          if (s2 !== null) results.push(s2);
        }
      }
      if (g.s instanceof ListTerm && g.s.elems.length === 2) {
        const a = g.s.elems[0];
        const b = g.s.elems[1];
        if (a instanceof Literal && b instanceof Iri) {
          const [sLex, sDt0] = literalParts2(a.value);
          const okString = sDt0 === null && isPlainStringLiteralValue(a.value) || sDt0 === XSD_NS + "string";
          if (okString) {
            const dtIri = b.value;
            const outLit = dtIri === XSD_NS + "string" ? internLiteral(sLex) : internLiteral(`${sLex}^^<${dtIri}>`);
            const s2 = unifyTerm(goal.o, outLit, subst);
            if (s2 !== null) results.push(s2);
          }
        }
      }
      return results;
    }
    if (pv === LOG_NS + "langlit") {
      let extractLangTag = function(litVal) {
        if (typeof litVal !== "string") return null;
        if (!literalHasLangTag(litVal)) return null;
        const lastQuote = litVal.lastIndexOf('"');
        if (lastQuote < 0) return null;
        const after = lastQuote + 1;
        if (after >= litVal.length || litVal[after] !== "@") return null;
        const tag = litVal.slice(after + 1);
        if (!LANG_RE.test(tag)) return null;
        return tag;
      };
      if (g.s instanceof Var && g.o instanceof Var) return [{ ...subst }];
      const results = [];
      const LANG_RE = /^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/;
      if (g.o instanceof Literal) {
        const tag = extractLangTag(g.o.value);
        if (tag !== null) {
          const [oLex] = literalParts2(g.o.value);
          const strLit = isQuotedLexical(oLex) ? internLiteral(oLex) : makeStringLiteral(String(oLex));
          const langLit = makeStringLiteral(tag);
          const subjList = new ListTerm([strLit, langLit]);
          const s2 = unifyTerm(goal.s, subjList, subst);
          if (s2 !== null) results.push(s2);
        }
      }
      if (g.s instanceof ListTerm && g.s.elems.length === 2) {
        const a = g.s.elems[0];
        const b = g.s.elems[1];
        if (a instanceof Literal && b instanceof Literal) {
          const [sLex, sDt0] = literalParts2(a.value);
          const okString = sDt0 === null && isPlainStringLiteralValue(a.value) || sDt0 === XSD_NS + "string";
          const [langLex, langDt0] = literalParts2(b.value);
          const okLang = langDt0 === null && isPlainStringLiteralValue(b.value) || langDt0 === XSD_NS + "string";
          if (okString && okLang) {
            const tag = stripQuotes(langLex);
            if (LANG_RE.test(tag)) {
              const outLit = internLiteral(`${sLex}@${tag}`);
              const s2 = unifyTerm(goal.o, outLit, subst);
              if (s2 !== null) results.push(s2);
            }
          }
        }
      }
      return results;
    }
    if (pv === LOG_NS + "implies") {
      const allFw = backRules.__allForwardRules || [];
      const results = [];
      for (const r0 of allFw) {
        if (!r0.isForward) continue;
        const r2 = standardizeRule(r0, varGen);
        const premF = new GraphTerm(r2.premise);
        const concTerm = r0.isFuse ? internLiteral("false") : new GraphTerm(r2.conclusion);
        let s2 = unifyTerm(goal.s, premF, subst);
        if (s2 === null) continue;
        s2 = unifyTerm(goal.o, concTerm, s2);
        if (s2 === null) continue;
        results.push(s2);
      }
      return results;
    }
    if (pv === LOG_NS + "impliedBy") {
      const allBw = backRules.__allBackwardRules || backRules;
      const results = [];
      for (const r0 of allBw) {
        if (r0.isForward) continue;
        const r2 = standardizeRule(r0, varGen);
        const headF = new GraphTerm(r2.conclusion);
        const bodyF = new GraphTerm(r2.premise);
        let s2 = unifyTerm(goal.s, headF, subst);
        if (s2 === null) continue;
        s2 = unifyTerm(goal.o, bodyF, s2);
        if (s2 === null) continue;
        results.push(s2);
      }
      return results;
    }
    if (pv === LOG_NS + "includes") {
      let scopeFacts = null;
      let scopeBackRules = backRules;
      if (g.s instanceof GraphTerm) {
        scopeFacts = g.s.triples.slice();
        ensureFactIndexes(scopeFacts);
        Object.defineProperty(scopeFacts, "__scopedSnapshot", {
          value: scopeFacts,
          enumerable: false,
          writable: true
        });
        const lvlHere = facts && typeof facts.__scopedClosureLevel === "number" ? facts.__scopedClosureLevel : 0;
        Object.defineProperty(scopeFacts, "__scopedClosureLevel", {
          value: lvlHere,
          enumerable: false,
          writable: true
        });
        scopeBackRules = [];
      } else {
        let prio = 1;
        if (g.s instanceof Var) {
          prio = 1;
        } else {
          const p0 = __logNaturalPriorityFromTerm(g.s);
          if (p0 !== null) prio = p0;
        }
        const snap = facts.__scopedSnapshot || null;
        const lvl = facts && typeof facts.__scopedClosureLevel === "number" && facts.__scopedClosureLevel || 0;
        if (!snap) return [];
        if (lvl < prio) return [];
        scopeFacts = snap;
      }
      if (g.o instanceof Literal && g.o.value === "true") return [{ ...subst }];
      if (!(g.o instanceof GraphTerm)) return [];
      const visited2 = [];
      return proveGoals(
        Array.from(g.o.triples),
        { ...subst },
        scopeFacts,
        scopeBackRules,
        depth + 1,
        visited2,
        varGen,
        maxResults
      );
    }
    if (pv === LOG_NS + "notIncludes") {
      let scopeFacts = null;
      let scopeBackRules = backRules;
      if (g.s instanceof GraphTerm) {
        scopeFacts = g.s.triples.slice();
        ensureFactIndexes(scopeFacts);
        Object.defineProperty(scopeFacts, "__scopedSnapshot", {
          value: scopeFacts,
          enumerable: false,
          writable: true
        });
        const lvlHere = facts && typeof facts.__scopedClosureLevel === "number" ? facts.__scopedClosureLevel : 0;
        Object.defineProperty(scopeFacts, "__scopedClosureLevel", {
          value: lvlHere,
          enumerable: false,
          writable: true
        });
        scopeBackRules = [];
      } else {
        let prio = 1;
        if (g.s instanceof Var) {
          prio = 1;
        } else {
          const p0 = __logNaturalPriorityFromTerm(g.s);
          if (p0 !== null) prio = p0;
        }
        const snap = facts.__scopedSnapshot || null;
        const lvl = facts && typeof facts.__scopedClosureLevel === "number" && facts.__scopedClosureLevel || 0;
        if (!snap) return [];
        if (lvl < prio) return [];
        scopeFacts = snap;
      }
      if (g.o instanceof Literal && g.o.value === "true") return [];
      if (!(g.o instanceof GraphTerm)) return [];
      const visited2 = [];
      const sols = proveGoals(
        Array.from(g.o.triples),
        { ...subst },
        scopeFacts,
        scopeBackRules,
        depth + 1,
        visited2,
        varGen,
        1
      );
      return sols.length ? [] : [{ ...subst }];
    }
    if (pv === LOG_NS + "trace") {
      const pref = __tracePrefixes || __traceDefaultPrefixes;
      const fmt = typeof __traceTermFormatter === "function" ? __traceTermFormatter : (t) => String(t);
      const xStr = fmt(g.s, pref);
      const yStr = fmt(g.o, pref);
      __traceWriteLine(`${xStr} TRACE ${yStr}`);
      return [{ ...subst }];
    }
    if (pv === LOG_NS + "outputString") {
      if (g.s instanceof Var) return [];
      if (g.o instanceof Var) return [];
      const s = termToJsString(g.o);
      if (s === null) return [];
      return [{ ...subst }];
    }
    if (pv === LOG_NS + "collectAllIn") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 3) return [];
      const [valueTempl, clauseTerm, listTerm] = g.s.elems;
      if (!(clauseTerm instanceof GraphTerm)) return [];
      let outSubst = { ...subst };
      let scopeFacts = null;
      let scopeBackRules = backRules;
      if (g.o instanceof GraphTerm) {
        scopeFacts = g.o.triples.slice();
        ensureFactIndexes(scopeFacts);
        Object.defineProperty(scopeFacts, "__scopedSnapshot", {
          value: scopeFacts,
          enumerable: false,
          writable: true
        });
        const lvlHere = facts && typeof facts.__scopedClosureLevel === "number" ? facts.__scopedClosureLevel : 0;
        Object.defineProperty(scopeFacts, "__scopedClosureLevel", {
          value: lvlHere,
          enumerable: false,
          writable: true
        });
        scopeBackRules = [];
      } else {
        let prio = 1;
        if (g.o instanceof Var) {
          prio = 1;
        } else {
          const p0 = __logNaturalPriorityFromTerm(g.o);
          if (p0 !== null) prio = p0;
        }
        const snap = facts.__scopedSnapshot || null;
        const lvl = facts && typeof facts.__scopedClosureLevel === "number" && facts.__scopedClosureLevel || 0;
        if (!snap) return [];
        if (lvl < prio) return [];
        scopeFacts = snap;
      }
      if (listTerm instanceof Blank) {
        return [outSubst];
      }
      const visited2 = [];
      const sols = proveGoals(
        Array.from(clauseTerm.triples),
        {},
        scopeFacts,
        scopeBackRules,
        depth + 1,
        visited2,
        varGen
      );
      const collected = sols.map((sBody) => applySubstTerm(valueTempl, sBody));
      const collectedList = new ListTerm(collected);
      const s2 = unifyTerm(listTerm, collectedList, outSubst);
      return s2 ? [s2] : [];
    }
    if (pv === LOG_NS + "forAllIn") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const [whereClause, thenClause] = g.s.elems;
      if (!(whereClause instanceof GraphTerm) || !(thenClause instanceof GraphTerm)) return [];
      let outSubst = { ...subst };
      let scopeFacts = null;
      let scopeBackRules = backRules;
      if (g.o instanceof GraphTerm) {
        scopeFacts = g.o.triples.slice();
        ensureFactIndexes(scopeFacts);
        Object.defineProperty(scopeFacts, "__scopedSnapshot", {
          value: scopeFacts,
          enumerable: false,
          writable: true
        });
        const lvlHere = facts && typeof facts.__scopedClosureLevel === "number" ? facts.__scopedClosureLevel : 0;
        Object.defineProperty(scopeFacts, "__scopedClosureLevel", {
          value: lvlHere,
          enumerable: false,
          writable: true
        });
        scopeBackRules = [];
      } else {
        let prio = 1;
        if (g.o instanceof Var) {
          prio = 1;
        } else {
          const p0 = __logNaturalPriorityFromTerm(g.o);
          if (p0 !== null) prio = p0;
        }
        const snap = facts.__scopedSnapshot || null;
        const lvl = facts && typeof facts.__scopedClosureLevel === "number" && facts.__scopedClosureLevel || 0;
        if (!snap) return [];
        if (lvl < prio) return [];
        scopeFacts = snap;
      }
      const visited1 = [];
      const sols1 = proveGoals(
        Array.from(whereClause.triples),
        {},
        scopeFacts,
        scopeBackRules,
        depth + 1,
        visited1,
        varGen
      );
      for (const s1 of sols1) {
        const visited2 = [];
        const sols2 = proveGoals(
          Array.from(thenClause.triples),
          s1,
          scopeFacts,
          scopeBackRules,
          depth + 1,
          visited2,
          varGen
        );
        if (!sols2.length) return [];
      }
      return [outSubst];
    }
    if (pv === LOG_NS + "skolem") {
      if (!isGroundTerm(g.s)) return [];
      const key = skolemKeyFromTerm(g.s);
      let iri = skolemCache.get(key);
      if (!iri) {
        const id = deterministicSkolemIdFromKey(key);
        iri = internIri(SKOLEM_NS + id);
        skolemCache.set(key, iri);
      }
      const s2 = unifyTerm(goal.o, iri, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === LOG_NS + "uri") {
      if (g.s instanceof Iri) {
        const uriStr = g.s.value;
        const lit = makeStringLiteral(uriStr);
        const s2 = unifyTerm(goal.o, lit, subst);
        return s2 !== null ? [s2] : [];
      }
      if (g.o instanceof Literal) {
        const uriStr = termToJsString(g.o);
        if (uriStr === null) return [];
        if (uriStr.startsWith("_:") || /[\u0000-\u0020<>"{}|^`\\]/.test(uriStr)) {
          return [];
        }
        const iri = internIri(uriStr);
        const s2 = unifyTerm(goal.s, iri, subst);
        return s2 !== null ? [s2] : [];
      }
      const sOk = g.s instanceof Var || g.s instanceof Blank || g.s instanceof Iri;
      const oOk = g.o instanceof Var || g.o instanceof Blank || g.o instanceof Literal;
      if (!sOk || !oOk) return [];
      return [{ ...subst }];
    }
    if (pv === STRING_NS + "concatenation") {
      if (!(g.s instanceof ListTerm)) return [];
      const parts = [];
      for (const t of g.s.elems) {
        const sStr = termToJsString(t);
        if (sStr === null) return [];
        parts.push(sStr);
      }
      const lit = makeStringLiteral(parts.join(""));
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === STRING_NS + "contains") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.includes(oStr) ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "containsIgnoringCase") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.toLowerCase().includes(oStr.toLowerCase()) ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "endsWith") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.endsWith(oStr) ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "equalIgnoringCase") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.toLowerCase() === oStr.toLowerCase() ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "format") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length < 1) return [];
      const fmtStr = termToJsString(g.s.elems[0]);
      if (fmtStr === null) return [];
      const args = [];
      for (let i = 1; i < g.s.elems.length; i++) {
        const aStr = termToJsString(g.s.elems[i]);
        if (aStr === null) return [];
        args.push(aStr);
      }
      const formatted = simpleStringFormat(fmtStr, args);
      if (formatted === null) return [];
      const lit = makeStringLiteral(formatted);
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === STRING_NS + "jsonPointer") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const jsonText = termToJsonText(g.s.elems[0]);
      const ptr = termToJsStringDecoded(g.s.elems[1]);
      if (jsonText === null || ptr === null) return [];
      const valTerm = jsonPointerLookup(jsonText, ptr);
      if (valTerm === null) return [];
      const s2 = unifyTerm(g.o, valTerm, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === STRING_NS + "greaterThan") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr > oStr ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "lessThan") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr < oStr ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "matches") {
      const sStr = termToJsString(g.s);
      const pattern = termToJsString(g.o);
      if (sStr === null || pattern === null) return [];
      const re = compileSwapRegex(pattern, "");
      if (!re) return [];
      return re.test(sStr) ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "notEqualIgnoringCase") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.toLowerCase() !== oStr.toLowerCase() ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "notGreaterThan") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr <= oStr ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "notLessThan") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr >= oStr ? [{ ...subst }] : [];
    }
    if (pv === STRING_NS + "notMatches") {
      const sStr = termToJsString(g.s);
      const pattern = termToJsString(g.o);
      if (sStr === null || pattern === null) return [];
      const re = compileSwapRegex(pattern, "");
      if (!re) return [];
      return re.test(sStr) ? [] : [{ ...subst }];
    }
    if (pv === STRING_NS + "replace") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 3) return [];
      const dataStr = termToJsString(g.s.elems[0]);
      const searchStr = termToJsString(g.s.elems[1]);
      const replStr = termToJsString(g.s.elems[2]);
      if (dataStr === null || searchStr === null || replStr === null) return [];
      const re = compileSwapRegex(searchStr, "g");
      if (!re) return [];
      const outStr = dataStr.replace(re, replStr);
      const lit = makeStringLiteral(outStr);
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === STRING_NS + "scrape") {
      if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
      const dataStr = termToJsString(g.s.elems[0]);
      const pattern = termToJsString(g.s.elems[1]);
      if (dataStr === null || pattern === null) return [];
      const re = compileSwapRegex(pattern, "");
      if (!re) return [];
      const m = re.exec(dataStr);
      if (!m || m.length < 2) return [];
      const group = m[1];
      const lit = makeStringLiteral(group);
      if (g.o instanceof Var) {
        const s22 = { ...subst };
        s22[g.o.name] = lit;
        return [s22];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }
    if (pv === STRING_NS + "startsWith") {
      const sStr = termToJsString(g.s);
      const oStr = termToJsString(g.o);
      if (sStr === null || oStr === null) return [];
      return sStr.startsWith(oStr) ? [{ ...subst }] : [];
    }
    return [];
  }
  function isBuiltinPred(p) {
    if (!(p instanceof Iri)) return false;
    const v = p.value;
    if (superRestrictedMode) {
      return v === LOG_NS + "implies" || v === LOG_NS + "impliedBy";
    }
    if (v === RDF_NS + "first" || v === RDF_NS + "rest") {
      return true;
    }
    return v.startsWith(CRYPTO_NS) || v.startsWith(MATH_NS) || v.startsWith(LOG_NS) || v.startsWith(STRING_NS) || v.startsWith(TIME_NS) || v.startsWith(LIST_NS);
  }
  function standardizeRule(rule, gen) {
    function renameTerm(t, vmap, genArr) {
      if (t instanceof Var) {
        if (!vmap.hasOwnProperty(t.name)) {
          const name = `${t.name}__${genArr[0]}`;
          genArr[0] += 1;
          vmap[t.name] = name;
        }
        return new Var(vmap[t.name]);
      }
      if (t instanceof ListTerm) {
        let changed = false;
        const elems2 = t.elems.map((e) => {
          const e2 = renameTerm(e, vmap, genArr);
          if (e2 !== e) changed = true;
          return e2;
        });
        return changed ? new ListTerm(elems2) : t;
      }
      if (t instanceof OpenListTerm) {
        let changed = false;
        const newXs = t.prefix.map((e) => {
          const e2 = renameTerm(e, vmap, genArr);
          if (e2 !== e) changed = true;
          return e2;
        });
        if (!vmap.hasOwnProperty(t.tailVar)) {
          const name = `${t.tailVar}__${genArr[0]}`;
          genArr[0] += 1;
          vmap[t.tailVar] = name;
        }
        const newTail = vmap[t.tailVar];
        if (newTail !== t.tailVar) changed = true;
        return changed ? new OpenListTerm(newXs, newTail) : t;
      }
      if (t instanceof GraphTerm) {
        let changed = false;
        const triples2 = t.triples.map((tr) => {
          const s2 = renameTerm(tr.s, vmap, genArr);
          const p2 = renameTerm(tr.p, vmap, genArr);
          const o2 = renameTerm(tr.o, vmap, genArr);
          if (s2 !== tr.s || p2 !== tr.p || o2 !== tr.o) changed = true;
          return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
        });
        return changed ? new GraphTerm(triples2) : t;
      }
      return t;
    }
    const vmap2 = {};
    const premise = rule.premise.map((tr) => {
      const s2 = renameTerm(tr.s, vmap2, gen);
      const p2 = renameTerm(tr.p, vmap2, gen);
      const o2 = renameTerm(tr.o, vmap2, gen);
      return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
    });
    const conclusion = rule.conclusion.map((tr) => {
      const s2 = renameTerm(tr.s, vmap2, gen);
      const p2 = renameTerm(tr.p, vmap2, gen);
      const o2 = renameTerm(tr.o, vmap2, gen);
      return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
    });
    return new Rule(premise, conclusion, rule.isForward, rule.isFuse, rule.headBlankLabels);
  }
  function listHasTriple(list, tr) {
    return list.some((t) => triplesEqual(t, tr));
  }
  function gcCollectVarsInTerm(t, out) {
    if (t instanceof Var) {
      out.add(t.name);
      return;
    }
    if (t instanceof ListTerm) {
      for (const e of t.elems) gcCollectVarsInTerm(e, out);
      return;
    }
    if (t instanceof OpenListTerm) {
      for (const e of t.prefix) gcCollectVarsInTerm(e, out);
      out.add(t.tailVar);
      return;
    }
    if (t instanceof GraphTerm) {
      for (const tr of t.triples) gcCollectVarsInTriple(tr, out);
      return;
    }
  }
  function gcCollectVarsInTriple(tr, out) {
    gcCollectVarsInTerm(tr.s, out);
    gcCollectVarsInTerm(tr.p, out);
    gcCollectVarsInTerm(tr.o, out);
  }
  function gcCollectVarsInGoals(goals, out) {
    for (const g of goals) gcCollectVarsInTriple(g, out);
  }
  function substSizeOver(subst, limit) {
    let c = 0;
    for (const _k in subst) {
      if (++c > limit) return true;
    }
    return false;
  }
  function gcCompactForGoals(subst, goals, answerVars) {
    const keep = new Set(answerVars);
    gcCollectVarsInGoals(goals, keep);
    const expanded = /* @__PURE__ */ new Set();
    const queue = Array.from(keep);
    while (queue.length) {
      const v = queue.pop();
      if (expanded.has(v)) continue;
      expanded.add(v);
      const bound = subst[v];
      if (bound === void 0) continue;
      const before = keep.size;
      gcCollectVarsInTerm(bound, keep);
      if (keep.size !== before) {
        for (const nv of keep) {
          if (!expanded.has(nv)) queue.push(nv);
        }
      }
    }
    const out = {};
    for (const k of Object.keys(subst)) {
      if (keep.has(k)) out[k] = subst[k];
    }
    return out;
  }
  function maybeCompactSubst(subst, goals, answerVars, depth) {
    if (depth < 128 && !substSizeOver(subst, 256)) return subst;
    return gcCompactForGoals(subst, goals, answerVars);
  }
  function proveGoals(goals, subst, facts, backRules, depth, visited, varGen, maxResults) {
    const results = [];
    const max = typeof maxResults === "number" && maxResults > 0 ? maxResults : Infinity;
    const initialGoals = Array.isArray(goals) ? goals.slice() : [];
    const initialSubst = subst ? { ...subst } : {};
    const initialVisited = visited ? visited.slice() : [];
    const answerVars = /* @__PURE__ */ new Set();
    gcCollectVarsInGoals(initialGoals, answerVars);
    if (!initialGoals.length) {
      results.push(gcCompactForGoals(initialSubst, [], answerVars));
      if (results.length >= max) return results;
      return results;
    }
    const stack = [
      {
        goals: initialGoals,
        subst: initialSubst,
        depth: depth || 0,
        visited: initialVisited
      }
    ];
    while (stack.length) {
      const state = stack.pop();
      if (!state.goals.length) {
        results.push(gcCompactForGoals(state.subst, [], answerVars));
        if (results.length >= max) return results;
        continue;
      }
      const rawGoal = state.goals[0];
      const restGoals = state.goals.slice(1);
      const goal0 = applySubstTriple(rawGoal, state.subst);
      if (isBuiltinPred(goal0.p)) {
        const remaining = max - results.length;
        if (remaining <= 0) return results;
        const builtinMax = Number.isFinite(remaining) && !restGoals.length ? remaining : void 0;
        const deltas = evalBuiltin(goal0, {}, facts, backRules, state.depth, varGen, builtinMax);
        const nextStates = [];
        for (const delta of deltas) {
          const composed = composeSubst(state.subst, delta);
          if (composed === null) continue;
          if (!restGoals.length) {
            results.push(gcCompactForGoals(composed, [], answerVars));
            if (results.length >= max) return results;
          } else {
            const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
            nextStates.push({
              goals: restGoals,
              subst: nextSubst,
              depth: state.depth + 1,
              visited: state.visited
            });
          }
        }
        for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
        continue;
      }
      if (listHasTriple(state.visited, goal0)) continue;
      const visitedForRules = state.visited.concat([goal0]);
      if (goal0.p instanceof Iri) {
        const candidates = candidateFacts(facts, goal0);
        const nextStates = [];
        for (const f of candidates) {
          const delta = unifyTriple(goal0, f, {});
          if (delta === null) continue;
          const composed = composeSubst(state.subst, delta);
          if (composed === null) continue;
          if (!restGoals.length) {
            results.push(gcCompactForGoals(composed, [], answerVars));
            if (results.length >= max) return results;
          } else {
            const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
            nextStates.push({
              goals: restGoals,
              subst: nextSubst,
              depth: state.depth + 1,
              visited: state.visited
            });
          }
        }
        for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
      } else {
        const nextStates = [];
        for (const f of facts) {
          const delta = unifyTriple(goal0, f, {});
          if (delta === null) continue;
          const composed = composeSubst(state.subst, delta);
          if (composed === null) continue;
          if (!restGoals.length) {
            results.push(gcCompactForGoals(composed, [], answerVars));
            if (results.length >= max) return results;
          } else {
            const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
            nextStates.push({
              goals: restGoals,
              subst: nextSubst,
              depth: state.depth + 1,
              visited: state.visited
            });
          }
        }
        for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
      }
      if (goal0.p instanceof Iri) {
        ensureBackRuleIndexes(backRules);
        const candRules = (backRules.__byHeadPred.get(goal0.p.value) || []).concat(backRules.__wildHeadPred);
        const nextStates = [];
        for (const r2 of candRules) {
          if (r2.conclusion.length !== 1) continue;
          const rawHead = r2.conclusion[0];
          if (rawHead.p instanceof Iri && rawHead.p.value !== goal0.p.value) continue;
          const rStd = standardizeRule(r2, varGen);
          const head = rStd.conclusion[0];
          const deltaHead = unifyTriple(head, goal0, {});
          if (deltaHead === null) continue;
          const body = rStd.premise.map((b) => applySubstTriple(b, deltaHead));
          const composed = composeSubst(state.subst, deltaHead);
          if (composed === null) continue;
          const newGoals = body.concat(restGoals);
          const nextSubst = maybeCompactSubst(composed, newGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: newGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: visitedForRules
          });
        }
        for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
      }
    }
    return results;
  }
  function forwardChain(facts, forwardRules, backRules, onDerived) {
    ensureFactIndexes(facts);
    ensureBackRuleIndexes(backRules);
    const factList = facts.slice();
    const derivedForward = [];
    const varGen = [0];
    const skCounter = [0];
    const headSkolemCache = /* @__PURE__ */ new Map();
    function firingKey(ruleIndex, instantiatedPremises) {
      const parts = [];
      for (const tr of instantiatedPremises) {
        parts.push(JSON.stringify([skolemKeyFromTerm(tr.s), skolemKeyFromTerm(tr.p), skolemKeyFromTerm(tr.o)]));
      }
      return `R${ruleIndex}|` + parts.join("\\n");
    }
    backRules.__allForwardRules = forwardRules;
    backRules.__allBackwardRules = backRules;
    let scopedClosureLevel = 0;
    function computeMaxScopedClosurePriorityNeeded() {
      let maxP = 0;
      function scanTriple(tr) {
        if (!(tr && tr.p instanceof Iri)) return;
        const pv = tr.p.value;
        if (pv === LOG_NS + "collectAllIn" || pv === LOG_NS + "forAllIn") {
          if (tr.o instanceof GraphTerm) return;
          if (tr.o instanceof Var) {
            if (maxP < 1) maxP = 1;
            return;
          }
          const p0 = __logNaturalPriorityFromTerm(tr.o);
          if (p0 !== null) {
            if (p0 > maxP) maxP = p0;
          } else {
            if (maxP < 1) maxP = 1;
          }
          return;
        }
        if (pv === LOG_NS + "includes" || pv === LOG_NS + "notIncludes") {
          if (tr.s instanceof GraphTerm) return;
          if (tr.s instanceof Var) {
            if (maxP < 1) maxP = 1;
            return;
          }
          const p0 = __logNaturalPriorityFromTerm(tr.s);
          if (p0 !== null) {
            if (p0 > maxP) maxP = p0;
          } else {
            if (maxP < 1) maxP = 1;
          }
        }
      }
      for (const r2 of forwardRules) {
        for (const tr of r2.premise) scanTriple(tr);
      }
      for (const r2 of backRules) {
        for (const tr of r2.premise) scanTriple(tr);
      }
      return maxP;
    }
    let maxScopedClosurePriorityNeeded = computeMaxScopedClosurePriorityNeeded();
    function setScopedSnapshot(snap, level) {
      if (!Object.prototype.hasOwnProperty.call(facts, "__scopedSnapshot")) {
        Object.defineProperty(facts, "__scopedSnapshot", {
          value: snap,
          enumerable: false,
          writable: true,
          configurable: true
        });
      } else {
        facts.__scopedSnapshot = snap;
      }
      if (!Object.prototype.hasOwnProperty.call(facts, "__scopedClosureLevel")) {
        Object.defineProperty(facts, "__scopedClosureLevel", {
          value: level,
          enumerable: false,
          writable: true,
          configurable: true
        });
      } else {
        facts.__scopedClosureLevel = level;
      }
    }
    function makeScopedSnapshot() {
      const snap = facts.slice();
      ensureFactIndexes(snap);
      Object.defineProperty(snap, "__scopedSnapshot", {
        value: snap,
        enumerable: false,
        writable: true,
        configurable: true
      });
      Object.defineProperty(snap, "__scopedClosureLevel", {
        value: scopedClosureLevel,
        enumerable: false,
        writable: true,
        configurable: true
      });
      return snap;
    }
    function runFixpoint() {
      let anyChange = false;
      while (true) {
        let changed = false;
        for (let i = 0; i < forwardRules.length; i++) {
          let isStrictGroundTerm = function(t) {
            if (t instanceof Var) return false;
            if (t instanceof Blank) return false;
            if (t instanceof OpenListTerm) return false;
            if (t instanceof ListTerm) return t.elems.every(isStrictGroundTerm);
            if (t instanceof GraphTerm) return t.triples.every(isStrictGroundTriple);
            return true;
          }, isStrictGroundTriple = function(tr) {
            return isStrictGroundTerm(tr.s) && isStrictGroundTerm(tr.p) && isStrictGroundTerm(tr.o);
          };
          const r2 = forwardRules[i];
          const empty = {};
          const visited = [];
          const headIsStrictGround = !r2.isFuse && (!r2.headBlankLabels || r2.headBlankLabels.size === 0) && r2.conclusion.every(isStrictGroundTriple);
          if (headIsStrictGround) {
            let allKnown = true;
            for (const tr of r2.conclusion) {
              if (!hasFactIndexed(facts, tr)) {
                allKnown = false;
                break;
              }
            }
            if (allKnown) continue;
          }
          const maxSols = r2.isFuse || headIsStrictGround ? 1 : void 0;
          const sols = proveGoals(r2.premise.slice(), empty, facts, backRules, 0, visited, varGen, maxSols);
          if (r2.isFuse && sols.length) {
            console.log("# Inference fuse triggered: a { ... } => false. rule fired.");
            process.exit(2);
          }
          for (const s of sols) {
            const skMap = {};
            const instantiatedPremises = r2.premise.map((b) => applySubstTriple(b, s));
            const fireKey = firingKey(i, instantiatedPremises);
            for (const cpat of r2.conclusion) {
              const instantiated = applySubstTriple(cpat, s);
              const isFwRuleTriple = isLogImplies(instantiated.p) && (instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm || instantiated.s instanceof Literal && instantiated.s.value === "true" && instantiated.o instanceof GraphTerm || instantiated.s instanceof GraphTerm && instantiated.o instanceof Literal && instantiated.o.value === "true");
              const isBwRuleTriple = isLogImpliedBy(instantiated.p) && (instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm || instantiated.s instanceof GraphTerm && instantiated.o instanceof Literal && instantiated.o.value === "true" || instantiated.s instanceof Literal && instantiated.s.value === "true" && instantiated.o instanceof GraphTerm);
              if (isFwRuleTriple || isBwRuleTriple) {
                if (!hasFactIndexed(facts, instantiated)) {
                  factList.push(instantiated);
                  pushFactIndexed(facts, instantiated);
                  const df2 = new DerivedFact(instantiated, r2, instantiatedPremises.slice(), { ...s });
                  derivedForward.push(df2);
                  if (typeof onDerived === "function") onDerived(df2);
                  changed = true;
                }
                const left = instantiated.s instanceof GraphTerm ? instantiated.s.triples : instantiated.s instanceof Literal && instantiated.s.value === "true" ? [] : null;
                const right = instantiated.o instanceof GraphTerm ? instantiated.o.triples : instantiated.o instanceof Literal && instantiated.o.value === "true" ? [] : null;
                if (left !== null && right !== null) {
                  if (isFwRuleTriple) {
                    const [premise0, conclusion] = liftBlankRuleVars(left, right);
                    const premise = reorderPremiseForConstraints(premise0);
                    const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                    const newRule = new Rule(premise, conclusion, true, false, headBlankLabels);
                    const already = forwardRules.some(
                      (rr) => rr.isForward === newRule.isForward && rr.isFuse === newRule.isFuse && triplesListEqual(rr.premise, newRule.premise) && triplesListEqual(rr.conclusion, newRule.conclusion)
                    );
                    if (!already) forwardRules.push(newRule);
                  } else if (isBwRuleTriple) {
                    const [premise, conclusion] = liftBlankRuleVars(right, left);
                    const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                    const newRule = new Rule(premise, conclusion, false, false, headBlankLabels);
                    const already = backRules.some(
                      (rr) => rr.isForward === newRule.isForward && rr.isFuse === newRule.isFuse && triplesListEqual(rr.premise, newRule.premise) && triplesListEqual(rr.conclusion, newRule.conclusion)
                    );
                    if (!already) {
                      backRules.push(newRule);
                      indexBackRule(backRules, newRule);
                    }
                  }
                }
                continue;
              }
              const inst = skolemizeTripleForHeadBlanks(
                instantiated,
                r2.headBlankLabels,
                skMap,
                skCounter,
                fireKey,
                headSkolemCache
              );
              if (!isGroundTriple(inst)) continue;
              if (hasFactIndexed(facts, inst)) continue;
              factList.push(inst);
              pushFactIndexed(facts, inst);
              const df = new DerivedFact(inst, r2, instantiatedPremises.slice(), {
                ...s
              });
              derivedForward.push(df);
              if (typeof onDerived === "function") onDerived(df);
              changed = true;
            }
          }
        }
        if (!changed) break;
        anyChange = true;
      }
      return anyChange;
    }
    while (true) {
      setScopedSnapshot(null, 0);
      const changedA = runFixpoint();
      scopedClosureLevel += 1;
      const snap = makeScopedSnapshot();
      setScopedSnapshot(snap, scopedClosureLevel);
      const changedB = runFixpoint();
      maxScopedClosurePriorityNeeded = Math.max(maxScopedClosurePriorityNeeded, computeMaxScopedClosurePriorityNeeded());
      if (!changedA && !changedB && scopedClosureLevel >= maxScopedClosurePriorityNeeded) break;
    }
    setScopedSnapshot(null, 0);
    return derivedForward;
  }
  var version, nodeCrypto, RDF_NS, RDFS_NS, OWL_NS, XSD_NS, CRYPTO_NS, MATH_NS, TIME_NS, LIST_NS, LOG_NS, STRING_NS, SKOLEM_NS, RDF_JSON_DT, skolemCache, __literalPartsCache, __parseNumCache, __parseIntCache, __parseNumericInfoCache, jsonPointerCache, __logContentCache, __logSemanticsCache, __logSemanticsOrErrorCache, __logConclusionCache, enforceHttpsEnabled, __IS_NODE, proofCommentsEnabled, superRestrictedMode, __tracePrefixes, __traceDefaultPrefixes, __traceTermFormatter, __n3Lex, __N3ParserCtor, fixedNowLex, runNowLex, runLocalTimeCache, Term, Iri, Literal, Var, __iriIntern, __literalIntern, Blank, ListTerm, OpenListTerm, GraphTerm, Triple, Rule, DerivedFact, XSD_DECIMAL_DT, XSD_DOUBLE_DT, XSD_FLOAT_DT, XSD_INTEGER_DT, XSD_INTEGER_DERIVED_DTS;
  var init_reasoner = __esm({
    "src/reasoner.ts"() {
      "use strict";
      version = "dev";
      try {
        if (typeof __require === "function") version = __require("./package.json").version || version;
      } catch (_) {
      }
      nodeCrypto = null;
      try {
        if (typeof __require === "function") nodeCrypto = __require("crypto");
      } catch (_) {
      }
      RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
      RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
      OWL_NS = "http://www.w3.org/2002/07/owl#";
      XSD_NS = "http://www.w3.org/2001/XMLSchema#";
      CRYPTO_NS = "http://www.w3.org/2000/10/swap/crypto#";
      MATH_NS = "http://www.w3.org/2000/10/swap/math#";
      TIME_NS = "http://www.w3.org/2000/10/swap/time#";
      LIST_NS = "http://www.w3.org/2000/10/swap/list#";
      LOG_NS = "http://www.w3.org/2000/10/swap/log#";
      STRING_NS = "http://www.w3.org/2000/10/swap/string#";
      SKOLEM_NS = "https://eyereasoner.github.io/.well-known/genid/";
      RDF_JSON_DT = RDF_NS + "JSON";
      skolemCache = /* @__PURE__ */ new Map();
      __literalPartsCache = /* @__PURE__ */ new Map();
      __parseNumCache = /* @__PURE__ */ new Map();
      __parseIntCache = /* @__PURE__ */ new Map();
      __parseNumericInfoCache = /* @__PURE__ */ new Map();
      jsonPointerCache = /* @__PURE__ */ new Map();
      __logContentCache = /* @__PURE__ */ new Map();
      __logSemanticsCache = /* @__PURE__ */ new Map();
      __logSemanticsOrErrorCache = /* @__PURE__ */ new Map();
      __logConclusionCache = /* @__PURE__ */ new WeakMap();
      enforceHttpsEnabled = false;
      __IS_NODE = typeof process !== "undefined" && !!(process.versions && process.versions.node);
      proofCommentsEnabled = false;
      superRestrictedMode = false;
      __tracePrefixes = null;
      __traceDefaultPrefixes = null;
      __traceTermFormatter = null;
      __n3Lex = null;
      __N3ParserCtor = null;
      fixedNowLex = null;
      runNowLex = null;
      runLocalTimeCache = null;
      Term = class {
      };
      Iri = class extends Term {
        constructor(value) {
          super();
          this.value = value;
        }
      };
      Literal = class extends Term {
        constructor(value) {
          super();
          this.value = value;
        }
      };
      Var = class extends Term {
        constructor(name) {
          super();
          this.name = name;
        }
      };
      __iriIntern = /* @__PURE__ */ new Map();
      __literalIntern = /* @__PURE__ */ new Map();
      Blank = class extends Term {
        constructor(label) {
          super();
          this.label = label;
        }
      };
      ListTerm = class extends Term {
        constructor(elems) {
          super();
          this.elems = elems;
        }
      };
      OpenListTerm = class extends Term {
        constructor(prefix, tailVar) {
          super();
          this.prefix = prefix;
          this.tailVar = tailVar;
        }
      };
      GraphTerm = class extends Term {
        constructor(triples) {
          super();
          this.triples = triples;
        }
      };
      Triple = class {
        constructor(s, p, o) {
          this.s = s;
          this.p = p;
          this.o = o;
        }
      };
      Rule = class {
        constructor(premise, conclusion, isForward, isFuse, headBlankLabels) {
          this.premise = premise;
          this.conclusion = conclusion;
          this.isForward = isForward;
          this.isFuse = isFuse;
          this.headBlankLabels = headBlankLabels || /* @__PURE__ */ new Set();
        }
      };
      DerivedFact = class {
        constructor(fact, rule, premises, subst) {
          this.fact = fact;
          this.rule = rule;
          this.premises = premises;
          this.subst = subst;
        }
      };
      XSD_DECIMAL_DT = XSD_NS + "decimal";
      XSD_DOUBLE_DT = XSD_NS + "double";
      XSD_FLOAT_DT = XSD_NS + "float";
      XSD_INTEGER_DT = XSD_NS + "integer";
      XSD_INTEGER_DERIVED_DTS = /* @__PURE__ */ new Set([
        XSD_INTEGER_DT,
        XSD_NS + "nonPositiveInteger",
        XSD_NS + "negativeInteger",
        XSD_NS + "long",
        XSD_NS + "int",
        XSD_NS + "short",
        XSD_NS + "byte",
        XSD_NS + "nonNegativeInteger",
        XSD_NS + "unsignedLong",
        XSD_NS + "unsignedInt",
        XSD_NS + "unsignedShort",
        XSD_NS + "unsignedByte",
        XSD_NS + "positiveInteger"
      ]);
    }
  });

  // src/n3_input.ts
  function resolveIriRef(ref, base) {
    if (!base) return ref;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref;
    try {
      return new URL(ref, base).toString();
    } catch {
      return ref;
    }
  }
  function isWs(c) {
    return /\s/.test(c);
  }
  function isNameChar(c) {
    return /[0-9A-Za-z_\-:]/.test(c);
  }
  function lex(inputText) {
    const chars = Array.from(inputText);
    const n = chars.length;
    let i = 0;
    const tokens = [];
    function peek(offset = 0) {
      const j = i + offset;
      return j >= 0 && j < n ? chars[j] : null;
    }
    while (i < n) {
      let c = peek();
      if (c === null) break;
      if (isWs(c)) {
        i++;
        continue;
      }
      if (c === "#") {
        while (i < n && chars[i] !== "\n" && chars[i] !== "\r") i++;
        continue;
      }
      if (c === "=") {
        if (peek(1) === ">") {
          tokens.push(new Token("OpImplies", null, i));
          i += 2;
          continue;
        } else {
          tokens.push(new Token("Equals", null, i));
          i += 1;
          continue;
        }
      }
      if (c === "<") {
        if (peek(1) === "=") {
          tokens.push(new Token("OpImpliedBy", null, i));
          i += 2;
          continue;
        }
        if (peek(1) === "-") {
          tokens.push(new Token("OpPredInvert", null, i));
          i += 2;
          continue;
        }
        const start2 = i;
        i++;
        const iriChars = [];
        while (i < n && chars[i] !== ">") {
          iriChars.push(chars[i]);
          i++;
        }
        if (i >= n || chars[i] !== ">") {
          throw new N3SyntaxError("Unterminated IRI <...>", start2);
        }
        i++;
        const iri = iriChars.join("");
        tokens.push(new Token("IriRef", iri, start2));
        continue;
      }
      if (c === "!") {
        tokens.push(new Token("OpPathFwd", null, i));
        i += 1;
        continue;
      }
      if (c === "^") {
        if (peek(1) === "^") {
          tokens.push(new Token("HatHat", null, i));
          i += 2;
          continue;
        }
        tokens.push(new Token("OpPathRev", null, i));
        i += 1;
        continue;
      }
      if ("{}()[];,.".includes(c)) {
        const mapping = {
          "{": "LBrace",
          "}": "RBrace",
          "(": "LParen",
          ")": "RParen",
          "[": "LBracket",
          "]": "RBracket",
          ";": "Semicolon",
          ",": "Comma",
          ".": "Dot"
        };
        tokens.push(new Token(mapping[c], null, i));
        i++;
        continue;
      }
      if (c === '"') {
        const start2 = i;
        if (peek(1) === '"' && peek(2) === '"') {
          i += 3;
          const sChars2 = [];
          let closed = false;
          while (i < n) {
            const cc2 = chars[i];
            if (cc2 === "\\") {
              i++;
              if (i < n) {
                const esc = chars[i];
                i++;
                sChars2.push("\\");
                sChars2.push(esc);
              } else {
                sChars2.push("\\");
              }
              continue;
            }
            if (cc2 === '"') {
              let run = 0;
              while (i + run < n && chars[i + run] === '"') run++;
              if (run >= 3) {
                for (let k = 0; k < run - 3; k++) sChars2.push('"');
                i += run;
                closed = true;
                break;
              }
              for (let k = 0; k < run; k++) sChars2.push('"');
              i += run;
              continue;
            }
            sChars2.push(cc2);
            i++;
          }
          if (!closed) throw new N3SyntaxError('Unterminated long string literal """..."""', start2);
          const raw2 = '"""' + sChars2.join("") + '"""';
          const decoded2 = decodeN3StringEscapes(stripQuotes(raw2));
          const s2 = JSON.stringify(decoded2);
          tokens.push(new Token("Literal", s2, start2));
          continue;
        }
        i++;
        const sChars = [];
        while (i < n) {
          let cc2 = chars[i];
          i++;
          if (cc2 === "\\") {
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push("\\");
              sChars.push(esc);
            }
            continue;
          }
          if (cc2 === '"') break;
          sChars.push(cc2);
        }
        const raw = '"' + sChars.join("") + '"';
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded);
        tokens.push(new Token("Literal", s, start2));
        continue;
      }
      if (c === "'") {
        const start2 = i;
        if (peek(1) === "'" && peek(2) === "'") {
          i += 3;
          const sChars2 = [];
          let closed = false;
          while (i < n) {
            const cc2 = chars[i];
            if (cc2 === "\\") {
              i++;
              if (i < n) {
                const esc = chars[i];
                i++;
                sChars2.push("\\");
                sChars2.push(esc);
              } else {
                sChars2.push("\\");
              }
              continue;
            }
            if (cc2 === "'") {
              let run = 0;
              while (i + run < n && chars[i + run] === "'") run++;
              if (run >= 3) {
                for (let k = 0; k < run - 3; k++) sChars2.push("'");
                i += run;
                closed = true;
                break;
              }
              for (let k = 0; k < run; k++) sChars2.push("'");
              i += run;
              continue;
            }
            sChars2.push(cc2);
            i++;
          }
          if (!closed) throw new N3SyntaxError("Unterminated long string literal '''...'''", start2);
          const raw2 = "'''" + sChars2.join("") + "'''";
          const decoded2 = decodeN3StringEscapes(stripQuotes(raw2));
          const s2 = JSON.stringify(decoded2);
          tokens.push(new Token("Literal", s2, start2));
          continue;
        }
        i++;
        const sChars = [];
        while (i < n) {
          let cc2 = chars[i];
          i++;
          if (cc2 === "\\") {
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push("\\");
              sChars.push(esc);
            }
            continue;
          }
          if (cc2 === "'") break;
          sChars.push(cc2);
        }
        const raw = "'" + sChars.join("") + "'";
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded);
        tokens.push(new Token("Literal", s, start2));
        continue;
      }
      if (c === "?") {
        const start2 = i;
        i++;
        const nameChars = [];
        let cc2;
        while ((cc2 = peek()) !== null && isNameChar(cc2)) {
          nameChars.push(cc2);
          i++;
        }
        const name = nameChars.join("");
        tokens.push(new Token("Var", name, start2));
        continue;
      }
      if (c === "@") {
        const start2 = i;
        const prevTok = tokens.length ? tokens[tokens.length - 1] : null;
        const prevWasQuotedLiteral = prevTok && prevTok.typ === "Literal" && typeof prevTok.value === "string" && prevTok.value.startsWith('"');
        i++;
        if (prevWasQuotedLiteral) {
          const tagChars = [];
          let cc3 = peek();
          if (cc3 === null || !/[A-Za-z]/.test(cc3)) {
            throw new N3SyntaxError("Invalid language tag (expected [A-Za-z] after '@')", start2);
          }
          while ((cc3 = peek()) !== null && /[A-Za-z]/.test(cc3)) {
            tagChars.push(cc3);
            i++;
          }
          while (peek() === "-") {
            tagChars.push("-");
            i++;
            const segChars = [];
            while ((cc3 = peek()) !== null && /[A-Za-z0-9]/.test(cc3)) {
              segChars.push(cc3);
              i++;
            }
            if (!segChars.length) {
              throw new N3SyntaxError("Invalid language tag (expected [A-Za-z0-9]+ after '-')", start2);
            }
            tagChars.push(...segChars);
          }
          tokens.push(new Token("LangTag", tagChars.join(""), start2));
          continue;
        }
        const wordChars2 = [];
        let cc2;
        while ((cc2 = peek()) !== null && /[A-Za-z]/.test(cc2)) {
          wordChars2.push(cc2);
          i++;
        }
        const word2 = wordChars2.join("");
        if (word2 === "prefix") tokens.push(new Token("AtPrefix", null, start2));
        else if (word2 === "base") tokens.push(new Token("AtBase", null, start2));
        else throw new N3SyntaxError(`Unknown directive @${word2}`, start2);
        continue;
      }
      if (/[0-9]/.test(c) || c === "-" && peek(1) !== null && /[0-9]/.test(peek(1))) {
        const start2 = i;
        const numChars = [c];
        i++;
        while (i < n) {
          const cc2 = chars[i];
          if (/[0-9]/.test(cc2)) {
            numChars.push(cc2);
            i++;
            continue;
          }
          if (cc2 === ".") {
            if (i + 1 < n && /[0-9]/.test(chars[i + 1])) {
              numChars.push(".");
              i++;
              continue;
            } else {
              break;
            }
          }
          break;
        }
        if (i < n && (chars[i] === "e" || chars[i] === "E")) {
          let j = i + 1;
          if (j < n && (chars[j] === "+" || chars[j] === "-")) j++;
          if (j < n && /[0-9]/.test(chars[j])) {
            numChars.push(chars[i]);
            i++;
            if (i < n && (chars[i] === "+" || chars[i] === "-")) {
              numChars.push(chars[i]);
              i++;
            }
            while (i < n && /[0-9]/.test(chars[i])) {
              numChars.push(chars[i]);
              i++;
            }
          }
        }
        tokens.push(new Token("Literal", numChars.join(""), start2));
        continue;
      }
      const start = i;
      const wordChars = [];
      let cc;
      while ((cc = peek()) !== null && isNameChar(cc)) {
        wordChars.push(cc);
        i++;
      }
      if (!wordChars.length) {
        throw new N3SyntaxError(`Unexpected char: ${JSON.stringify(c)}`, i);
      }
      const word = wordChars.join("");
      if (word === "true" || word === "false") {
        tokens.push(new Token("Literal", word, start));
      } else if ([...word].every((ch) => /[0-9.\-]/.test(ch))) {
        tokens.push(new Token("Literal", word, start));
      } else {
        tokens.push(new Token("Ident", word, start));
      }
    }
    tokens.push(new Token("EOF", null, n));
    return tokens;
  }
  function collectIrisInTerm(t) {
    const out = [];
    if (t instanceof Iri) {
      out.push(t.value);
    } else if (t instanceof Literal) {
      const [_lex, dt] = literalParts(t.value);
      if (dt) out.push(dt);
    } else if (t instanceof ListTerm) {
      for (const x of t.elems) out.push(...collectIrisInTerm(x));
    } else if (t instanceof OpenListTerm) {
      for (const x of t.prefix) out.push(...collectIrisInTerm(x));
    } else if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        out.push(...collectIrisInTerm(tr.s));
        out.push(...collectIrisInTerm(tr.p));
        out.push(...collectIrisInTerm(tr.o));
      }
    }
    return out;
  }
  function collectBlankLabelsInTerm2(t, acc) {
    if (t instanceof Blank) {
      acc.add(t.label);
    } else if (t instanceof ListTerm) {
      for (const x of t.elems) collectBlankLabelsInTerm2(x, acc);
    } else if (t instanceof OpenListTerm) {
      for (const x of t.prefix) collectBlankLabelsInTerm2(x, acc);
    } else if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        collectBlankLabelsInTerm2(tr.s, acc);
        collectBlankLabelsInTerm2(tr.p, acc);
        collectBlankLabelsInTerm2(tr.o, acc);
      }
    }
  }
  function collectBlankLabelsInTriples2(triples) {
    const acc = /* @__PURE__ */ new Set();
    for (const tr of triples) {
      collectBlankLabelsInTerm2(tr.s, acc);
      collectBlankLabelsInTerm2(tr.p, acc);
      collectBlankLabelsInTerm2(tr.o, acc);
    }
    return acc;
  }
  function materializeRdfLists(triples, forwardRules, backwardRules) {
    const RDF_FIRST = RDF_NS + "first";
    const RDF_REST = RDF_NS + "rest";
    const RDF_NIL = RDF_NS + "nil";
    function nodeKey(t) {
      if (t instanceof Blank) return "B:" + t.label;
      if (t instanceof Iri) return "I:" + t.value;
      return null;
    }
    const firstMap = /* @__PURE__ */ new Map();
    const restMap = /* @__PURE__ */ new Map();
    for (const tr of triples) {
      if (!(tr.p instanceof Iri)) continue;
      const k = nodeKey(tr.s);
      if (!k) continue;
      if (tr.p.value === RDF_FIRST) firstMap.set(k, tr.o);
      else if (tr.p.value === RDF_REST) restMap.set(k, tr.o);
    }
    if (!firstMap.size && !restMap.size) return;
    const cache = /* @__PURE__ */ new Map();
    const visiting = /* @__PURE__ */ new Set();
    function buildListForKey(k) {
      if (cache.has(k)) return cache.get(k);
      if (visiting.has(k)) return null;
      visiting.add(k);
      if (k === "I:" + RDF_NIL) {
        const empty = new ListTerm([]);
        cache.set(k, empty);
        visiting.delete(k);
        return empty;
      }
      const head = firstMap.get(k);
      const tail = restMap.get(k);
      if (head === void 0 || tail === void 0) {
        visiting.delete(k);
        return null;
      }
      const headTerm = rewriteTerm(head);
      let tailListElems = null;
      if (tail instanceof Iri && tail.value === RDF_NIL) {
        tailListElems = [];
      } else {
        const tk = nodeKey(tail);
        if (!tk) {
          visiting.delete(k);
          return null;
        }
        const tailList = buildListForKey(tk);
        if (!tailList) {
          visiting.delete(k);
          return null;
        }
        tailListElems = tailList.elems;
      }
      const out = new ListTerm([headTerm, ...tailListElems]);
      cache.set(k, out);
      visiting.delete(k);
      return out;
    }
    function rewriteTerm(t) {
      const k = nodeKey(t);
      if (k) {
        const built = buildListForKey(k);
        if (built) return built;
        if (t instanceof Iri && t.value === RDF_NIL) return new ListTerm([]);
        return t;
      }
      if (t instanceof ListTerm) {
        let changed = false;
        const elems = t.elems.map((e) => {
          const r2 = rewriteTerm(e);
          if (r2 !== e) changed = true;
          return r2;
        });
        return changed ? new ListTerm(elems) : t;
      }
      if (t instanceof OpenListTerm) {
        let changed = false;
        const prefix = t.prefix.map((e) => {
          const r2 = rewriteTerm(e);
          if (r2 !== e) changed = true;
          return r2;
        });
        return changed ? new OpenListTerm(prefix, t.tailVar) : t;
      }
      if (t instanceof GraphTerm) {
        for (const tr of t.triples) rewriteTriple(tr);
        return t;
      }
      return t;
    }
    function rewriteTriple(tr) {
      tr.s = rewriteTerm(tr.s);
      tr.p = rewriteTerm(tr.p);
      tr.o = rewriteTerm(tr.o);
    }
    for (const k of firstMap.keys()) buildListForKey(k);
    for (const tr of triples) rewriteTriple(tr);
    for (const r2 of forwardRules) {
      for (const tr of r2.premise) rewriteTriple(tr);
      for (const tr of r2.conclusion) rewriteTriple(tr);
    }
    for (const r2 of backwardRules) {
      for (const tr of r2.premise) rewriteTriple(tr);
      for (const tr of r2.conclusion) rewriteTriple(tr);
    }
  }
  var Token, N3SyntaxError, PrefixEnv, Parser;
  var init_n3_input = __esm({
    "src/n3_input.ts"() {
      init_reasoner();
      Token = class {
        constructor(typ, value = null, offset = null) {
          this.typ = typ;
          this.value = value;
          this.offset = offset;
        }
        toString() {
          const loc = typeof this.offset === "number" ? `@${this.offset}` : "";
          if (this.value == null) return `Token(${this.typ}${loc})`;
          return `Token(${this.typ}${loc}, ${JSON.stringify(this.value)})`;
        }
      };
      N3SyntaxError = class extends SyntaxError {
        constructor(message, offset = null) {
          super(message);
          this.name = "N3SyntaxError";
          this.offset = offset;
        }
      };
      PrefixEnv = class _PrefixEnv {
        constructor(map, baseIri) {
          this.map = map || {};
          this.baseIri = baseIri || "";
        }
        static newDefault() {
          const m = {};
          m["rdf"] = RDF_NS;
          m["rdfs"] = RDFS_NS;
          m["xsd"] = XSD_NS;
          m["log"] = LOG_NS;
          m["math"] = MATH_NS;
          m["string"] = STRING_NS;
          m["list"] = LIST_NS;
          m["time"] = TIME_NS;
          m["genid"] = SKOLEM_NS;
          m[""] = "";
          return new _PrefixEnv(m, "");
        }
        set(pref, base) {
          this.map[pref] = base;
        }
        setBase(baseIri) {
          this.baseIri = baseIri || "";
        }
        expandQName(q) {
          if (q.includes(":")) {
            const [p, local] = q.split(":", 2);
            const base = this.map[p] || "";
            if (base) return base + local;
            return q;
          }
          return q;
        }
        shrinkIri(iri) {
          let best = null;
          for (const [p2, base] of Object.entries(this.map)) {
            if (!base) continue;
            if (iri.startsWith(base)) {
              const local2 = iri.slice(base.length);
              if (!local2) continue;
              const cand = [p2, local2];
              if (best === null || cand[1].length < best[1].length) best = cand;
            }
          }
          if (best === null) return null;
          const [p, local] = best;
          if (p === "") return `:${local}`;
          return `${p}:${local}`;
        }
        prefixesUsedForOutput(triples) {
          const used = /* @__PURE__ */ new Set();
          for (const t of triples) {
            const iris = [];
            iris.push(...collectIrisInTerm(t.s));
            if (!isRdfTypePred(t.p)) {
              iris.push(...collectIrisInTerm(t.p));
            }
            iris.push(...collectIrisInTerm(t.o));
            for (const iri of iris) {
              for (const [p, base] of Object.entries(this.map)) {
                if (base && iri.startsWith(base)) used.add(p);
              }
            }
          }
          const v = [];
          for (const p of used) {
            if (this.map.hasOwnProperty(p)) v.push([p, this.map[p]]);
          }
          v.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
          return v;
        }
      };
      Parser = class {
        constructor(tokens) {
          this.toks = tokens;
          this.pos = 0;
          this.prefixes = PrefixEnv.newDefault();
          this.blankCounter = 0;
          this.pendingTriples = [];
        }
        peek() {
          return this.toks[this.pos];
        }
        next() {
          const tok = this.toks[this.pos];
          this.pos += 1;
          return tok;
        }
        fail(message, tok = this.peek()) {
          const off = tok && typeof tok.offset === "number" ? tok.offset : null;
          throw new N3SyntaxError(message, off);
        }
        expectDot() {
          const tok = this.next();
          if (tok.typ !== "Dot") {
            this.fail(`Expected '.', got ${tok.toString()}`, tok);
          }
        }
        parseDocument() {
          const triples = [];
          const forwardRules = [];
          const backwardRules = [];
          while (this.peek().typ !== "EOF") {
            if (this.peek().typ === "AtPrefix") {
              this.next();
              this.parsePrefixDirective();
            } else if (this.peek().typ === "AtBase") {
              this.next();
              this.parseBaseDirective();
            } else if (
              // SPARQL-style/Turtle-style directives (case-insensitive, no trailing '.')
              this.peek().typ === "Ident" && typeof this.peek().value === "string" && this.peek().value.toLowerCase() === "prefix" && this.toks[this.pos + 1] && this.toks[this.pos + 1].typ === "Ident" && typeof this.toks[this.pos + 1].value === "string" && // Require PNAME_NS form (e.g., "ex:" or ":") to avoid clashing with a normal triple starting with IRI "prefix".
              this.toks[this.pos + 1].value.endsWith(":") && this.toks[this.pos + 2] && (this.toks[this.pos + 2].typ === "IriRef" || this.toks[this.pos + 2].typ === "Ident")
            ) {
              this.next();
              this.parseSparqlPrefixDirective();
            } else if (this.peek().typ === "Ident" && typeof this.peek().value === "string" && this.peek().value.toLowerCase() === "base" && this.toks[this.pos + 1] && // SPARQL BASE requires an IRIREF.
            this.toks[this.pos + 1].typ === "IriRef") {
              this.next();
              this.parseSparqlBaseDirective();
            } else {
              const first = this.parseTerm();
              if (this.peek().typ === "OpImplies") {
                this.next();
                const second = this.parseTerm();
                this.expectDot();
                forwardRules.push(this.makeRule(first, second, true));
              } else if (this.peek().typ === "OpImpliedBy") {
                this.next();
                const second = this.parseTerm();
                this.expectDot();
                backwardRules.push(this.makeRule(first, second, false));
              } else {
                let more;
                if (this.peek().typ === "Dot") {
                  more = [];
                  if (this.pendingTriples.length > 0) {
                    more = this.pendingTriples;
                    this.pendingTriples = [];
                  }
                  this.next();
                } else {
                  more = this.parsePredicateObjectList(first);
                  this.expectDot();
                }
                for (const tr of more) {
                  if (isLogImplies(tr.p) && tr.s instanceof GraphTerm && tr.o instanceof GraphTerm) {
                    forwardRules.push(this.makeRule(tr.s, tr.o, true));
                  } else if (isLogImpliedBy(tr.p) && tr.s instanceof GraphTerm && tr.o instanceof GraphTerm) {
                    backwardRules.push(this.makeRule(tr.s, tr.o, false));
                  } else {
                    triples.push(tr);
                  }
                }
              }
            }
          }
          return [this.prefixes, triples, forwardRules, backwardRules];
        }
        parsePrefixDirective() {
          const tok = this.next();
          if (tok.typ !== "Ident") {
            this.fail(`Expected prefix name, got ${tok.toString()}`, tok);
          }
          const pref = tok.value || "";
          const prefName = pref.endsWith(":") ? pref.slice(0, -1) : pref;
          if (this.peek().typ === "Dot") {
            this.next();
            if (!this.prefixes.map.hasOwnProperty(prefName)) {
              this.prefixes.set(prefName, "");
            }
            return;
          }
          const tok2 = this.next();
          let iri;
          if (tok2.typ === "IriRef") {
            iri = resolveIriRef(tok2.value || "", this.prefixes.baseIri || "");
          } else if (tok2.typ === "Ident") {
            iri = this.prefixes.expandQName(tok2.value || "");
          } else {
            this.fail(`Expected IRI after @prefix, got ${tok2.toString()}`, tok2);
          }
          this.expectDot();
          this.prefixes.set(prefName, iri);
        }
        parseBaseDirective() {
          const tok = this.next();
          let iri;
          if (tok.typ === "IriRef") {
            iri = resolveIriRef(tok.value || "", this.prefixes.baseIri || "");
          } else if (tok.typ === "Ident") {
            iri = tok.value || "";
          } else {
            this.fail(`Expected IRI after @base, got ${tok.toString()}`, tok);
          }
          this.expectDot();
          this.prefixes.setBase(iri);
        }
        parseSparqlPrefixDirective() {
          const tok = this.next();
          if (tok.typ !== "Ident") {
            this.fail(`Expected prefix name after PREFIX, got ${tok.toString()}`, tok);
          }
          const pref = tok.value || "";
          const prefName = pref.endsWith(":") ? pref.slice(0, -1) : pref;
          const tok2 = this.next();
          let iri;
          if (tok2.typ === "IriRef") {
            iri = resolveIriRef(tok2.value || "", this.prefixes.baseIri || "");
          } else if (tok2.typ === "Ident") {
            iri = this.prefixes.expandQName(tok2.value || "");
          } else {
            this.fail(`Expected IRI after PREFIX, got ${tok2.toString()}`, tok2);
          }
          if (this.peek().typ === "Dot") this.next();
          this.prefixes.set(prefName, iri);
        }
        parseSparqlBaseDirective() {
          const tok = this.next();
          let iri;
          if (tok.typ === "IriRef") {
            iri = resolveIriRef(tok.value || "", this.prefixes.baseIri || "");
          } else if (tok.typ === "Ident") {
            iri = tok.value || "";
          } else {
            this.fail(`Expected IRI after BASE, got ${tok.toString()}`, tok);
          }
          if (this.peek().typ === "Dot") this.next();
          this.prefixes.setBase(iri);
        }
        parseTerm() {
          let t = this.parsePathItem();
          while (this.peek().typ === "OpPathFwd" || this.peek().typ === "OpPathRev") {
            const dir = this.next().typ;
            const pred = this.parsePathItem();
            this.blankCounter += 1;
            const bn = new Blank(`_:b${this.blankCounter}`);
            this.pendingTriples.push(dir === "OpPathFwd" ? new Triple(t, pred, bn) : new Triple(bn, pred, t));
            t = bn;
          }
          return t;
        }
        parsePathItem() {
          const tok = this.next();
          const typ = tok.typ;
          const val = tok.value;
          if (typ === "Equals") {
            return internIri(OWL_NS + "sameAs");
          }
          if (typ === "IriRef") {
            const base = this.prefixes.baseIri || "";
            return internIri(resolveIriRef(val || "", base));
          }
          if (typ === "Ident") {
            const name = val || "";
            if (name === "a") {
              return internIri(RDF_NS + "type");
            } else if (name.startsWith("_:")) {
              return new Blank(name);
            } else if (name.includes(":")) {
              return internIri(this.prefixes.expandQName(name));
            } else {
              return internIri(name);
            }
          }
          if (typ === "Literal") {
            let s = val || "";
            if (this.peek().typ === "LangTag") {
              if (!(s.startsWith('"') && s.endsWith('"'))) {
                this.fail("Language tag is only allowed on quoted string literals", this.peek());
              }
              const langTok = this.next();
              const lang = langTok.value || "";
              s = `${s}@${lang}`;
              if (this.peek().typ === "HatHat") {
                this.fail("A literal cannot have both a language tag (@...) and a datatype (^^...)", this.peek());
              }
            }
            if (this.peek().typ === "HatHat") {
              this.next();
              const dtTok = this.next();
              let dtIri;
              if (dtTok.typ === "IriRef") {
                dtIri = dtTok.value || "";
              } else if (dtTok.typ === "Ident") {
                const qn = dtTok.value || "";
                if (qn.includes(":")) dtIri = this.prefixes.expandQName(qn);
                else dtIri = qn;
              } else {
                this.fail(`Expected datatype after ^^, got ${dtTok.toString()}`, dtTok);
              }
              s = `${s}^^<${dtIri}>`;
            }
            return internLiteral(s);
          }
          if (typ === "Var") return new Var(val || "");
          if (typ === "LParen") return this.parseList();
          if (typ === "LBracket") return this.parseBlank();
          if (typ === "LBrace") return this.parseGraph();
          this.fail(`Unexpected term token: ${tok.toString()}`, tok);
        }
        parseList() {
          const elems = [];
          while (this.peek().typ !== "RParen") {
            elems.push(this.parseTerm());
          }
          this.next();
          return new ListTerm(elems);
        }
        parseBlank() {
          if (this.peek().typ === "RBracket") {
            this.next();
            this.blankCounter += 1;
            return new Blank(`_:b${this.blankCounter}`);
          }
          if (this.peek().typ === "Ident" && (this.peek().value || "") === "id") {
            const iriTok = this.next();
            const iriTerm = this.parseTerm();
            if (iriTerm instanceof Blank && iriTerm.label.startsWith("_:")) {
              this.fail("Cannot use 'id' keyword with a blank node identifier inside [...]", iriTok);
            }
            if (this.peek().typ === "Semicolon") this.next();
            if (this.peek().typ === "RBracket") {
              this.next();
              return iriTerm;
            }
            const subj2 = iriTerm;
            while (true) {
              let pred;
              let invert = false;
              if (this.peek().typ === "Ident" && (this.peek().value || "") === "a") {
                this.next();
                pred = internIri(RDF_NS + "type");
              } else if (this.peek().typ === "OpPredInvert") {
                this.next();
                pred = this.parseTerm();
                invert = true;
              } else {
                pred = this.parseTerm();
              }
              const objs = [this.parseTerm()];
              while (this.peek().typ === "Comma") {
                this.next();
                objs.push(this.parseTerm());
              }
              for (const o of objs) {
                this.pendingTriples.push(invert ? new Triple(o, pred, subj2) : new Triple(subj2, pred, o));
              }
              if (this.peek().typ === "Semicolon") {
                this.next();
                if (this.peek().typ === "RBracket") break;
                continue;
              }
              break;
            }
            if (this.peek().typ !== "RBracket") {
              this.fail(`Expected ']' at end of IRI property list, got ${this.peek().toString()}`);
            }
            this.next();
            return iriTerm;
          }
          this.blankCounter += 1;
          const id = `_:b${this.blankCounter}`;
          const subj = new Blank(id);
          while (true) {
            let pred;
            let invert = false;
            if (this.peek().typ === "Ident" && (this.peek().value || "") === "a") {
              this.next();
              pred = internIri(RDF_NS + "type");
            } else if (this.peek().typ === "OpPredInvert") {
              this.next();
              pred = this.parseTerm();
              invert = true;
            } else {
              pred = this.parseTerm();
            }
            const objs = [this.parseTerm()];
            while (this.peek().typ === "Comma") {
              this.next();
              objs.push(this.parseTerm());
            }
            for (const o of objs) {
              this.pendingTriples.push(invert ? new Triple(o, pred, subj) : new Triple(subj, pred, o));
            }
            if (this.peek().typ === "Semicolon") {
              this.next();
              if (this.peek().typ === "RBracket") break;
              continue;
            }
            break;
          }
          if (this.peek().typ === "RBracket") {
            this.next();
          } else {
            this.fail(`Expected ']' at end of blank node property list, got ${this.peek().toString()}`);
          }
          return new Blank(id);
        }
        parseGraph() {
          const triples = [];
          while (this.peek().typ !== "RBrace") {
            const left = this.parseTerm();
            if (this.peek().typ === "OpImplies") {
              this.next();
              const right = this.parseTerm();
              const pred = internIri(LOG_NS + "implies");
              triples.push(new Triple(left, pred, right));
              if (this.peek().typ === "Dot") this.next();
              else if (this.peek().typ === "RBrace") {
              } else {
                this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
              }
            } else if (this.peek().typ === "OpImpliedBy") {
              this.next();
              const right = this.parseTerm();
              const pred = internIri(LOG_NS + "impliedBy");
              triples.push(new Triple(left, pred, right));
              if (this.peek().typ === "Dot") this.next();
              else if (this.peek().typ === "RBrace") {
              } else {
                this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
              }
            } else {
              if (this.peek().typ === "Dot" || this.peek().typ === "RBrace") {
                if (this.pendingTriples.length > 0) {
                  triples.push(...this.pendingTriples);
                  this.pendingTriples = [];
                }
                if (this.peek().typ === "Dot") this.next();
                continue;
              }
              triples.push(...this.parsePredicateObjectList(left));
              if (this.peek().typ === "Dot") this.next();
              else if (this.peek().typ === "RBrace") {
              } else {
                this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
              }
            }
          }
          this.next();
          return new GraphTerm(triples);
        }
        parsePredicateObjectList(subject) {
          const out = [];
          if (this.pendingTriples.length > 0) {
            out.push(...this.pendingTriples);
            this.pendingTriples = [];
          }
          while (true) {
            let verb;
            let invert = false;
            if (this.peek().typ === "Ident" && (this.peek().value || "") === "a") {
              this.next();
              verb = internIri(RDF_NS + "type");
            } else if (this.peek().typ === "Ident" && (this.peek().value || "") === "has") {
              this.next();
              verb = this.parseTerm();
            } else if (this.peek().typ === "Ident" && (this.peek().value || "") === "is") {
              this.next();
              verb = this.parseTerm();
              if (!(this.peek().typ === "Ident" && (this.peek().value || "") === "of")) {
                this.fail(`Expected 'of' after 'is <expr>', got ${this.peek().toString()}`);
              }
              this.next();
              invert = true;
            } else if (this.peek().typ === "OpPredInvert") {
              this.next();
              verb = this.parseTerm();
              invert = true;
            } else {
              verb = this.parseTerm();
            }
            const objects = this.parseObjectList();
            if (this.pendingTriples.length > 0) {
              out.push(...this.pendingTriples);
              this.pendingTriples = [];
            }
            for (const o of objects) {
              out.push(new Triple(invert ? o : subject, verb, invert ? subject : o));
            }
            if (this.peek().typ === "Semicolon") {
              this.next();
              if (this.peek().typ === "Dot") break;
              continue;
            }
            break;
          }
          return out;
        }
        parseObjectList() {
          const objs = [this.parseTerm()];
          while (this.peek().typ === "Comma") {
            this.next();
            objs.push(this.parseTerm());
          }
          return objs;
        }
        makeRule(left, right, isForward) {
          let premiseTerm, conclTerm;
          if (isForward) {
            premiseTerm = left;
            conclTerm = right;
          } else {
            premiseTerm = right;
            conclTerm = left;
          }
          let isFuse = false;
          if (isForward) {
            if (conclTerm instanceof Literal && conclTerm.value === "false") {
              isFuse = true;
            }
          }
          let rawPremise;
          if (premiseTerm instanceof GraphTerm) {
            rawPremise = premiseTerm.triples;
          } else if (premiseTerm instanceof Literal && premiseTerm.value === "true") {
            rawPremise = [];
          } else {
            rawPremise = [];
          }
          let rawConclusion;
          if (conclTerm instanceof GraphTerm) {
            rawConclusion = conclTerm.triples;
          } else if (conclTerm instanceof Literal && conclTerm.value === "false") {
            rawConclusion = [];
          } else {
            rawConclusion = [];
          }
          const headBlankLabels = collectBlankLabelsInTriples2(rawConclusion);
          const [premise0, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);
          const premise = isForward ? reorderPremiseForConstraints(premise0) : premise0;
          return new Rule(premise, conclusion, isForward, isFuse, headBlankLabels);
        }
      };
    }
  });

  // src/n3_output.ts
  function termToN3(t, pref) {
    if (t instanceof Iri) {
      const i = t.value;
      const q = pref.shrinkIri(i);
      if (q !== null) return q;
      if (i.startsWith("_:")) return i;
      return `<${i}>`;
    }
    if (t instanceof Literal) {
      const [lex2, dt] = literalParts2(t.value);
      if (dt === XSD_NS + "boolean") {
        const v = stripQuotes(lex2);
        if (v === "true" || v === "false") return v;
        if (v === "1") return "true";
        if (v === "0") return "false";
      }
      if (!dt) return t.value;
      const qdt = pref.shrinkIri(dt);
      if (qdt !== null) return `${lex2}^^${qdt}`;
      return `${lex2}^^<${dt}>`;
    }
    if (t instanceof Var) return `?${t.name}`;
    if (t instanceof Blank) return t.label;
    if (t instanceof ListTerm) {
      const inside = t.elems.map((e) => termToN3(e, pref));
      return "(" + inside.join(" ") + ")";
    }
    if (t instanceof OpenListTerm) {
      const inside = t.prefix.map((e) => termToN3(e, pref));
      inside.push("?" + t.tailVar);
      return "(" + inside.join(" ") + ")";
    }
    if (t instanceof GraphTerm) {
      const indent = "    ";
      const indentBlock = (str) => str.split(/\r?\n/).map((ln) => ln.length ? indent + ln : ln).join("\n");
      let s = "{\n";
      for (const tr of t.triples) {
        const block = tripleToN3(tr, pref).trimEnd();
        if (block) s += indentBlock(block) + "\n";
      }
      s += "}";
      return s;
    }
    return JSON.stringify(t);
  }
  function tripleToN3(tr, prefixes) {
    if (isLogImplies(tr.p)) {
      const s2 = termToN3(tr.s, prefixes);
      const o2 = termToN3(tr.o, prefixes);
      return `${s2} => ${o2} .`;
    }
    if (isLogImpliedBy(tr.p)) {
      const s2 = termToN3(tr.s, prefixes);
      const o2 = termToN3(tr.o, prefixes);
      return `${s2} <= ${o2} .`;
    }
    const s = termToN3(tr.s, prefixes);
    const p = isRdfTypePred(tr.p) ? "a" : isOwlSameAsPred(tr.p) ? "=" : termToN3(tr.p, prefixes);
    const o = termToN3(tr.o, prefixes);
    return `${s} ${p} ${o} .`;
  }
  function printExplanation(df, prefixes) {
    console.log("# ----------------------------------------------------------------------");
    console.log("# Proof for derived triple:");
    for (const line of tripleToN3(df.fact, prefixes).split(/\r?\n/)) {
      const stripped = line.replace(/\s+$/, "");
      if (stripped) {
        console.log("#   " + stripped);
      }
    }
    if (!df.premises.length) {
      console.log("# This triple is the head of a forward rule with an empty premise,");
      console.log("# so it holds unconditionally whenever the program is loaded.");
    } else {
      console.log("# It holds because the following instance of the rule body is provable:");
      for (const prem of df.premises) {
        for (const line of tripleToN3(prem, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, "");
          if (stripped) {
            console.log("#   " + stripped);
          }
        }
      }
      console.log("# via the schematic forward rule:");
      console.log("#   {");
      for (const tr of df.rule.premise) {
        for (const line of tripleToN3(tr, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, "");
          if (stripped) {
            console.log("#     " + stripped);
          }
        }
      }
      console.log("#   } => {");
      for (const tr of df.rule.conclusion) {
        for (const line of tripleToN3(tr, prefixes).split(/\r?\n/)) {
          const stripped = line.replace(/\s+$/, "");
          if (stripped) {
            console.log("#     " + stripped);
          }
        }
      }
      console.log("#   } .");
    }
    const ruleVars = varsInRule(df.rule);
    const visibleNames = Object.keys(df.subst).filter((name) => ruleVars.has(name)).sort();
    if (visibleNames.length) {
      console.log("# with substitution (on rule variables):");
      for (const v of visibleNames) {
        const fullTerm = applySubstTerm(new Var(v), df.subst);
        const rendered = termToN3(fullTerm, prefixes);
        const lines = rendered.split(/\r?\n/);
        if (lines.length === 1) {
          const stripped = lines[0].replace(/\s+$/, "");
          if (stripped) {
            console.log("#   ?" + v + " = " + stripped);
          }
        } else {
          const first = lines[0].trimEnd();
          if (first) {
            console.log("#   ?" + v + " = " + first);
          }
          for (let i = 1; i < lines.length; i++) {
            const stripped = lines[i].trim();
            if (!stripped) continue;
            if (i === lines.length - 1) {
              console.log("#   " + stripped);
            } else {
              console.log("#     " + stripped);
            }
          }
        }
      }
    }
    console.log("# Therefore the derived triple above is entailed by the rules and facts.");
    console.log("# ----------------------------------------------------------------------\n");
  }
  function offsetToLineCol(text, offset) {
    const chars = Array.from(text);
    const n = Math.max(0, Math.min(typeof offset === "number" ? offset : 0, chars.length));
    let line = 1;
    let col = 1;
    for (let i = 0; i < n; i++) {
      const c = chars[i];
      if (c === "\n") {
        line++;
        col = 1;
      } else if (c === "\r") {
        line++;
        col = 1;
        if (i + 1 < n && chars[i + 1] === "\n") i++;
      } else {
        col++;
      }
    }
    return { line, col };
  }
  function formatN3SyntaxError(err, text, path2) {
    const off = err && typeof err.offset === "number" ? err.offset : null;
    const label = path2 ? String(path2) : "<input>";
    if (off === null) {
      return `Syntax error in ${label}: ${err && err.message ? err.message : String(err)}`;
    }
    const { line, col } = offsetToLineCol(text, off);
    const lines = String(text).split(/\r\n|\n|\r/);
    const lineText = lines[line - 1] ?? "";
    const caret = " ".repeat(Math.max(0, col - 1)) + "^";
    return `Syntax error in ${label}:${line}:${col}: ${err.message}
${lineText}
${caret}`;
  }
  function __compareOutputStringKeys(a, b, prefixes) {
    const aNum = parseNumericLiteralInfo(a);
    const bNum = parseNumericLiteralInfo(b);
    if (aNum && bNum) {
      if (aNum.kind === "bigint" && bNum.kind === "bigint") {
        if (aNum.value < bNum.value) return -1;
        if (aNum.value > bNum.value) return 1;
        return 0;
      }
      const av = Number(aNum.value);
      const bv = Number(bNum.value);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    }
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    if (a instanceof Literal && b instanceof Literal) {
      const [alex] = literalParts2(a.value);
      const [blex] = literalParts2(b.value);
      if (alex < blex) return -1;
      if (alex > blex) return 1;
      return 0;
    }
    if (a instanceof Literal && !(b instanceof Literal)) return -1;
    if (!(a instanceof Literal) && b instanceof Literal) return 1;
    if (a instanceof Iri && b instanceof Iri) {
      if (a.value < b.value) return -1;
      if (a.value > b.value) return 1;
      return 0;
    }
    if (a instanceof Iri && !(b instanceof Iri)) return -1;
    if (!(a instanceof Iri) && b instanceof Iri) return 1;
    if (a instanceof Blank && b instanceof Blank) {
      if (a.label < b.label) return -1;
      if (a.label > b.label) return 1;
      return 0;
    }
    if (a instanceof Blank && !(b instanceof Blank)) return -1;
    if (!(a instanceof Blank) && b instanceof Blank) return 1;
    const ak = skolemKeyFromTerm(a);
    const bk = skolemKeyFromTerm(b);
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return 0;
  }
  function collectOutputStringsFromFacts(facts, prefixes) {
    const pairs = [];
    for (const tr of facts) {
      if (!(tr && tr.p instanceof Iri)) continue;
      if (tr.p.value !== LOG_NS + "outputString") continue;
      if (!(tr.o instanceof Literal)) continue;
      const s = termToJsString(tr.o);
      if (s === null) continue;
      pairs.push({ key: tr.s, text: s, idx: pairs.length });
    }
    pairs.sort((a, b) => {
      const c = __compareOutputStringKeys(a.key, b.key, prefixes);
      if (c !== 0) return c;
      return a.idx - b.idx;
    });
    return pairs.map((p) => p.text).join("");
  }
  var init_n3_output = __esm({
    "src/n3_output.ts"() {
      init_reasoner();
    }
  });

  // src/eyeling.ts
  var require_eyeling = __commonJS({
    "src/eyeling.ts"(exports) {
      init_n3_input();
      init_reasoner();
      init_n3_output();
      installN3Input(lex, Parser);
      installTraceFormatting(termToN3, PrefixEnv.newDefault());
      function reasonStream(n3Text, opts = {}) {
        const {
          baseIri = null,
          proof = false,
          onDerived = null,
          includeInputFactsInClosure = true,
          enforceHttps = false
        } = opts;
        const __oldEnforceHttps = getEnforceHttpsEnabled();
        setEnforceHttpsEnabled(!!enforceHttps);
        setProofCommentsEnabled(!!proof);
        const toks = lex(n3Text);
        const parser = new Parser(toks);
        if (baseIri) parser.prefixes.setBase(baseIri);
        let prefixes, triples, frules, brules;
        [prefixes, triples, frules, brules] = parser.parseDocument();
        setTracePrefixes(prefixes);
        materializeRdfLists(triples, frules, brules);
        const facts = triples.filter((tr) => isGroundTriple(tr));
        const derived = forwardChain(facts, frules, brules, (df) => {
          if (typeof onDerived === "function") {
            onDerived({
              triple: tripleToN3(df.fact, prefixes),
              df
            });
          }
        });
        const derivedTriples = derived.map((d) => d.fact);
        const closureTriples = includeInputFactsInClosure ? facts : derivedTriples;
        const __out = {
          prefixes,
          facts,
          derived,
          closureN3: closureTriples.map((t) => tripleToN3(t, prefixes)).join("\n")
        };
        setEnforceHttpsEnabled(__oldEnforceHttps);
        return __out;
      }
      var EYELING_API = {
        // Primary supported surface
        reasonStream,
        // Compatibility / “internals” used by demo.html
        lex,
        Parser,
        forwardChain,
        materializeRdfLists,
        PrefixEnv,
        version
      };
      try {
        if (typeof exports === "object" && exports) {
          Object.assign(exports, EYELING_API);
          exports.default = EYELING_API;
        }
      } catch (_) {
      }
      try {
        if (typeof self !== "undefined") self.eyeling = EYELING_API;
      } catch (_) {
      }
      function main() {
        setProofCommentsEnabled(false);
        const argvRaw = process.argv.slice(2);
        const argv = [];
        for (const a of argvRaw) {
          if (a === "-" || !a.startsWith("-") || a.startsWith("--") || a.length === 2) {
            argv.push(a);
            continue;
          }
          for (const ch of a.slice(1)) argv.push("-" + ch);
        }
        const prog = String(process.argv[1] || "eyeling").split(/[\/]/).pop();
        function printHelp(toStderr = false) {
          const msg = `Usage: ${prog} [options] <file.n3>

Options:
  -a, --ast               Print parsed AST as JSON and exit.
  -e, --enforce-https     Rewrite http:// IRIs to https:// for log dereferencing builtins.
  -h, --help              Show this help and exit.
  -p, --proof-comments    Enable proof explanations.
  -r, --strings           Print log:outputString strings (ordered by key) instead of N3 output.
  -s, --super-restricted  Disable all builtins except => and <=.
  -t, --stream            Stream derived triples as soon as they are derived.
  -v, --version           Print version and exit.
`;
          (toStderr ? console.error : console.log)(msg);
        }
        if (argv.includes("--help") || argv.includes("-h")) {
          printHelp(false);
          process.exit(0);
        }
        if (argv.includes("--version") || argv.includes("-v")) {
          console.log(`eyeling v${version}`);
          process.exit(0);
        }
        const showAst = argv.includes("--ast") || argv.includes("-a");
        const outputStringsMode = argv.includes("--strings") || argv.includes("-r");
        const streamMode = argv.includes("--stream") || argv.includes("-t");
        if (argv.includes("--enforce-https") || argv.includes("-e")) {
          setEnforceHttpsEnabled(true);
        }
        if (argv.includes("--proof-comments") || argv.includes("-p")) {
          setProofCommentsEnabled(true);
        }
        if (argv.includes("--no-proof-comments")) {
          setProofCommentsEnabled(false);
        }
        if (argv.includes("--super-restricted") || argv.includes("-s")) {
          setSuperRestrictedMode(true);
        }
        const positional = argv.filter((a) => !a.startsWith("-"));
        if (positional.length === 0) {
          printHelp(false);
          process.exit(0);
        }
        if (positional.length !== 1) {
          console.error("Error: expected exactly one input <file.n3>.");
          printHelp(true);
          process.exit(1);
        }
        const path2 = positional[0];
        let text;
        try {
          const fs2 = __require("fs");
          text = fs2.readFileSync(path2, { encoding: "utf8" });
        } catch (e) {
          console.error(`Error reading file ${JSON.stringify(path2)}: ${e.message}`);
          process.exit(1);
        }
        let toks;
        let prefixes, triples, frules, brules;
        try {
          toks = lex(text);
          const parser = new Parser(toks);
          [prefixes, triples, frules, brules] = parser.parseDocument();
          setTracePrefixes(prefixes);
        } catch (e) {
          if (e && e.name === "N3SyntaxError") {
            console.error(formatN3SyntaxError(e, text, path2));
            process.exit(1);
          }
          throw e;
        }
        if (showAst) {
          let astReplacer = function(_key, value) {
            if (value instanceof Set) return Array.from(value);
            if (value && typeof value === "object" && value.constructor) {
              const t = value.constructor.name;
              if (t && t !== "Object" && t !== "Array") return { _type: t, ...value };
            }
            return value;
          };
          console.log(JSON.stringify([prefixes, triples, frules, brules], astReplacer, 2));
          process.exit(0);
        }
        materializeRdfLists(triples, frules, brules);
        const facts = triples.filter((tr) => isGroundTriple(tr));
        if (outputStringsMode) {
          forwardChain(facts, frules, brules);
          const out = collectOutputStringsFromFacts(facts, prefixes);
          if (out) process.stdout.write(out);
          process.exit(0);
        }
        function prefixesUsedInInputTokens(toks2, prefEnv) {
          const used = /* @__PURE__ */ new Set();
          function maybeAddFromQName(name) {
            if (typeof name !== "string") return;
            if (!name.includes(":")) return;
            if (name.startsWith("_:")) return;
            const idx = name.indexOf(":");
            const p = name.slice(0, idx);
            if (!Object.prototype.hasOwnProperty.call(prefEnv.map, p)) return;
            used.add(p);
          }
          for (let i = 0; i < toks2.length; i++) {
            const t = toks2[i];
            if (t.typ === "AtPrefix") {
              while (i < toks2.length && toks2[i].typ !== "Dot" && toks2[i].typ !== "EOF") i++;
              continue;
            }
            if (t.typ === "AtBase") {
              while (i < toks2.length && toks2[i].typ !== "Dot" && toks2[i].typ !== "EOF") i++;
              continue;
            }
            if (t.typ === "Ident") maybeAddFromQName(t.value);
            if (t.typ === "PNameNs") maybeAddFromQName(t.value + ":");
          }
          const pfxLines = [];
          for (const pfx of Array.from(used).sort()) {
            const iri = prefEnv.map[pfx];
            const pname = pfx === "" ? ":" : pfx + ":";
            pfxLines.push(`@prefix ${pname} <${iri}> .`);
          }
          return pfxLines.join("\n");
        }
        const outPrefixes = prefixes;
        if (streamMode) {
          const header2 = prefixesUsedInInputTokens(toks, outPrefixes);
          if (header2) console.log(header2 + "\n");
          forwardChain(facts, frules, brules, (df) => {
            if (argv.includes("--proof-comments") || argv.includes("-p")) {
              printExplanation(df, outPrefixes);
            }
            console.log(tripleToN3(df.fact, outPrefixes));
          });
          process.exit(0);
        }
        const derived = forwardChain(facts, frules, brules);
        if (!derived || derived.length === 0) {
          process.exit(0);
        }
        const header = prefixesUsedInInputTokens(toks, outPrefixes);
        if (header) console.log(header + "\n");
        if (argv.includes("--proof-comments") || argv.includes("-p")) {
          for (const df of derived) printExplanation(df, outPrefixes);
        }
        const outN3 = derived.map((df) => tripleToN3(df.fact, outPrefixes)).join("\n");
        if (outN3) console.log(outN3);
      }
      function __shouldRunMain() {
        try {
          if (typeof process === "undefined" || !process.argv || process.argv.length < 2) return false;
          const arg1 = String(process.argv[1] || "");
          if (!arg1) return false;
          const base = typeof __filename === "string" ? __filename.split(/[\\/]/).pop() : "eyeling.js";
          if (!base) return false;
          return arg1 === __filename || arg1.endsWith("/" + base) || arg1.endsWith("\\" + base);
        } catch (_) {
          return false;
        }
      }
      if (__shouldRunMain()) main();
    }
  });
  require_eyeling();
})();
