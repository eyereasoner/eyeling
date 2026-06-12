/**
 * Eyeling Reasoner — fact stores
 *
 * Optional async fact-store abstraction used by runAsync() and by tests.  The
 * in-memory reasoner remains the default; persistent stores are opt-in.
 */

'use strict';

const {
  Iri,
  Literal,
  Var,
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
} = require('./prelude');

const KIND_EXPLICIT = 1;
const KIND_INFERRED = 2;

function __dynamicRequire(name) {
  try {
    // Keep this indirect so the browser bundle can include this module without
    // eagerly trying to bundle Node-only or optional Level dependencies.
    const req = typeof require === 'function' ? require : null;
    return req ? req(name) : null;
  } catch {
    return null;
  }
}

function base64url(s) {
  const text = String(s);
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64url');
  const encoder = globalThis.TextEncoder ? new globalThis.TextEncoder() : null;
  if (!encoder || typeof globalThis.btoa !== 'function') {
    throw new Error('No UTF-8/base64 encoder available for persistent store keys');
  }
  const bytes = encoder.encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function idPart(id) {
  return String(id).padStart(16, '0');
}

function safeStoreName(name) {
  const text = String(name || 'default');
  return encodeURIComponent(text).replace(/%/g, '_');
}

function termToJson(term) {
  if (term instanceof Iri) return ['Iri', term.value];
  if (term instanceof Literal) return ['Literal', term.value];
  if (term instanceof Var) return ['Var', term.name];
  if (term instanceof Blank) return ['Blank', term.label];
  if (term instanceof ListTerm) return ['ListTerm', term.elems.map(termToJson)];
  if (term instanceof OpenListTerm) return ['OpenListTerm', term.prefix.map(termToJson), term.tailVar];
  if (term instanceof GraphTerm) return ['GraphTerm', term.triples.map(tripleToJson)];

  // RDF/JS terms, for callers that use the store abstraction directly.
  if (term && typeof term === 'object' && typeof term.termType === 'string') {
    switch (term.termType) {
      case 'NamedNode':
        return ['Iri', term.value];
      case 'BlankNode':
        return ['Blank', term.value && term.value.startsWith('_:') ? term.value : `_:${term.value}`];
      case 'Variable':
        return ['Var', term.value];
      case 'Literal': {
        const dt = term.datatype && term.datatype.termType === 'NamedNode' ? term.datatype.value : '';
        const lang = typeof term.language === 'string' ? term.language : '';
        const q = JSON.stringify(String(term.value));
        if (lang) return ['Literal', `${q}@${lang}`];
        if (!dt || dt === 'http://www.w3.org/2001/XMLSchema#string') return ['Literal', q];
        return ['Literal', `${q}^^<${dt}>`];
      }
      case 'Quad':
        return ['GraphTerm', [tripleToJson({ s: term.subject, p: term.predicate, o: term.object })]];
      case 'DefaultGraph':
        return ['DefaultGraph'];
      default:
        break;
    }
  }

  throw new TypeError(`Unsupported fact-store term: ${term && term.constructor ? term.constructor.name : String(term)}`);
}

function termFromJson(json) {
  if (!Array.isArray(json)) throw new TypeError('Invalid serialized term');
  switch (json[0]) {
    case 'Iri':
      return new Iri(json[1]);
    case 'Literal':
      return new Literal(json[1]);
    case 'Var':
      return new Var(json[1]);
    case 'Blank':
      return new Blank(json[1]);
    case 'ListTerm':
      return new ListTerm((json[1] || []).map(termFromJson));
    case 'OpenListTerm':
      return new OpenListTerm((json[1] || []).map(termFromJson), json[2]);
    case 'GraphTerm':
      return new GraphTerm((json[1] || []).map(tripleFromJson));
    case 'DefaultGraph':
      return new Iri('urn:eyeling:default-graph');
    default:
      throw new TypeError(`Unsupported serialized term type: ${json[0]}`);
  }
}

function tripleToJson(triple) {
  return [termToJson(triple.s || triple.subject), termToJson(triple.p || triple.predicate), termToJson(triple.o || triple.object)];
}

function tripleFromJson(json) {
  return new Triple(termFromJson(json[0]), termFromJson(json[1]), termFromJson(json[2]));
}

function termToStoreKey(term) {
  return JSON.stringify(termToJson(term));
}

function tripleToStoreKey(triple) {
  return JSON.stringify(tripleToJson(triple));
}

function kindMask(kind) {
  if (kind === 'explicit') return KIND_EXPLICIT;
  if (kind === 'inferred') return KIND_INFERRED;
  if (typeof kind === 'number') return kind & (KIND_EXPLICIT | KIND_INFERRED);
  return KIND_EXPLICIT;
}

class MemoryKv {
  constructor() {
    this.map = new Map();
  }

  async get(key) {
    return this.map.get(key);
  }

  async put(key, value) {
    this.map.set(key, value);
  }

  async del(key) {
    this.map.delete(key);
  }

  async clear() {
    this.map.clear();
  }

  async batch(ops) {
    for (const op of ops || []) {
      if (!op) continue;
      if (op.type === 'del') this.map.delete(op.key);
      else this.map.set(op.key, op.value);
    }
  }

  async *entries(prefix = '') {
    const keys = Array.from(this.map.keys())
      .filter((key) => key.startsWith(prefix))
      .sort();
    for (const key of keys) yield [key, this.map.get(key)];
  }

  async close() {}
}

class JsonFileKv extends MemoryKv {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.loaded = false;
    this.dirty = false;
  }

  async open() {
    if (this.loaded) return;
    this.loaded = true;
    const fs = __dynamicRequire('node:fs');
    const path = __dynamicRequire('node:path');
    if (!fs || !path) throw new Error('Persistent stores need node:fs in this runtime');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) return;
    const text = fs.readFileSync(this.filePath, 'utf8');
    if (!text.trim()) return;
    const data = JSON.parse(text);
    this.map = new Map(Array.isArray(data.entries) ? data.entries : []);
  }

  async flush() {
    if (!this.loaded || !this.dirty) return;
    const fs = __dynamicRequire('node:fs');
    const path = __dynamicRequire('node:path');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ entries: Array.from(this.map.entries()) }), 'utf8');
    fs.renameSync(tmp, this.filePath);
    this.dirty = false;
  }

  async get(key) {
    await this.open();
    return super.get(key);
  }

  async put(key, value) {
    await this.open();
    await super.put(key, value);
    this.dirty = true;
    await this.flush();
  }

  async del(key) {
    await this.open();
    await super.del(key);
    this.dirty = true;
    await this.flush();
  }

  async clear() {
    await this.open();
    await super.clear();
    this.dirty = true;
    await this.flush();
  }

  async batch(ops) {
    await this.open();
    await super.batch(ops);
    this.dirty = true;
    await this.flush();
  }

  async *entries(prefix = '') {
    await this.open();
    yield* super.entries(prefix);
  }

  async close() {
    await this.flush();
  }
}

class ClassicLevelKv {
  constructor(location) {
    const classic = __dynamicRequire('classic-level');
    const ClassicLevel = classic && (classic.ClassicLevel || classic.Level || classic.default);
    if (!ClassicLevel) throw new Error('classic-level is not installed');
    const fs = __dynamicRequire('node:fs');
    const path = __dynamicRequire('node:path');
    if (fs && path) fs.mkdirSync(path.dirname(location), { recursive: true });
    this.db = new ClassicLevel(location, { valueEncoding: 'json', createIfMissing: true, errorIfExists: false });
    this.opened = false;
  }

  async open() {
    if (this.opened) return;
    if (typeof this.db.open === 'function') await this.db.open();
    this.opened = true;
  }

  async get(key) {
    await this.open();
    try {
      return await this.db.get(key);
    } catch (e) {
      if (e && (e.notFound || e.code === 'LEVEL_NOT_FOUND' || e.code === 'NOT_FOUND')) return undefined;
      throw e;
    }
  }

  async put(key, value) {
    await this.open();
    await this.db.put(key, value);
  }

  async del(key) {
    await this.open();
    await this.db.del(key);
  }

  async clear() {
    await this.open();
    if (typeof this.db.clear === 'function') await this.db.clear();
    else {
      const ops = [];
      for await (const [key] of this.entries('')) ops.push({ type: 'del', key });
      if (ops.length) await this.batch(ops);
    }
  }

  async batch(ops) {
    await this.open();
    if (!ops || !ops.length) return;
    await this.db.batch(ops);
  }

  async *entries(prefix = '') {
    await this.open();
    const gte = prefix;
    const lt = prefix + '\uffff';
    const iterator = this.db.iterator({ gte, lt });
    for await (const item of iterator) {
      if (Array.isArray(item)) yield item;
      else if (item && Array.isArray(item.key)) yield item.key;
    }
  }

  async close() {
    if (this.db && typeof this.db.close === 'function') await this.db.close();
  }
}

class IndexedDbKv {
  constructor(name) {
    this.name = name;
    this.dbPromise = null;
  }

  open() {
    if (this.dbPromise) return this.dbPromise;
    const idb = typeof globalThis !== 'undefined' ? globalThis.indexedDB : null;
    if (!idb) throw new Error('IndexedDB is not available in this runtime');
    this.dbPromise = new Promise((resolve, reject) => {
      const req = idb.open(`eyeling:${this.name}`, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB store'));
      req.onsuccess = () => resolve(req.result);
    });
    return this.dbPromise;
  }

  async __tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const store = tx.objectStore('kv');
      let value;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      try {
        value = fn(store, resolve, reject);
      } catch (e) {
        try { tx.abort(); } catch {}
        reject(e);
      }
    });
  }

  async get(key) {
    return this.__tx('readonly', (store, resolve, reject) => {
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async put(key, value) {
    return this.__tx('readwrite', (store) => {
      store.put(value, key);
    });
  }

  async del(key) {
    return this.__tx('readwrite', (store) => {
      store.delete(key);
    });
  }

  async clear() {
    return this.__tx('readwrite', (store) => {
      store.clear();
    });
  }

  async batch(ops) {
    return this.__tx('readwrite', (store) => {
      for (const op of ops || []) {
        if (op.type === 'del') store.delete(op.key);
        else store.put(op.value, op.key);
      }
    });
  }

  async *entries(prefix = '') {
    const db = await this.open();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const out = [];
      const range = globalThis.IDBKeyRange.bound(prefix, prefix + '\uffff', false, true);
      const req = store.openCursor(range);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        out.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    });
    for (const row of rows) yield row;
  }

  async close() {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    if (db && typeof db.close === 'function') db.close();
  }
}

class MemoryFactStore {
  constructor() {
    this.map = new Map();
  }

  async add(triple, kind = 'explicit') {
    const key = tripleToStoreKey(triple);
    const prev = this.map.get(key);
    const mask = kindMask(kind);
    if (prev) {
      const nextKind = prev.kind | mask;
      if (nextKind !== prev.kind) prev.kind = nextKind;
      return false;
    }
    this.map.set(key, { triple, kind: mask });
    return true;
  }

  async batchAdd(triples, kind = 'explicit') {
    let n = 0;
    for (const triple of triples || []) if (await this.add(triple, kind)) n += 1;
    return n;
  }

  async has(triple) {
    return this.map.has(tripleToStoreKey(triple));
  }

  async kindOf(triple) {
    const row = this.map.get(tripleToStoreKey(triple));
    return row ? row.kind : 0;
  }

  async *match(s, p, o) {
    const sk = s == null ? null : termToStoreKey(s);
    const pk = p == null ? null : termToStoreKey(p);
    const ok = o == null ? null : termToStoreKey(o);
    for (const { triple } of this.map.values()) {
      if (sk !== null && termToStoreKey(triple.s) !== sk) continue;
      if (pk !== null && termToStoreKey(triple.p) !== pk) continue;
      if (ok !== null && termToStoreKey(triple.o) !== ok) continue;
      yield triple;
    }
  }

  async clear() {
    this.map.clear();
  }

  async close() {}
}

class PersistentFactStore {
  constructor(kv, options = {}) {
    this.kv = kv;
    this.termCacheByKey = new Map();
    this.termCacheById = new Map();
    this.name = options.name || 'default';
  }

  async clear() {
    await this.kv.clear();
    this.termCacheByKey.clear();
    this.termCacheById.clear();
  }

  async __nextTermId() {
    const key = 'meta/nextTermId';
    const current = Number((await this.kv.get(key)) || 1);
    await this.kv.put(key, current + 1);
    return idPart(current);
  }

  async __idForTerm(term, create) {
    const canonical = termToStoreKey(term);
    if (this.termCacheByKey.has(canonical)) return this.termCacheByKey.get(canonical);
    const byLexKey = `term/byLex/${base64url(canonical)}`;
    const found = await this.kv.get(byLexKey);
    if (found !== undefined) {
      this.termCacheByKey.set(canonical, found);
      return found;
    }
    if (!create) return null;
    const id = await this.__nextTermId();
    const json = termToJson(term);
    await this.kv.batch([
      { type: 'put', key: byLexKey, value: id },
      { type: 'put', key: `term/byId/${id}`, value: json },
    ]);
    this.termCacheByKey.set(canonical, id);
    this.termCacheById.set(id, term);
    return id;
  }

  async __termById(id) {
    if (this.termCacheById.has(id)) return this.termCacheById.get(id);
    const json = await this.kv.get(`term/byId/${id}`);
    if (json === undefined) throw new Error(`Corrupt fact store: missing term ${id}`);
    const term = termFromJson(json);
    this.termCacheById.set(id, term);
    return term;
  }

  async __tripleFromIds(sid, pid, oid) {
    return new Triple(await this.__termById(sid), await this.__termById(pid), await this.__termById(oid));
  }

  async add(triple, kind = 'explicit') {
    const sid = await this.__idForTerm(triple.s, true);
    const pid = await this.__idForTerm(triple.p, true);
    const oid = await this.__idForTerm(triple.o, true);
    const mask = kindMask(kind);
    const primary = `triple/${sid}/${pid}/${oid}`;
    const prev = await this.kv.get(primary);
    if (prev !== undefined) {
      const nextKind = (typeof prev === 'number' ? prev : prev.kind || 0) | mask;
      if (nextKind !== prev) await this.kv.put(primary, nextKind);
      return false;
    }
    await this.kv.batch([
      { type: 'put', key: primary, value: mask },
      { type: 'put', key: `i/spo/${sid}/${pid}/${oid}`, value: mask },
      { type: 'put', key: `i/pos/${pid}/${oid}/${sid}`, value: mask },
      { type: 'put', key: `i/osp/${oid}/${sid}/${pid}`, value: mask },
    ]);
    return true;
  }

  async batchAdd(triples, kind = 'explicit') {
    let n = 0;
    for (const triple of triples || []) if (await this.add(triple, kind)) n += 1;
    return n;
  }

  async has(triple) {
    return (await this.kindOf(triple)) !== 0;
  }

  async kindOf(triple) {
    const sid = await this.__idForTerm(triple.s, false);
    if (sid === null) return 0;
    const pid = await this.__idForTerm(triple.p, false);
    if (pid === null) return 0;
    const oid = await this.__idForTerm(triple.o, false);
    if (oid === null) return 0;
    const value = await this.kv.get(`triple/${sid}/${pid}/${oid}`);
    return typeof value === 'number' ? value : value && typeof value.kind === 'number' ? value.kind : 0;
  }

  async __idsForPattern(s, p, o) {
    const sid = s == null ? null : await this.__idForTerm(s, false);
    const pid = p == null ? null : await this.__idForTerm(p, false);
    const oid = o == null ? null : await this.__idForTerm(o, false);
    if ((s != null && sid === null) || (p != null && pid === null) || (o != null && oid === null)) return null;
    return { sid, pid, oid };
  }

  __scanPlan(sid, pid, oid) {
    if (sid && pid && oid) return { index: 'triple', prefix: `triple/${sid}/${pid}/${oid}`, order: 'spo' };
    if (sid && pid) return { index: 'spo', prefix: `i/spo/${sid}/${pid}/`, order: 'spo' };
    if (pid && oid) return { index: 'pos', prefix: `i/pos/${pid}/${oid}/`, order: 'pos' };
    if (sid && oid) return { index: 'osp', prefix: `i/osp/${oid}/${sid}/`, order: 'osp' };
    if (pid) return { index: 'pos', prefix: `i/pos/${pid}/`, order: 'pos' };
    if (sid) return { index: 'spo', prefix: `i/spo/${sid}/`, order: 'spo' };
    if (oid) return { index: 'osp', prefix: `i/osp/${oid}/`, order: 'osp' };
    return { index: 'spo', prefix: 'i/spo/', order: 'spo' };
  }

  __decodeIndexKey(key, plan) {
    if (plan.index === 'triple') {
      const parts = key.split('/');
      return { sid: parts[1], pid: parts[2], oid: parts[3] };
    }
    const rest = key.slice(`i/${plan.index}/`.length).split('/');
    if (plan.order === 'spo') return { sid: rest[0], pid: rest[1], oid: rest[2] };
    if (plan.order === 'pos') return { pid: rest[0], oid: rest[1], sid: rest[2] };
    return { oid: rest[0], sid: rest[1], pid: rest[2] };
  }

  async *match(s, p, o) {
    const ids = await this.__idsForPattern(s, p, o);
    if (!ids) return;
    const plan = this.__scanPlan(ids.sid, ids.pid, ids.oid);
    const seen = new Set();
    for await (const [key] of this.kv.entries(plan.prefix)) {
      const row = this.__decodeIndexKey(key, plan);
      if (ids.sid && row.sid !== ids.sid) continue;
      if (ids.pid && row.pid !== ids.pid) continue;
      if (ids.oid && row.oid !== ids.oid) continue;
      const primary = `${row.sid}/${row.pid}/${row.oid}`;
      if (seen.has(primary)) continue;
      seen.add(primary);
      yield this.__tripleFromIds(row.sid, row.pid, row.oid);
    }
  }

  async close() {
    if (this.kv && typeof this.kv.close === 'function') await this.kv.close();
  }
}

function nodeStoreLocation(name, storePath) {
  const path = __dynamicRequire('node:path');
  const os = __dynamicRequire('node:os');
  if (!path || !os) return null;
  const base = storePath || path.join(os.homedir ? os.homedir() : '.', '.eyeling-store');
  return path.join(base, safeStoreName(name));
}

async function createPersistentFactStore(options = {}) {
  const name = typeof options === 'string' ? options : options.name || 'default';
  const clear = !!(options && options.clear);
  let kv;

  if (typeof globalThis !== 'undefined' && globalThis.indexedDB && !__dynamicRequire('node:fs')) {
    kv = new IndexedDbKv(name);
  } else {
    const location = nodeStoreLocation(name, options && options.path);
    try {
      kv = new ClassicLevelKv(location);
    } catch {
      kv = new JsonFileKv(`${location}.json`);
    }
  }

  const store = new PersistentFactStore(kv, { name });
  if (clear) await store.clear();
  return store;
}

async function createFactStore(options = null) {
  if (!options) return new MemoryFactStore();
  if (typeof options === 'string') return createPersistentFactStore({ name: options });
  if (options.type === 'memory') return new MemoryFactStore();
  if (options.backend === 'memory') return new MemoryFactStore();
  return createPersistentFactStore(options);
}

async function collectStore(store) {
  const out = [];
  for await (const tr of store.match(null, null, null)) out.push(tr);
  return out;
}

module.exports = {
  KIND_EXPLICIT,
  KIND_INFERRED,
  MemoryFactStore,
  PersistentFactStore,
  createFactStore,
  createPersistentFactStore,
  collectStore,
  termToStoreKey,
  tripleToStoreKey,
  termToJson,
  termFromJson,
  tripleToJson,
  tripleFromJson,
};
