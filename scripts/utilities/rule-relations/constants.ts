import type { JudgmentThresholds } from "./types";

export const decisionModel = "liquid/d1.2-ultra";
export const generatedRelationDocumentPath = "documentation/src/data/generated/rule-relations.json";
export const judgmentBatchSize = 10;
export const judgmentPromptVersion = 2;
export const judgmentThresholds = { accept: 0.8, review: 0.55 } satisfies JudgmentThresholds;
export const maxReasonLength = 160;
export const maxRelationsPerRule = 8;
export const reasonModel = "meta/muse-ember";
export const reasonPromptVersion = 1;
export const relationGeneratorPath = "scripts/regenerate-relations.ts";
