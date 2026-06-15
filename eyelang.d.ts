export interface EyelangStats {
  [key: string]: number;
}

export interface EyelangRunOptions {
  proof?: boolean;
  why?: boolean;
  explain?: boolean;
  inputFormat?: 'auto' | 'eyelang' | 'rdf' | 'rdf12' | 'turtle' | 'ttl' | 'nt' | 'n3' | string;
  [key: string]: unknown;
}

export interface EyelangRunResult {
  stdout: string;
  stats: EyelangStats;
}

export interface EyelangSourcePart {
  text?: string;
  source?: string;
  filename?: string;
}

export class Program {
  constructor(clauses?: unknown[], options?: EyelangRunOptions);
  static parse(source: string, options?: EyelangRunOptions): Program;
  static parseSources(sources?: Array<string | EyelangSourcePart>, options?: EyelangRunOptions): Program;
  materializationGoals(): unknown[];
  sourceFactLines(predicateKeys?: Set<string> | null): Set<string>;
}

export function makeProgram(clauses?: unknown[], options?: EyelangRunOptions): Program;
export function parseClauses(source: string, options?: EyelangRunOptions): unknown[];
export function parseProgramText(source: string, options?: EyelangRunOptions): unknown[];
export function parseRdfClauses(source: string, options?: EyelangRunOptions): unknown[];
export function rdfToEyelang(source: string, options?: EyelangRunOptions): string;
export function clausesToEyelang(clauses: unknown[]): string;
export function rdfIri(value: string): unknown;
export function rdfBlank(value: string): unknown;
export function rdfLiteral(value: string, datatype?: string, language?: string): unknown;
export function rdfTripleTerm(subject: unknown, predicate: unknown, object: unknown): unknown;
export function rdfGoal(subject: unknown, predicate: unknown, object: unknown): unknown;

export class Env {
  constructor(parent?: Env | null);
}

export class Solver {
  constructor(program: Program, options?: EyelangRunOptions);
  stats: EyelangStats;
  solve(goals: unknown[], env?: Env, depth?: number): Iterable<Env>;
}

export class BuiltinRegistry {
  constructor();
}

export function createDefaultRegistry(): BuiltinRegistry;
export function getDefaultRegistry(): BuiltinRegistry;

export function run(source: string | Program, options?: EyelangRunOptions): EyelangRunResult;

export function whyProof(program: Program, goal: unknown, options?: EyelangRunOptions): { ok: boolean; text: string };
export function whyNoProof(goal: unknown): string;

export const ATOM: 'atom';
export const VARIABLE: 'variable';
export const COMPOUND: 'compound';
export const NUMBER: 'number';
export const STRING: 'string';
export function atom(name: string): unknown;
export function variable(name: string): unknown;
export function compound(name: string, args?: unknown[]): unknown;
export function termToString(term: unknown, env?: Env, quoted?: boolean): string;

declare const eyelang: {
  run: typeof run;
  Program: typeof Program;
  makeProgram: typeof makeProgram;
  parseClauses: typeof parseClauses;
  parseProgramText: typeof parseProgramText;
  parseRdfClauses: typeof parseRdfClauses;
  rdfToEyelang: typeof rdfToEyelang;
  clausesToEyelang: typeof clausesToEyelang;
  Solver: typeof Solver;
  Env: typeof Env;
  BuiltinRegistry: typeof BuiltinRegistry;
  createDefaultRegistry: typeof createDefaultRegistry;
  getDefaultRegistry: typeof getDefaultRegistry;
};

export default eyelang;
