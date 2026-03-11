#include <stdio.h>
#include <stdlib.h>

#define N 8
#define ARENA_CAPACITY 4096

/* ==================================================== */
/* Fast Fourier Transform (FFT) in C                    */
/* Input sequence: (0 1 2 3 4 5 6 7)                    */
/* Symbolic radix-2 FFT                                 */
/* Emits the exact N3 result expected by examples/output */
/* ==================================================== */

typedef enum {
    EXPR_LEAF,
    EXPR_TWIDDLE,
    EXPR_MUL,
    EXPR_ADD
} ExprKind;

typedef struct Expr Expr;

struct Expr {
    ExprKind kind;
    int value;
    const char *root;
    const Expr *left;
    const Expr *right;
};

static Expr arena[ARENA_CAPACITY];
static size_t arena_size = 0;

/* ---------------------------------------------------- */
/* Symbolic constructors                                */
/* ---------------------------------------------------- */

static const Expr *new_expr(ExprKind kind, int value, const char *root,
                            const Expr *left, const Expr *right) {
    if (arena_size >= ARENA_CAPACITY) {
        fputs("arena overflow\n", stderr);
        exit(EXIT_FAILURE);
    }

    arena[arena_size].kind = kind;
    arena[arena_size].value = value;
    arena[arena_size].root = root;
    arena[arena_size].left = left;
    arena[arena_size].right = right;
    return &arena[arena_size++];
}

static const Expr *make_leaf(int value) {
    return new_expr(EXPR_LEAF, value, NULL, NULL, NULL);
}

static const Expr *make_twiddle(const char *root, int power) {
    return new_expr(EXPR_TWIDDLE, power, root, NULL, NULL);
}

static const Expr *make_mul(const Expr *left, const Expr *right) {
    return new_expr(EXPR_MUL, 0, NULL, left, right);
}

static const Expr *make_add(const Expr *left, const Expr *right) {
    return new_expr(EXPR_ADD, 0, NULL, left, right);
}

/* ---------------------------------------------------- */
/* Symbolic radix-2 FFT evaluator                       */
/* ---------------------------------------------------- */

static const Expr *fft_expr_1(const int *x, const char *root, int p, int n) {
    (void)root;
    (void)p;
    (void)n;

    /* A list of length 1 is turned into a leaf node. */
    return make_leaf(x[0]);
}

static const Expr *fft_expr_2(const int *x, const char *root, int p, int n) {
    int child_p = (2 * p) % n;
    const Expr *lhs = fft_expr_1(&x[0], root, child_p, n);
    const Expr *rhs = fft_expr_1(&x[1], root, child_p, n);
    const Expr *tw = make_twiddle(root, p);
    return make_add(lhs, make_mul(tw, rhs));
}

static const Expr *fft_expr_4(const int *x, const char *root, int p, int n) {
    int child_p = (2 * p) % n;
    int even[2] = {x[0], x[2]};
    int odd[2] = {x[1], x[3]};

    /* Split the input into even and odd positions. */
    const Expr *lhs = fft_expr_2(even, root, child_p, n);
    const Expr *rhs = fft_expr_2(odd, root, child_p, n);
    const Expr *tw = make_twiddle(root, p);
    return make_add(lhs, make_mul(tw, rhs));
}

static const Expr *fft_expr_8(const int *x, const char *root, int p, int n) {
    int child_p = (2 * p) % n;
    int even[4] = {x[0], x[2], x[4], x[6]};
    int odd[4] = {x[1], x[3], x[5], x[7]};

    /* Split the input into even and odd positions. */
    const Expr *lhs = fft_expr_4(even, root, child_p, n);
    const Expr *rhs = fft_expr_4(odd, root, child_p, n);
    const Expr *tw = make_twiddle(root, p);
    return make_add(lhs, make_mul(tw, rhs));
}

/* ---------------------------------------------------- */
/* Printing                                             */
/* ---------------------------------------------------- */

static void print_expr(const Expr *e) {
    switch (e->kind) {
        case EXPR_LEAF:
            printf("(:leaf %d)", e->value);
            break;
        case EXPR_TWIDDLE:
            printf("(:twiddle %s %d)", e->root, e->value);
            break;
        case EXPR_MUL:
            printf("(:mul ");
            print_expr(e->left);
            putchar(' ');
            print_expr(e->right);
            putchar(')');
            break;
        case EXPR_ADD:
            printf("(:add ");
            print_expr(e->left);
            putchar(' ');
            print_expr(e->right);
            putchar(')');
            break;
    }
}

/* ---------------------------------------------------- */
/* Main                                                 */
/* ---------------------------------------------------- */

int main(void) {
    const int input[N] = {0, 1, 2, 3, 4, 5, 6, 7};
    const char *root = ":omega";
    int k;

    puts("@prefix : <http://example.org/fft8#> .");
    putchar('\n');
    printf(":result :fft (");
    for (k = 0; k < N; ++k) {
        const Expr *out = fft_expr_8(input, root, k, N);
        if (k > 0) {
            putchar(' ');
        }
        print_expr(out);
    }
    puts(") .");

    return 0;
}
