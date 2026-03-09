#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARRAY_LEN(x) (sizeof(x) / sizeof((x)[0]))

typedef struct {
    const char *name;
    int canonicalTripleCount;
    int spoIndexTripleCount;
    int bloomBits;
    int hashFunctions;
    int negativeLookupsPerBatch;
    double fpRateBudget;
    double extraExactLookupsBudget;
    const char *exactTranscendentalSymbol;
    double certifiedLambda;
    double expMinusLambdaLower;
    double expMinusLambdaUpper;
    const char *maybePositivePolicy;
    const char *definiteNegativePolicy;
} Artifact;

typedef enum {
    REJECT_NON_POSITIVE_BLOOM_BITS,
    REJECT_CERTIFIED_LAMBDA_MISMATCH,
    REJECT_MALFORMED_INTERVAL_ORDERING,
    REJECT_NON_POSITIVE_INTERVAL_LOWER_BOUND,
    REJECT_INTERVAL_UPPER_BOUND_NOT_BELOW_ONE
} RejectReason;

typedef struct {
    double lambda;
    double weakFpUpper;
    double weakExtraUpper;
    bool indexAgreement;
    bool weakWithinFpRateBudget;
    bool weakWithinExactLookupBudget;
    bool weakAccepted;
    bool parameterSanity;
    bool expIntervalCertificate;
    bool withinFpRateBudget;
    bool withinExactLookupBudget;
    bool hardenedAccepted;
    RejectReason rejectReasons[8];
    size_t rejectReasonCount;
} Evaluation;

static bool same_policy(const char *lhs, const char *rhs) {
    return strcmp(lhs, rhs) == 0;
}

static double compute_lambda(const Artifact *a) {
    double kn = (double)a->hashFunctions * (double)a->canonicalTripleCount;
    return kn / (double)a->bloomBits;
}

static double compute_weak_fp_upper(const Artifact *a) {
    double oneMinusHi = 1.0 - a->expMinusLambdaLower;
    return pow(oneMinusHi, a->hashFunctions);
}

static void add_reject_reason(Evaluation *ev, RejectReason reason) {
    ev->rejectReasons[ev->rejectReasonCount++] = reason;
}

static const char *reject_reason_name(RejectReason reason) {
    switch (reason) {
        case REJECT_NON_POSITIVE_BLOOM_BITS:
            return ":NonPositiveBloomBits";
        case REJECT_CERTIFIED_LAMBDA_MISMATCH:
            return ":CertifiedLambdaMismatch";
        case REJECT_MALFORMED_INTERVAL_ORDERING:
            return ":MalformedIntervalOrdering";
        case REJECT_NON_POSITIVE_INTERVAL_LOWER_BOUND:
            return ":NonPositiveIntervalLowerBound";
        case REJECT_INTERVAL_UPPER_BOUND_NOT_BELOW_ONE:
            return ":IntervalUpperBoundNotBelowOne";
    }
    return ":UnknownRejectReason";
}

static Evaluation evaluate_artifact(const Artifact *a) {
    Evaluation ev;
    memset(&ev, 0, sizeof(ev));

    ev.lambda = compute_lambda(a);
    ev.indexAgreement = (a->canonicalTripleCount == a->spoIndexTripleCount);

    ev.weakFpUpper = compute_weak_fp_upper(a);
    ev.weakWithinFpRateBudget = (ev.weakFpUpper < a->fpRateBudget);
    ev.weakExtraUpper = (double)a->negativeLookupsPerBatch * ev.weakFpUpper;
    ev.weakWithinExactLookupBudget = (ev.weakExtraUpper < a->extraExactLookupsBudget);
    ev.weakAccepted = ev.indexAgreement &&
                      ev.weakWithinFpRateBudget &&
                      ev.weakWithinExactLookupBudget &&
                      same_policy(a->maybePositivePolicy, ":ConfirmAgainstCanonicalGraph") &&
                      same_policy(a->definiteNegativePolicy, ":ReturnAbsent");

    ev.parameterSanity =
        a->canonicalTripleCount > 0 &&
        a->spoIndexTripleCount > 0 &&
        a->bloomBits > 0 &&
        a->hashFunctions > 0 &&
        a->negativeLookupsPerBatch > 0 &&
        a->fpRateBudget > 0.0 &&
        a->extraExactLookupsBudget > 0.0;

    ev.expIntervalCertificate =
        ev.lambda > 0.0 &&
        a->certifiedLambda == ev.lambda &&
        a->expMinusLambdaLower < a->expMinusLambdaUpper &&
        a->expMinusLambdaLower > 0.0 &&
        a->expMinusLambdaUpper < 1.0;

    ev.withinFpRateBudget = ev.expIntervalCertificate &&
                            ev.weakFpUpper > 0.0 &&
                            ev.weakFpUpper < a->fpRateBudget;

    ev.withinExactLookupBudget = ev.expIntervalCertificate &&
                                 ev.weakExtraUpper > 0.0 &&
                                 ev.weakExtraUpper < a->extraExactLookupsBudget;

    ev.hardenedAccepted = ev.parameterSanity &&
                          ev.indexAgreement &&
                          ev.expIntervalCertificate &&
                          ev.withinFpRateBudget &&
                          ev.withinExactLookupBudget &&
                          same_policy(a->maybePositivePolicy, ":ConfirmAgainstCanonicalGraph") &&
                          same_policy(a->definiteNegativePolicy, ":ReturnAbsent");

    if (a->bloomBits <= 0) {
        add_reject_reason(&ev, REJECT_NON_POSITIVE_BLOOM_BITS);
    }
    if (a->certifiedLambda != ev.lambda) {
        add_reject_reason(&ev, REJECT_CERTIFIED_LAMBDA_MISMATCH);
    }
    if (!(a->expMinusLambdaUpper > a->expMinusLambdaLower)) {
        add_reject_reason(&ev, REJECT_MALFORMED_INTERVAL_ORDERING);
    }
    if (!(a->expMinusLambdaLower > 0.0)) {
        add_reject_reason(&ev, REJECT_NON_POSITIVE_INTERVAL_LOWER_BOUND);
    }
    if (!(a->expMinusLambdaUpper < 1.0)) {
        add_reject_reason(&ev, REJECT_INTERVAL_UPPER_BOUND_NOT_BELOW_ONE);
    }

    return ev;
}

static void print_decision(const Artifact *a, const Evaluation *ev) {
    printf(":result :decision [\n");
    printf("  :artifact %s ;\n", a->name);
    printf("  :hardened %s ;\n",
           ev->hardenedAccepted ? ":AcceptForHighTrustUse" : ":RejectForHighTrustUse");
    printf("  :weak %s\n",
           ev->weakAccepted ? ":AcceptUnderWeakBudgetOnlyRules" : ":RejectUnderWeakBudgetOnlyRules");
    printf("] .\n");
}

static void print_reject_reasons(const Artifact *a, const Evaluation *ev) {
    for (size_t i = 0; i < ev->rejectReasonCount; ++i) {
        printf(":result :rejectReason [\n");
        printf("  :artifact %s ;\n", a->name);
        printf("  :why %s\n", reject_reason_name(ev->rejectReasons[i]));
        printf("] .\n");
    }
}

static void print_summary_tampered(const Artifact *a, const Evaluation *ev) {
    long long weakFpUpperInt = (long long)llround(ev->weakFpUpper);
    long long weakExtraUpperInt = (long long)llround(ev->weakExtraUpper);

    printf(":result :summary (%s \"lambda\" %.0f \"certified-lambda\" %.10f ",
           a->name,
           ev->lambda,
           a->certifiedLambda);
    printf("\"weak-fp-upper\" \"%lld\"^^xsd:decimal ", weakFpUpperInt);
    printf("\"weak-extra-exact-upper\" \"%lld\"^^xsd:decimal ", weakExtraUpperInt);
    printf("\"weak-decision\" %s \"hardened-decision\" %s) .\n",
           ev->weakAccepted ? ":AcceptUnderWeakBudgetOnlyRules" : ":RejectUnderWeakBudgetOnlyRules",
           ev->hardenedAccepted ? ":AcceptForHighTrustUse" : ":RejectForHighTrustUse");
}

static void print_summary_trusted(const Artifact *a, const Evaluation *ev) {
    printf(":result :summary (%s \"lambda\" \"%.10f\"^^xsd:decimal \"certified-lambda\" %.10f ",
           a->name,
           ev->lambda,
           a->certifiedLambda);
    printf("\"weak-fp-upper\" \"%.19f\"^^xsd:decimal ", ev->weakFpUpper);
    printf("\"weak-extra-exact-upper\" \"%.14f\"^^xsd:decimal ", ev->weakExtraUpper);
    printf("\"weak-decision\" %s \"hardened-decision\" %s) .\n",
           ev->weakAccepted ? ":AcceptUnderWeakBudgetOnlyRules" : ":RejectUnderWeakBudgetOnlyRules",
           ev->hardenedAccepted ? ":AcceptForHighTrustUse" : ":RejectForHighTrustUse");
}

int main(void) {
    const Artifact trusted = {
        .name = ":trustedArtifact",
        .canonicalTripleCount = 1200,
        .spoIndexTripleCount = 1200,
        .bloomBits = 16384,
        .hashFunctions = 7,
        .negativeLookupsPerBatch = 50000,
        .fpRateBudget = 0.002,
        .extraExactLookupsBudget = 100.0,
        .exactTranscendentalSymbol = "exp(-k*n/m)",
        .certifiedLambda = 0.5126953125,
        .expMinusLambdaLower = 0.5988792348,
        .expMinusLambdaUpper = 0.5988792349,
        .maybePositivePolicy = ":ConfirmAgainstCanonicalGraph",
        .definiteNegativePolicy = ":ReturnAbsent"
    };

    const Artifact tampered = {
        .name = ":tamperedArtifact",
        .canonicalTripleCount = 1200,
        .spoIndexTripleCount = 1200,
        .bloomBits = -12,
        .hashFunctions = 7,
        .negativeLookupsPerBatch = 1,
        .fpRateBudget = 0.1,
        .extraExactLookupsBudget = 100.0,
        .exactTranscendentalSymbol = "whatever an attacker writes here",
        .certifiedLambda = 0.5126953125,
        .expMinusLambdaLower = 42.0,
        .expMinusLambdaUpper = -42.0,
        .maybePositivePolicy = ":ConfirmAgainstCanonicalGraph",
        .definiteNegativePolicy = ":ReturnAbsent"
    };

    const Evaluation trustedEval = evaluate_artifact(&trusted);
    const Evaluation tamperedEval = evaluate_artifact(&tampered);

    printf("@prefix : <http://example.org/high-trust-rdf#> .\n");
    printf("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n");

    print_decision(&trusted, &trustedEval);
    print_decision(&tampered, &tamperedEval);
    print_reject_reasons(&tampered, &tamperedEval);
    print_summary_tampered(&tampered, &tamperedEval);
    print_summary_trusted(&trusted, &trustedEval);

    return 0;
}
