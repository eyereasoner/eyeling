export interface EyelingPrefixEnv {
  _type?: 'PrefixEnv';
  map: Record<string, string>;
  baseIri?: string;
}

export interface EyelingIri {
  _type?: 'Iri';
  value: string;
}

export interface EyelingLiteral {
  _type?: 'Literal';
  value: string;
}

export interface EyelingVar {
  _type?: 'Var';
  name: string;
}

export interface EyelingBlank {
  _type?: 'Blank';
  label: string;
}

export interface EyelingListTerm {
  _type?: 'ListTerm';
  elems: EyelingTerm[];
}

export interface EyelingOpenListTerm {
  _type?: 'OpenListTerm';
  prefix: EyelingTerm[];
  tailVar: string;
}

export interface EyelingGraphTerm {
  _type?: 'GraphTerm';
  triples: EyelingTriple[];
}

export type EyelingTerm =
  | EyelingIri
  | EyelingLiteral
  | EyelingVar
  | EyelingBlank
  | EyelingListTerm
  | EyelingOpenListTerm
  | EyelingGraphTerm
  | import('@rdfjs/types').NamedNode
  | import('@rdfjs/types').BlankNode
  | import('@rdfjs/types').Variable
  | import('@rdfjs/types').Literal
  | import('@rdfjs/types').Quad;

export interface EyelingTriple {
  _type?: 'Triple';
  s: EyelingTerm;
  p: EyelingTerm;
  o: EyelingTerm;
}

export interface EyelingRule {
  _type?: 'Rule';
  premise: EyelingTriple[];
  conclusion: EyelingTriple[];
  isForward?: boolean;
  isFuse?: boolean;
  headBlankLabels?: Iterable<string> | string[];
  __dynamicConclusionTerm?: EyelingTerm;
}

export type EyelingAstBundle = [EyelingPrefixEnv, EyelingTriple[], EyelingRule[], EyelingRule[], EyelingRule[]?];

export type N3Source = string | { n3?: string; text?: string; baseIri?: string; label?: string };

export interface N3SourceListInput {
  sources: N3Source[];
  scopeBlankNodes?: boolean;
}

export type EngineName = 'n3' | 'eyeling';

export interface RdfJsReasonInput {
  n3?: string;
  quads?: Iterable<import('@rdfjs/types').Quad> | AsyncIterable<import('@rdfjs/types').Quad>;
  facts?: Iterable<import('@rdfjs/types').Quad> | AsyncIterable<import('@rdfjs/types').Quad>;
  dataset?: Iterable<import('@rdfjs/types').Quad> | AsyncIterable<import('@rdfjs/types').Quad>;
  rules?: EyelingRule[] | EyelingAstBundle;
  factsN3?: string;
  n3Facts?: string;
  prefixesN3?: string;
  n3Prefixes?: string;
  prefixes?: EyelingPrefixEnv;
  triples?: EyelingTriple[];
  forwardRules?: EyelingRule[];
  frules?: EyelingRule[];
  backwardRules?: EyelingRule[];
  brules?: EyelingRule[];
  queryRules?: EyelingRule[];
  logQueryRules?: EyelingRule[];
  qrules?: EyelingRule[];
  ast?: EyelingAstBundle;
  document?: EyelingAstBundle;
}

export interface StoreOptions {
  name?: string;
  clear?: boolean;
  path?: string;
  type?: 'memory' | 'persistent';
  backend?: 'memory' | 'level' | 'indexeddb';
}

export interface ReasonOptions {
  engine?: EngineName;
  proof?: boolean;
  proofComments?: boolean;
  noProofComments?: boolean;
  why?: boolean;
  explain?: boolean;
  stats?: boolean;
  rdf?: boolean;
  rdf12?: boolean;
  n3?: boolean;
  inputFormat?: 'auto' | 'rdf' | 'rdf12' | 'turtle' | 'ttl' | 'nt' | 'n3' | string;
  args?: string[];
  maxBuffer?: number;
  builtinModules?: string | string[];
  store?: string | StoreOptions;
  storePath?: string;
  storeClear?: boolean;
}

export interface BuiltinRegistrationContext {
  iri: string;
  goal: EyelingTriple;
  subst: Record<string, EyelingTerm>;
  facts: EyelingTriple[];
  backRules: EyelingRule[];
  depth: number;
  varGen: number[];
  maxResults?: number;
  api: unknown;
}

export type BuiltinHandler = (ctx: BuiltinRegistrationContext) => Array<Record<string, EyelingTerm>>;

export interface ReasonStreamOptions {
  engine?: EngineName;
  baseIri?: string | null;
  proof?: boolean;
  includeInputFactsInClosure?: boolean;
  enforceHttps?: boolean;
  rdfjs?: boolean;
  dataFactory?: import('@rdfjs/types').DataFactory<import('@rdfjs/types').Quad, import('@rdfjs/types').Quad> | null;
  skipUnsupportedRdfJs?: boolean;
  builtinModules?: string | string[];
  store?: string | StoreOptions;
  storePath?: string;
  storeClear?: boolean;
  onDerived?: (item: { triple: string; quad?: import('@rdfjs/types').Quad; quads?: import('@rdfjs/types').Quad[]; df: import('@rdfjs/types').DataFactory<import('@rdfjs/types').Quad, import('@rdfjs/types').Quad> }) => void;
}

export interface ReasonStreamResult {
  prefixes: EyelingPrefixEnv;
  facts: EyelingTriple[];
  derived: EyelingTriple[];
  queryMode: boolean;
  queryTriples: EyelingTriple[];
  queryDerived: EyelingTriple[];
  closureN3: string;
  closureQuads?: import('@rdfjs/types').Quad[];
  queryQuads?: import('@rdfjs/types').Quad[];
}

export interface FactStore {
  add(triple: EyelingTriple, kind?: 'explicit' | 'inferred'): Promise<boolean>;
  has(triple: EyelingTriple): Promise<boolean>;
  kindOf?(triple: EyelingTriple): Promise<number>;
  match(s?: EyelingTerm | null, p?: EyelingTerm | null, o?: EyelingTerm | null): AsyncIterable<EyelingTriple>;
  batchAdd?(triples: Iterable<EyelingTriple>, kind?: 'explicit' | 'inferred'): Promise<number>;
  clear?(): Promise<void>;
  close?(): Promise<void>;
}

export class MemoryFactStore implements FactStore {
  constructor();
  add(triple: EyelingTriple, kind?: 'explicit' | 'inferred'): Promise<boolean>;
  has(triple: EyelingTriple): Promise<boolean>;
  kindOf(triple: EyelingTriple): Promise<number>;
  match(s?: EyelingTerm | null, p?: EyelingTerm | null, o?: EyelingTerm | null): AsyncIterable<EyelingTriple>;
  batchAdd(triples: Iterable<EyelingTriple>, kind?: 'explicit' | 'inferred'): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export class PersistentFactStore implements FactStore {
  constructor(kv?: unknown, options?: StoreOptions);
  add(triple: EyelingTriple, kind?: 'explicit' | 'inferred'): Promise<boolean>;
  has(triple: EyelingTriple): Promise<boolean>;
  kindOf(triple: EyelingTriple): Promise<number>;
  match(s?: EyelingTerm | null, p?: EyelingTerm | null, o?: EyelingTerm | null): AsyncIterable<EyelingTriple>;
  batchAdd(triples: Iterable<EyelingTriple>, kind?: 'explicit' | 'inferred'): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export function reason(
  opts: ReasonOptions,
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
): string;
export function runAsync(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: ReasonStreamOptions & { engine?: 'n3' | 'eyeling' },
): Promise<ReasonStreamResult & { store?: FactStore }>;
export function reasonStream(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: ReasonStreamOptions,
): ReasonStreamResult;
export function reasonRdfJs(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: Omit<ReasonStreamOptions, 'rdfjs' | 'onDerived'>,
): AsyncIterable<import('@rdfjs/types').Quad>;

export const INFERENCE_FUSE_EXIT_CODE: 65;
export const rdfjs: import('@rdfjs/types').DataFactory<import('@rdfjs/types').Quad, import('@rdfjs/types').Quad> & { variable(value: string): import('@rdfjs/types').Variable };
export function createFactStore(options?: string | StoreOptions | null): Promise<FactStore>;
export function registerBuiltin(iri: string, handler: BuiltinHandler): BuiltinHandler;
export function unregisterBuiltin(iri: string): boolean;
export function registerBuiltinModule(mod: unknown, origin?: string): boolean;
export function loadBuiltinModule(specifier: string, options?: { resolveFrom?: string }): string;
export function listBuiltinIris(): string[];

export interface EyelingModule {
  readonly version: string;
  reason: typeof reason;
  runAsync: typeof runAsync;
  reasonStream: typeof reasonStream;
  reasonRdfJs: typeof reasonRdfJs;
  readonly INFERENCE_FUSE_EXIT_CODE: typeof INFERENCE_FUSE_EXIT_CODE;
  rdfjs: typeof rdfjs;
  createFactStore: typeof createFactStore;
  MemoryFactStore: typeof MemoryFactStore;
  PersistentFactStore: typeof PersistentFactStore;
  registerBuiltin: typeof registerBuiltin;
  unregisterBuiltin: typeof unregisterBuiltin;
  registerBuiltinModule: typeof registerBuiltinModule;
  loadBuiltinModule: typeof loadBuiltinModule;
  listBuiltinIris: typeof listBuiltinIris;
}

declare const eyeling: EyelingModule;
export default eyeling;
