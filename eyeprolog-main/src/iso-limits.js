// ISO/IEC 13211-1 implementation-defined processor limits.
//
// max_arity describes the maximum arity of *compound terms*, not a separate
// implementation limit on procedures. EyeProlog does not impose a fixed
// compound-term arity ceiling: practical exhaustion is a resource issue.
// Keep null as the internal sentinel for the standard flag value `unbounded`.
export const ISO_MAX_ARITY = null;
