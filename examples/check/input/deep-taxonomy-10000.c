#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum { DEPTH = 10000 };

static int emit(const char *s) {
    return fputs(s, stdout) != EOF;
}

static int emit_type(const char *kind, int index) {
    return printf(":ind a :%s%d .\n", kind, index) >= 0;
}

int main(void) {
    unsigned char hasN[DEPTH + 1];
    unsigned char hasI[DEPTH + 1];
    unsigned char hasJ[DEPTH + 1];
    unsigned char hasA2 = 0;
    unsigned char hasTest = 0;
    int changed = 1;

    memset(hasN, 0, sizeof(hasN));
    memset(hasI, 0, sizeof(hasI));
    memset(hasJ, 0, sizeof(hasJ));

    /* fact: :ind a :N0. */
    hasN[0] = 1;

    /*
     * Forward-chain the rules to a fixpoint.
     *
     * {?X a :N0}      => {?X a :N1,      :I1,      :J1}.
     * {?X a :N1}      => {?X a :N2,      :I2,      :J2}.
     * ...
     * {?X a :N9999}  => {?X a :N10000, :I10000, :J10000}.
     * {?X a :N10000} => {?X a :A2}.
     * {:ind a :A2}    => {:test :is true}.
     */
    while (changed) {
        changed = 0;

        for (int i = 0; i < DEPTH; i++) {
            if (!hasN[i]) {
                continue;
            }

            if (!hasN[i + 1]) {
                hasN[i + 1] = 1;
                changed = 1;
            }
            if (!hasI[i + 1]) {
                hasI[i + 1] = 1;
                changed = 1;
            }
            if (!hasJ[i + 1]) {
                hasJ[i + 1] = 1;
                changed = 1;
            }
        }

        if (hasN[DEPTH] && !hasA2) {
            hasA2 = 1;
            changed = 1;
        }

        if (hasA2 && !hasTest) {
            hasTest = 1;
            changed = 1;
        }
    }

    if (!emit("@prefix : <http://eulersharp.sourceforge.net/2009/12dtb/test#> .\n\n")) {
        return EXIT_FAILURE;
    }

    for (int i = 1; i <= DEPTH; i++) {
        if (!hasN[i] || !hasI[i] || !hasJ[i]) {
            fprintf(stderr, "incomplete closure at depth %d\n", i);
            return EXIT_FAILURE;
        }
        if (!emit_type("N", i) || !emit_type("I", i) || !emit_type("J", i)) {
            return EXIT_FAILURE;
        }
    }

    if (!hasA2 || !hasTest) {
        fputs("expected conclusions were not derived\n", stderr);
        return EXIT_FAILURE;
    }

    if (!emit(":ind a :A2 .\n:test :is true .\n")) {
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
