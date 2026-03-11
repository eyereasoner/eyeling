#include <locale.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N 8
#define EPS 1e-12

/* ==================================================== */
/* Fast Fourier Transform (FFT) in C                    */
/* Input sequence: (0 1 2 3 4 5 6 7)                    */
/* Numeric version with explicit complex pairs (re, im) */
/* Emits the final N3 result expected by examples/check */
/* ==================================================== */

typedef struct {
    double re;
    double im;
} Complex;

/* ---------------------------------------------------- */
/* 8th roots of unity: W8^k = exp(-2*pi*i*k/8)          */
/* ---------------------------------------------------- */

static const Complex W8[N] = {
    {1.0, 0.0},
    {0.7071067811865476, -0.7071067811865476},
    {0.0, -1.0},
    {-0.7071067811865476, -0.7071067811865476},
    {-1.0, 0.0},
    {-0.7071067811865476, 0.7071067811865476},
    {0.0, 1.0},
    {0.7071067811865476, 0.7071067811865476}
};

/* ---------------------------------------------------- */
/* Complex arithmetic                                   */
/* ---------------------------------------------------- */

static Complex c_add(Complex a, Complex b) {
    Complex out = {a.re + b.re, a.im + b.im};
    return out;
}

static Complex c_mul(Complex a, Complex b) {
    Complex out = {
        a.re * b.re - a.im * b.im,
        a.re * b.im + a.im * b.re
    };
    return out;
}

/* ---------------------------------------------------- */
/* Numeric radix-2 FFT evaluator                        */
/* ---------------------------------------------------- */

static Complex fft_pair_1(const double *x, int p) {
    (void)p;

    /* A list of length 1 becomes the complex number (x, 0). */
    Complex out = {x[0], 0.0};
    return out;
}

static Complex fft_pair_2(const double *x, int p) {
    int child_p = (2 * p) % N;
    Complex lhs = fft_pair_1(&x[0], child_p);
    Complex rhs = fft_pair_1(&x[1], child_p);
    Complex tw = c_mul(W8[p], rhs);
    return c_add(lhs, tw);
}

static Complex fft_pair_4(const double *x, int p) {
    int child_p = (2 * p) % N;
    double even[2] = {x[0], x[2]};
    double odd[2] = {x[1], x[3]};

    /* Split into even and odd positions. */
    Complex lhs = fft_pair_2(even, child_p);
    Complex rhs = fft_pair_2(odd, child_p);
    Complex tw = c_mul(W8[p], rhs);
    return c_add(lhs, tw);
}

static Complex fft_pair_8(const double *x, int p) {
    int child_p = (2 * p) % N;
    double even[4] = {x[0], x[2], x[4], x[6]};
    double odd[4] = {x[1], x[3], x[5], x[7]};

    /* Split into even and odd positions. */
    Complex lhs = fft_pair_4(even, child_p);
    Complex rhs = fft_pair_4(odd, child_p);
    Complex tw = c_mul(W8[p], rhs);
    return c_add(lhs, tw);
}

/* ---------------------------------------------------- */
/* Decimal formatting for xsd:decimal                   */
/* ---------------------------------------------------- */

static double canonicalize(double x) {
    double nearest;

    if (fabs(x) <= EPS) {
        return 0.0;
    }

    nearest = round(x);
    if (fabs(x - nearest) <= EPS) {
        return nearest;
    }

    return x;
}

static void format_decimal(double x, char *buf, size_t size) {
    int precision;

    x = canonicalize(x);

    for (precision = 1; precision <= 17; ++precision) {
        char candidate[64];
        char *end;
        double parsed;

        snprintf(candidate, sizeof(candidate), "%.*g", precision, x);
        if (strchr(candidate, 'e') != NULL || strchr(candidate, 'E') != NULL) {
            continue;
        }

        parsed = strtod(candidate, &end);
        if (*end == '\0' && parsed == x) {
            snprintf(buf, size, "%s", candidate);
            return;
        }
    }

    /* Fallback for unusual values; still avoid exponent notation. */
    snprintf(buf, size, "%.17f", x);
    if (strchr(buf, '.') != NULL) {
        size_t len = strlen(buf);
        while (len > 0 && buf[len - 1] == '0') {
            buf[--len] = '\0';
        }
        if (len > 0 && buf[len - 1] == '.') {
            buf[--len] = '\0';
        }
    }
    if (strcmp(buf, "-0") == 0) {
        snprintf(buf, size, "0");
    }
}

/* ---------------------------------------------------- */
/* Main                                                 */
/* ---------------------------------------------------- */

int main(void) {
    const double input[N] = {0, 1, 2, 3, 4, 5, 6, 7};
    Complex out[N];
    int k;

    setlocale(LC_NUMERIC, "C");

    for (k = 0; k < N; ++k) {
        out[k] = fft_pair_8(input, k);
    }

    puts("@prefix : <http://example.org/fft8#> .");
    puts("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .");
    putchar('\n');

    printf(":result :fft (");
    for (k = 0; k < N; ++k) {
        char re_buf[64];
        char im_buf[64];

        format_decimal(out[k].re, re_buf, sizeof(re_buf));
        format_decimal(out[k].im, im_buf, sizeof(im_buf));

        if (k > 0) {
            putchar(' ');
        }
        printf("(\"%s\"^^xsd:decimal \"%s\"^^xsd:decimal)", re_buf, im_buf);
    }
    puts(") .");

    return 0;
}
