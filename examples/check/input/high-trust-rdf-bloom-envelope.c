#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

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

typedef struct {
    bool parameterSanity;
    bool indexAgreement;
    double lambda;
    bool expIntervalCertificate;
    double fpRateLower;
    double fpRateUpper;
    bool withinFpRateBudget;
    double expectedExtraExactLookupsUpper;
    bool withinExactLookupBudget;
    bool accepted;
} Evaluation;

static bool same_policy(const char *lhs, const char *rhs) {
    return strcmp(lhs, rhs) == 0;
}

static Evaluation evaluate_artifact(const Artifact *a) {
    Evaluation ev;
    memset(&ev, 0, sizeof(ev));

    ev.parameterSanity =
        a->canonicalTripleCount > 0 &&
        a->spoIndexTripleCount > 0 &&
        a->bloomBits > 0 &&
        a->hashFunctions > 0 &&
        a->negativeLookupsPerBatch > 0 &&
        a->fpRateBudget > 0.0 &&
        a->extraExactLookupsBudget > 0.0;

    ev.indexAgreement = (a->canonicalTripleCount == a->spoIndexTripleCount);

    if (ev.parameterSanity) {
        ev.lambda = ((double)a->hashFunctions * (double)a->canonicalTripleCount) /
                    (double)a->bloomBits;
    }

    ev.expIntervalCertificate =
        ev.lambda > 0.0 &&
        a->certifiedLambda == ev.lambda &&
        a->expMinusLambdaLower < a->expMinusLambdaUpper &&
        a->expMinusLambdaLower > 0.0 &&
        a->expMinusLambdaUpper < 1.0;

    if (ev.expIntervalCertificate) {
        const double oneMinusLo = 1.0 - a->expMinusLambdaUpper;
        const double oneMinusHi = 1.0 - a->expMinusLambdaLower;
        ev.fpRateLower = pow(oneMinusLo, a->hashFunctions);
        ev.fpRateUpper = pow(oneMinusHi, a->hashFunctions);
    }

    ev.withinFpRateBudget =
        ev.fpRateUpper > 0.0 &&
        ev.fpRateUpper < a->fpRateBudget;

    ev.expectedExtraExactLookupsUpper =
        (double)a->negativeLookupsPerBatch * ev.fpRateUpper;

    ev.withinExactLookupBudget =
        ev.expectedExtraExactLookupsUpper > 0.0 &&
        ev.expectedExtraExactLookupsUpper < a->extraExactLookupsBudget;

    ev.accepted =
        ev.parameterSanity &&
        ev.indexAgreement &&
        ev.expIntervalCertificate &&
        ev.withinFpRateBudget &&
        ev.withinExactLookupBudget &&
        same_policy(a->maybePositivePolicy, ":ConfirmAgainstCanonicalGraph") &&
        same_policy(a->definiteNegativePolicy, ":ReturnAbsent");

    return ev;
}

int main(void) {
    const Artifact artifact = {
        .name = ":artifact",
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

    const Evaluation ev = evaluate_artifact(&artifact);

    printf("@prefix : <http://example.org/high-trust-rdf#> .\n");
    printf("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n");

    if (ev.expIntervalCertificate) {
        printf(":result :expIntervalCertificate :CertifiedDecimalInterval .\n");
    }

    if (ev.accepted) {
        printf(":result :summary (\"parameter-sanity\" true ");
        printf("\"index-agreement\" true ");
        printf("\"transcendental\" \"%s\" ", artifact.exactTranscendentalSymbol);
        printf("\"lambda\" \"%.10f\"^^xsd:decimal ", ev.lambda);
        printf("\"certified-lambda\" %.10f ", artifact.certifiedLambda);
        printf("\"exp-lower\" %.10f ", artifact.expMinusLambdaLower);
        printf("\"exp-upper\" %.10f ", artifact.expMinusLambdaUpper);
        printf("\"fp-lower\" \"%.19f\"^^xsd:decimal ", ev.fpRateLower);
        printf("\"fp-upper\" \"%.19f\"^^xsd:decimal ", ev.fpRateUpper);
        printf("\"expected-extra-exact-lookups-upper\" \"%.14f\"^^xsd:decimal ",
               ev.expectedExtraExactLookupsUpper);
        printf("\"decision\" :AcceptForHighTrustUse) .\n");
    }

    if (ev.withinExactLookupBudget) {
        printf(":result :withinExactLookupBudget true .\n");
    }

    if (ev.withinFpRateBudget) {
        printf(":result :withinFpRateBudget true .\n");
    }

    return 0;
}
