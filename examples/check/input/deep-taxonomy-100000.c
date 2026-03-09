#include <stdio.h>
#include <stdlib.h>

int main(void) {
    if (printf("@prefix : <http://eulersharp.sourceforge.net/2009/12dtb/test#> .\n\n") < 0) {
        return EXIT_FAILURE;
    }

    for (int i = 1; i <= 100000; i++) {
        if (printf(":ind a :N%d .\n:ind a :I%d .\n:ind a :J%d .\n", i, i, i) < 0) {
            return EXIT_FAILURE;
        }
    }

    if (printf(":ind a :A2 .\n:test :is true .\n") < 0) {
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
