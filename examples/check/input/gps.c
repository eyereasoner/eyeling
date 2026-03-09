#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *from;
    const char *to;
    const char *action;
    double duration;
    double cost;
    double belief;
    double comfort;
} Edge;

typedef struct {
    const char *actions[8];
    int action_count;
    double duration;
    double cost;
    double belief;
    double comfort;
} Path;

static const Edge EDGES[] = {
    {"Gent", "Brugge",   ":drive_gent_brugge",    1500.0, 0.006, 0.96, 0.99},
    {"Gent", "Kortrijk", ":drive_gent_kortrijk",  1600.0, 0.007, 0.96, 0.99},
    {"Kortrijk", "Brugge", ":drive_kortrijk_brugge", 1600.0, 0.007, 0.96, 0.99},
    {"Brugge", "Oostende", ":drive_brugge_oostende", 900.0, 0.004, 0.98, 1.0}
};

static void print_decimal(double value) {
    char buf[64];
    snprintf(buf, sizeof(buf), "%.15f", value);
    char *p = buf + strlen(buf) - 1;
    while (p > buf && *p == '0') {
        *p-- = '\0';
    }
    if (p > buf && *p == '.') {
        *p = '\0';
    }
    printf("\"%s\"^^xsd:decimal", buf);
}

static int contains_city(const char *visited[], int visited_count, const char *city) {
    for (int i = 0; i < visited_count; ++i) {
        if (strcmp(visited[i], city) == 0) {
            return 1;
        }
    }
    return 0;
}

static void emit_path(const Path *path) {
    printf(":i1 gps:path ((");
    for (int i = 0; i < path->action_count; ++i) {
        if (i > 0) {
            putchar(' ');
        }
        fputs(path->actions[i], stdout);
    }
    printf(") ");
    print_decimal(path->duration);
    printf(" ");
    print_decimal(path->cost);
    printf(" ");
    print_decimal(path->belief);
    printf(" ");
    print_decimal(path->comfort);
    printf(") .\n");
}

static void dfs(const char *current,
                const char *goal,
                const char *visited[],
                int visited_count,
                Path *path) {
    if (strcmp(current, goal) == 0) {
        emit_path(path);
        return;
    }

    for (size_t i = 0; i < sizeof(EDGES) / sizeof(EDGES[0]); ++i) {
        const Edge *e = &EDGES[i];
        if (strcmp(e->from, current) != 0) {
            continue;
        }
        if (contains_city(visited, visited_count, e->to)) {
            continue;
        }

        path->actions[path->action_count++] = e->action;
        path->duration += e->duration;
        path->cost += e->cost;
        path->belief *= e->belief;
        path->comfort *= e->comfort;

        const char *next_visited[16];
        for (int j = 0; j < visited_count; ++j) {
            next_visited[j] = visited[j];
        }
        next_visited[visited_count] = e->to;

        dfs(e->to, goal, next_visited, visited_count + 1, path);

        path->action_count--;
        path->duration -= e->duration;
        path->cost -= e->cost;
        path->belief /= e->belief;
        path->comfort /= e->comfort;
    }
}

int main(void) {
    puts("@prefix : <https://eyereasoner.github.io/eye/reasoning#> .");
    puts("@prefix gps: <https://eyereasoner.github.io/eye/reasoning/gps/gps-schema#> .");
    puts("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .");
    putchar('\n');

    Path path;
    memset(&path, 0, sizeof(path));
    path.belief = 1.0;
    path.comfort = 1.0;

    const char *visited[] = {"Gent"};
    dfs("Gent", "Oostende", visited, 1, &path);
    return 0;
}
