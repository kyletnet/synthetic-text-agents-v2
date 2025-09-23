export type Rule = {
    type: "length_max_tokens";
    value: number;
    reason: string;
} | {
    type: "forbid_terms";
    value: string[];
    reason: string;
} | {
    type: "tone_primary";
    value: "elementary" | "neutral";
    reason: string;
} | {
    type: "vary_sentence_forms";
    value: boolean;
    reason: string;
} | {
    type: "must_include_topic_terms";
    value: string[];
    reason: string;
};
export interface PromptSpec {
    topic: string;
    rules: Rule[];
    humanSummary: string;
}
export declare function inferRulesFromFeedback(feedback: string, topicTerms?: string[]): Rule[];
export declare function mergeRules(base: Rule[], extra: Rule[]): Rule[];
export declare function rulesHumanSummary(rules: Rule[]): string;
export declare function applyRulesToPrompt(basePrompt: string, rules: Rule[]): string;
//# sourceMappingURL=rulesEngine.d.ts.map