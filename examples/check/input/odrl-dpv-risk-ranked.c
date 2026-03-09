#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ARRAY_LEN(x) (sizeof(x) / sizeof((x)[0]))

static const char *PREFIX_LINE_1 = "@prefix : <https://example.org/odrl-dpv-risk-ranked#> .\n";
static const char *PREFIX_LINE_2 = "@prefix log: <http://www.w3.org/2000/10/swap/log#> .\n\n";

typedef struct {
    const char *id;
    int importance;
    int minNoticeDays;
} Need;

typedef struct {
    const char *id;
    const char *text;
    const char *action;
    bool hasNoticeConstraint;
    bool hasInformDuty;
    int noticeDays;
    bool hasConsentConstraint;
    bool isProhibition;
} Clause;

typedef struct {
    const char *riskId;
    const char *mitigationIds[2];
    size_t mitigationCount;
    const char *clauseId;
    const char *description;
    const char *level;
    const char *severity;
    int score;
    int inverseScore;
    const char *mitigationText[2];
} RankedRisk;

static int compare_ranked_risks(const void *lhs, const void *rhs) {
    const RankedRisk *a = (const RankedRisk *)lhs;
    const RankedRisk *b = (const RankedRisk *)rhs;

    if (a->inverseScore != b->inverseScore) {
        return a->inverseScore - b->inverseScore;
    }
    return strcmp(a->clauseId, b->clauseId);
}

static int capped_score(int raw) {
    return raw > 100 ? 100 : raw;
}

static void add_delete_account_risk(const Clause *clause, const Need *need, RankedRisk *out, size_t *count) {
    if (strcmp(clause->action, "removeAccount") != 0) {
        return;
    }
    if (clause->hasNoticeConstraint || clause->hasInformDuty) {
        return;
    }

    RankedRisk risk;
    memset(&risk, 0, sizeof(risk));
    risk.riskId = "_:sk_1";
    risk.mitigationIds[0] = "_:sk_2";
    risk.mitigationIds[1] = "_:sk_4";
    risk.mitigationCount = 2;
    risk.clauseId = clause->id;
    risk.score = capped_score(90 + need->importance);
    risk.inverseScore = 1000 - risk.score;
    risk.level = "https://w3id.org/dpv/risk#HighRisk";
    risk.severity = "https://w3id.org/dpv/risk#HighSeverity";
    risk.description =
        "Risk: account/data removal is permitted without notice safeguards "
        "(no notice constraint and no duty to inform). Clause C1: Provider may remove "
        "the user account (and associated data) at its discretion.";
    risk.mitigationText[0] = "Add a notice constraint (minimum noticeDays) before account removal.";
    risk.mitigationText[1] = "Add a duty to inform the consumer prior to account removal.";
    out[(*count)++] = risk;
}

static void add_notice_too_short_risk(const Clause *clause, const Need *need, RankedRisk *out, size_t *count) {
    if (strcmp(clause->action, "changeTerms") != 0) {
        return;
    }
    if (!clause->hasInformDuty) {
        return;
    }
    if (!(clause->noticeDays < need->minNoticeDays)) {
        return;
    }

    RankedRisk risk;
    memset(&risk, 0, sizeof(risk));
    risk.riskId = "_:sk_7";
    risk.mitigationIds[0] = "_:sk_8";
    risk.mitigationCount = 1;
    risk.clauseId = clause->id;
    risk.score = capped_score(70 + need->importance);
    risk.inverseScore = 1000 - risk.score;
    risk.level = "https://w3id.org/dpv/risk#HighRisk";
    risk.severity = "https://w3id.org/dpv/risk#HighSeverity";
    risk.description =
        "Risk: terms may change with notice (3 days) below consumer requirement (14 days). "
        "Clause C2: Provider may change terms by informing users at least 3 days in advance.";
    risk.mitigationText[0] = "Increase minimum noticeDays in the inform duty to meet the consumer requirement.";
    out[(*count)++] = risk;
}

static void add_share_no_consent_risk(const Clause *clause, const Need *need, RankedRisk *out, size_t *count) {
    if (strcmp(clause->action, "shareData") != 0) {
        return;
    }
    if (clause->hasConsentConstraint) {
        return;
    }

    RankedRisk risk;
    memset(&risk, 0, sizeof(risk));
    risk.riskId = "_:sk_12";
    risk.mitigationIds[0] = "_:sk_13";
    risk.mitigationCount = 1;
    risk.clauseId = clause->id;
    risk.score = capped_score(85 + need->importance);
    risk.inverseScore = 1000 - risk.score;
    risk.level = "https://w3id.org/dpv/risk#HighRisk";
    risk.severity = "https://w3id.org/dpv/risk#HighSeverity";
    risk.description =
        "Risk: user data sharing is permitted without an explicit consent constraint. "
        "Clause C3: Provider may share user data with partners for business purposes.";
    risk.mitigationText[0] = "Add an explicit consent constraint before data sharing.";
    out[(*count)++] = risk;
}

static void add_no_portability_risk(const Clause *clause, const Need *need, RankedRisk *out, size_t *count) {
    if (!clause->isProhibition || strcmp(clause->action, "exportData") != 0) {
        return;
    }

    RankedRisk risk;
    memset(&risk, 0, sizeof(risk));
    risk.riskId = "_:sk_16";
    risk.mitigationIds[0] = "_:sk_17";
    risk.mitigationCount = 1;
    risk.clauseId = clause->id;
    risk.score = capped_score(60 + need->importance);
    risk.inverseScore = 1000 - risk.score;
    risk.level = "https://w3id.org/dpv/risk#ModerateRisk";
    risk.severity = "https://w3id.org/dpv/risk#ModerateSeverity";
    risk.description =
        "Risk: portability is restricted because exporting user data is prohibited. "
        "Clause C4: Users are not permitted to export their data.";
    risk.mitigationText[0] = "Add a permission allowing data export (or remove the prohibition) to support portability.";
    out[(*count)++] = risk;
}

static void print_header(void) {
    printf("(:Agreement1 :ConsumerExample 0) log:outputString ");
    printf("\"\\n=== Ranked DPV Risk Report ===\\nAgreement: Example Agreement\\nProfile: Example consumer profile\\n\\n\" .\n");
}

static void print_risk_line(const RankedRisk *risk) {
    printf("(:Agreement1 :ConsumerExample 1 %d \"%s\" 0 %s) log:outputString ",
           risk->inverseScore,
           risk->clauseId,
           risk->riskId);
    printf("\"score=%d (%s, %s)  clause %s\\n  %s\\n\\n\" .\n",
           risk->score,
           risk->level,
           risk->severity,
           risk->clauseId,
           risk->description);
}

static void print_mitigation_lines(const RankedRisk *risk) {
    for (size_t i = 0; i < risk->mitigationCount; ++i) {
        printf("(:Agreement1 :ConsumerExample 1 %d \"%s\" 1 %s %s) log:outputString ",
               risk->inverseScore,
               risk->clauseId,
               risk->riskId,
               risk->mitigationIds[i]);
        printf("\"  - mitigation for clause %s: %s\\n\" .\n",
               risk->clauseId,
               risk->mitigationText[i]);
    }
}

int main(void) {
    const Need needDataCannotBeRemoved = {
        .id = "Need_DataCannotBeRemoved",
        .importance = 20,
        .minNoticeDays = 0
    };
    const Need needChangeOnlyWithPriorNotice = {
        .id = "Need_ChangeOnlyWithPriorNotice",
        .importance = 15,
        .minNoticeDays = 14
    };
    const Need needNoSharingWithoutConsent = {
        .id = "Need_NoSharingWithoutConsent",
        .importance = 12,
        .minNoticeDays = 0
    };
    const Need needDataPortability = {
        .id = "Need_DataPortability",
        .importance = 10,
        .minNoticeDays = 0
    };

    const Clause clauses[] = {
        {
            .id = "C1",
            .text = "Provider may remove the user account (and associated data) at its discretion.",
            .action = "removeAccount",
            .hasNoticeConstraint = false,
            .hasInformDuty = false,
            .noticeDays = 0,
            .hasConsentConstraint = false,
            .isProhibition = false
        },
        {
            .id = "C2",
            .text = "Provider may change terms by informing users at least 3 days in advance.",
            .action = "changeTerms",
            .hasNoticeConstraint = true,
            .hasInformDuty = true,
            .noticeDays = 3,
            .hasConsentConstraint = false,
            .isProhibition = false
        },
        {
            .id = "C3",
            .text = "Provider may share user data with partners for business purposes.",
            .action = "shareData",
            .hasNoticeConstraint = false,
            .hasInformDuty = false,
            .noticeDays = 0,
            .hasConsentConstraint = false,
            .isProhibition = false
        },
        {
            .id = "C4",
            .text = "Users are not permitted to export their data.",
            .action = "exportData",
            .hasNoticeConstraint = false,
            .hasInformDuty = false,
            .noticeDays = 0,
            .hasConsentConstraint = false,
            .isProhibition = true
        }
    };

    RankedRisk risks[8];
    size_t riskCount = 0;

    for (size_t i = 0; i < ARRAY_LEN(clauses); ++i) {
        add_delete_account_risk(&clauses[i], &needDataCannotBeRemoved, risks, &riskCount);
        add_notice_too_short_risk(&clauses[i], &needChangeOnlyWithPriorNotice, risks, &riskCount);
        add_share_no_consent_risk(&clauses[i], &needNoSharingWithoutConsent, risks, &riskCount);
        add_no_portability_risk(&clauses[i], &needDataPortability, risks, &riskCount);
    }

    qsort(risks, riskCount, sizeof(risks[0]), compare_ranked_risks);

    fputs(PREFIX_LINE_1, stdout);
    fputs(PREFIX_LINE_2, stdout);
    print_header();
    for (size_t i = 0; i < riskCount; ++i) {
        print_risk_line(&risks[i]);
        print_mitigation_lines(&risks[i]);
    }

    return 0;
}
