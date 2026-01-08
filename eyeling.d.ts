declare module "eyeling" {
  export type ReasonStreamOpts = {
    baseIri?: string | null;
    proof?: boolean;
    onDerived?: (ev: { triple: string; df: any }) => void;
    includeInputFactsInClosure?: boolean;
    enforceHttps?: boolean;
  };

  export type ReasonStreamResult = {
    prefixes: any;
    facts: any[];
    derived: any[];
    closureN3: string;
  };

  export function reasonStream(n3Text: string, opts?: ReasonStreamOpts): ReasonStreamResult;
}

