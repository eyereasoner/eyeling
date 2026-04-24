declare module 'eyeling' {
  export interface RdfJsTerm {
    termType: string;
    value: string;
    equals(other: RdfJsTerm | null | undefined): boolean;
  }

  export interface RdfJsNamedNode extends RdfJsTerm {
    termType: 'NamedNode';
  }

  export interface RdfJsBlankNode extends RdfJsTerm {
    termType: 'BlankNode';
  }

  export interface RdfJsVariable extends RdfJsTerm {
    termType: 'Variable';
  }

  export interface RdfJsDefaultGraph extends RdfJsTerm {
    termType: 'DefaultGraph';
    value: '';
  }

  export interface RdfJsLiteral extends RdfJsTerm {
    termType: 'Literal';
    language: string;
    datatype: RdfJsNamedNode;
  }

  export interface RdfJsQuad extends RdfJsTerm {
    termType: 'Quad';
    value: '';
    subject: RdfJsTerm;
    predicate: RdfJsTerm;
    object: RdfJsTerm;
    graph: RdfJsTerm;
  }

  export interface RdfJsDataFactory {
    namedNode(value: string): RdfJsNamedNode;
    blankNode(value?: string): RdfJsBlankNode;
    literal(value: string, languageOrDatatype?: string | RdfJsNamedNode): RdfJsLiteral;
    variable(value: string): RdfJsVariable;
    defaultGraph(): RdfJsDefaultGraph;
    quad(subject: RdfJsTerm, predicate: RdfJsTerm, object: RdfJsTerm, graph?: RdfJsTerm): RdfJsQuad;
  }

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
    | RdfJsNamedNode
    | RdfJsBlankNode
    | RdfJsVariable
    | RdfJsLiteral;

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

  export interface RdfJsReasonInput {
    n3?: string;
    quads?: Iterable<RdfJsQuad> | AsyncIterable<RdfJsQuad>;
    facts?: Iterable<RdfJsQuad> | AsyncIterable<RdfJsQuad>;
    dataset?: Iterable<RdfJsQuad> | AsyncIterable<RdfJsQuad>;
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

  export interface ReasonOptions {
    proofComments?: boolean;
    noProofComments?: boolean;
    args?: string[];
    maxBuffer?: number;
    builtinModules?: string | string[];
  }

  export interface BuiltinRegistrationContext {
    iri: string;
    goal: EyelingTriple;
    subst: Record<string, EyelingTerm>;
    facts: any[];
    backRules: EyelingRule[];
    depth: number;
    varGen: number[];
    maxResults?: number;
    api: any;
  }

  export type BuiltinHandler = (ctx: BuiltinRegistrationContext) => Array<Record<string, EyelingTerm>>;

  export interface ReasonStreamOptions {
    baseIri?: string | null;
    proof?: boolean;
    includeInputFactsInClosure?: boolean;
    enforceHttps?: boolean;
    rdfjs?: boolean;
    dataFactory?: RdfJsDataFactory | null;
    skipUnsupportedRdfJs?: boolean;
    builtinModules?: string | string[];
    onDerived?: (item: { triple: string; quad?: RdfJsQuad; df: any }) => void;
  }

  export interface ReasonStreamResult {
    prefixes: any;
    facts: any[];
    derived: any[];
    queryMode: boolean;
    queryTriples: any[];
    queryDerived: any[];
    closureN3: string;
    closureQuads?: RdfJsQuad[];
    queryQuads?: RdfJsQuad[];
  }

  export function reason(
    opts: ReasonOptions,
    input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
  ): string;
  export function reasonStream(
    input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
    opts?: ReasonStreamOptions,
  ): ReasonStreamResult;
  export function reasonRdfJs(
    input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
    opts?: Omit<ReasonStreamOptions, 'rdfjs' | 'onDerived'>,
  ): AsyncIterable<RdfJsQuad>;

  export const rdfjs: RdfJsDataFactory;
  export function registerBuiltin(iri: string, handler: BuiltinHandler): BuiltinHandler;
  export function unregisterBuiltin(iri: string): boolean;
  export function registerBuiltinModule(mod: any, origin?: string): boolean;
  export function loadBuiltinModule(specifier: string, options?: { resolveFrom?: string }): string;
  export function listBuiltinIris(): string[];
}

declare module 'eyeling/browser' {
  export type RdfJsDataFactory = import('eyeling').RdfJsDataFactory;
  export type RdfJsQuad = import('eyeling').RdfJsQuad;
  export type RdfJsReasonInput = import('eyeling').RdfJsReasonInput;
  export type EyelingAstBundle = import('eyeling').EyelingAstBundle;
  export type N3Source = import('eyeling').N3Source;
  export type N3SourceListInput = import('eyeling').N3SourceListInput;
  export type ReasonStreamOptions = import('eyeling').ReasonStreamOptions;
  export type ReasonStreamResult = import('eyeling').ReasonStreamResult;
  export type BuiltinHandler = import('eyeling').BuiltinHandler;

  export function reasonStream(
    input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
    opts?: ReasonStreamOptions,
  ): ReasonStreamResult;
  export function reasonRdfJs(
    input: string | RdfJsReasonInput | EyelingAstBundle | N3SourceListInput,
    opts?: Omit<ReasonStreamOptions, 'rdfjs' | 'onDerived'>,
  ): AsyncIterable<RdfJsQuad>;

  export const rdfjs: RdfJsDataFactory;
  export function registerBuiltin(iri: string, handler: BuiltinHandler): BuiltinHandler;
  export function unregisterBuiltin(iri: string): boolean;
  export function registerBuiltinModule(mod: any, origin?: string): boolean;
  export function listBuiltinIris(): string[];

  const eyeling: {
    readonly version: string;
    reasonStream: typeof reasonStream;
    reasonRdfJs: typeof reasonRdfJs;
    rdfjs: typeof rdfjs;
    registerBuiltin: typeof registerBuiltin;
    unregisterBuiltin: typeof unregisterBuiltin;
    registerBuiltinModule: typeof registerBuiltinModule;
    listBuiltinIris: typeof listBuiltinIris;
  };

  export default eyeling;
}
