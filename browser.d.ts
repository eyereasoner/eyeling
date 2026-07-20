export type EyelingPrefixEnv = import('eyeling').EyelingPrefixEnv;
export type EyelingIri = import('eyeling').EyelingIri;
export type EyelingLiteral = import('eyeling').EyelingLiteral;
export type EyelingVar = import('eyeling').EyelingVar;
export type EyelingBlank = import('eyeling').EyelingBlank;
export type EyelingListTerm = import('eyeling').EyelingListTerm;
export type EyelingOpenListTerm = import('eyeling').EyelingOpenListTerm;
export type EyelingGraphTerm = import('eyeling').EyelingGraphTerm;
export type EyelingTerm = import('eyeling').EyelingTerm;
export type EyelingTriple = import('eyeling').EyelingTriple;
export type EyelingRule = import('eyeling').EyelingRule;
export type EyelingAstBundle = import('eyeling').EyelingAstBundle;
export type ParseN3Options = import('eyeling').ParseN3Options;
export type EyelingParsedDocument = import('eyeling').EyelingParsedDocument;
export type N3Source = import('eyeling').N3Source;
export type N3SourceListInput = import('eyeling').N3SourceListInput;
export type RdfJsReasonInput = import('eyeling').RdfJsReasonInput;
export type StoreOptions = import('eyeling').StoreOptions;
export type BuiltinRegistrationContext = import('eyeling').BuiltinRegistrationContext;
export type BuiltinHandler = import('eyeling').BuiltinHandler;
export type ReasonStreamOptions = import('eyeling').ReasonStreamOptions;
export type ReasonStreamResult = import('eyeling').ReasonStreamResult;
export type FactStore = import('eyeling').FactStore;

export function runAsync(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: ReasonStreamOptions,
): Promise<ReasonStreamResult & { store?: FactStore }>;
export function reasonStream(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: ReasonStreamOptions,
): ReasonStreamResult;
export function reasonRdfJs(
  input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  opts?: Omit<ReasonStreamOptions, 'rdfjs' | 'onDerived'>,
): AsyncIterable<import('@rdfjs/types').Quad>;
export function parseN3Text(text: string, opts?: ParseN3Options): EyelingParsedDocument;

export const INFERENCE_FUSE_EXIT_CODE: 65;
export const rdfjs: import('eyeling').EyelingModule['rdfjs'];
export function createFactStore(options?: string | StoreOptions | null): Promise<FactStore>;
export function registerBuiltin(iri: string, handler: BuiltinHandler): BuiltinHandler;
export function unregisterBuiltin(iri: string): boolean;
export function registerBuiltinModule(mod: unknown, origin?: string): boolean;
export function listBuiltinIris(): string[];
export function collectOutputStringsFromFacts(facts: EyelingTriple[], prefixes: EyelingPrefixEnv): string[];
export function prettyPrintQueryTriples(triples: EyelingTriple[], prefixes: EyelingPrefixEnv): string;

export interface EyelingBrowserModule {
  readonly version: string;
  runAsync: typeof runAsync;
  reasonStream: typeof reasonStream;
  reasonRdfJs: typeof reasonRdfJs;
  parseN3Text: typeof parseN3Text;
  readonly INFERENCE_FUSE_EXIT_CODE: typeof INFERENCE_FUSE_EXIT_CODE;
  rdfjs: typeof rdfjs;
  createFactStore: typeof createFactStore;
  registerBuiltin: typeof registerBuiltin;
  unregisterBuiltin: typeof unregisterBuiltin;
  registerBuiltinModule: typeof registerBuiltinModule;
  listBuiltinIris: typeof listBuiltinIris;
  collectOutputStringsFromFacts: typeof collectOutputStringsFromFacts;
  prettyPrintQueryTriples: typeof prettyPrintQueryTriples;
}

declare const eyeling: EyelingBrowserModule;
export default eyeling;
