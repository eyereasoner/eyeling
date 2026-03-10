#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

#define BIG_BASE 1000000000u

typedef struct {
    uint32_t *d;
    size_t len;
    size_t cap;
} BigInt;

static void die(const char *msg) {
    fputs(msg, stderr);
    fputc('\n', stderr);
    exit(EXIT_FAILURE);
}

static void bi_init(BigInt *a, unsigned int value) {
    a->cap = 4;
    a->len = 1;
    a->d = (uint32_t *)calloc(a->cap, sizeof(uint32_t));
    if (!a->d) die("out of memory");
    a->d[0] = value;
}

static void bi_reserve(BigInt *a, size_t need) {
    if (need <= a->cap) return;
    size_t cap = a->cap;
    while (cap < need) cap *= 2;
    uint32_t *p = (uint32_t *)realloc(a->d, cap * sizeof(uint32_t));
    if (!p) die("out of memory");
    memset(p + a->cap, 0, (cap - a->cap) * sizeof(uint32_t));
    a->d = p;
    a->cap = cap;
}

static void bi_trim(BigInt *a) {
    while (a->len > 1 && a->d[a->len - 1] == 0) a->len--;
}

static void bi_mul_small(BigInt *a, unsigned int m) {
    uint64_t carry = 0;
    for (size_t i = 0; i < a->len; i++) {
        uint64_t cur = (uint64_t)a->d[i] * m + carry;
        a->d[i] = (uint32_t)(cur % BIG_BASE);
        carry = cur / BIG_BASE;
    }
    while (carry) {
        bi_reserve(a, a->len + 1);
        a->d[a->len++] = (uint32_t)(carry % BIG_BASE);
        carry /= BIG_BASE;
    }
}

static void bi_add_small(BigInt *a, unsigned int add) {
    uint64_t carry = add;
    size_t i = 0;
    while (carry) {
        if (i == a->len) {
            bi_reserve(a, a->len + 1);
            a->d[a->len++] = 0;
        }
        uint64_t cur = (uint64_t)a->d[i] + carry;
        a->d[i] = (uint32_t)(cur % BIG_BASE);
        carry = cur / BIG_BASE;
        i++;
    }
}

static void bi_sub_small(BigInt *a, unsigned int sub) {
    uint64_t borrow = sub;
    size_t i = 0;
    while (borrow) {
        if (i >= a->len) die("underflow");
        uint64_t cur = a->d[i];
        uint64_t part = borrow % BIG_BASE;
        borrow /= BIG_BASE;
        if (cur < part) {
            a->d[i] = (uint32_t)(cur + BIG_BASE - part);
            borrow += 1;
        } else {
            a->d[i] = (uint32_t)(cur - part);
        }
        i++;
    }
    bi_trim(a);
}

static unsigned int bi_to_uint(const BigInt *a) {
    if (a->len == 0) return 0;
    if (a->len > 2) die("value too large for unsigned int");
    uint64_t v = a->d[0];
    if (a->len == 2) v += (uint64_t)a->d[1] * BIG_BASE;
    if (v > 0xffffffffu) die("value too large for unsigned int");
    return (unsigned int)v;
}

static char *bi_to_string(const BigInt *a) {
    size_t bytes = a->len * 10 + 1;
    char *s = (char *)malloc(bytes);
    if (!s) die("out of memory");
    int n = snprintf(s, bytes, "%u", a->d[a->len - 1]);
    if (n < 0) die("snprintf failed");
    size_t pos = (size_t)n;
    for (size_t i = a->len - 1; i-- > 0;) {
        n = snprintf(s + pos, bytes - pos, "%09u", a->d[i]);
        if (n < 0) die("snprintf failed");
        pos += (size_t)n;
    }
    return s;
}

static void bi_free(BigInt *a) {
    free(a->d);
    a->d = NULL;
    a->len = 0;
    a->cap = 0;
}

static BigInt bi_pow2(unsigned int exp) {
    BigInt r;
    bi_init(&r, 1);
    for (unsigned int i = 0; i < exp; i++) bi_mul_small(&r, 2);
    return r;
}

/* Independent evaluator for the fixed-z hyperoperation chain used by
   examples/ackermann.n3:
     A(x,y) = H(x, y+3, 2) - 3
   where H(0,y,2)=y+1, H(1,y,2)=y+2, H(2,y,2)=2y, H(3,y,2)=2^y,
   and H(x,0,2)=1 for x>3, H(x,y,2)=H(x-1, H(x,y-1,2), 2).
*/
static BigInt hyper2(unsigned int x, unsigned int y) {
    if (x == 0) {
        BigInt r;
        bi_init(&r, y + 1);
        return r;
    }
    if (x == 1) {
        BigInt r;
        bi_init(&r, y + 2);
        return r;
    }
    if (x == 2) {
        BigInt r;
        bi_init(&r, 2u * y);
        return r;
    }
    if (x == 3) {
        return bi_pow2(y);
    }
    if (y == 0) {
        BigInt r;
        bi_init(&r, 1);
        return r;
    }

    BigInt inner = hyper2(x, y - 1);
    unsigned int inner_u = bi_to_uint(&inner);
    bi_free(&inner);
    return hyper2(x - 1, inner_u);
}

static BigInt ackermann2(unsigned int x, unsigned int y) {
    BigInt r = hyper2(x, y + 3);
    bi_sub_small(&r, 3);
    return r;
}

static void print_line(unsigned int x, unsigned int y) {
    BigInt v = ackermann2(x, y);
    char *s = bi_to_string(&v);
    printf("    (%u %u) :ackermann %s .\n", x, y, s);
    free(s);
    bi_free(&v);
}

int main(void) {
    puts("@prefix : <https://eyereasoner.github.io/ns#> .");
    puts("");
    puts(":test :is {");
    print_line(0, 0);
    print_line(0, 6);
    print_line(1, 2);
    print_line(1, 7);
    print_line(2, 2);
    print_line(2, 9);
    print_line(3, 4);
    print_line(3, 1000);
    print_line(4, 0);
    print_line(4, 1);
    print_line(4, 2);
    print_line(5, 0);
    puts("} .");
    return 0;
}
