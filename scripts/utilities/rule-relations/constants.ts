import type { JudgmentThresholds } from "./types";

export const decisionModel = "~typesafe/jev-latest";
export const generatedRelationDocumentPath = "documentation/src/data/generated/rule-relations.json";
export const judgmentBatchSize = 10;
export const judgmentPromptVersion = 1;
export const judgmentThresholds = { accept: 0.8, review: 0.55 } satisfies JudgmentThresholds;
export const maxReasonLength = 160;
export const maxRelationsPerRule = 8;
export const reasonModel = "z-ai/glm-5.3-flash";
export const reasonPromptVersion = 1;
export const relationGeneratorPath = "scripts/regenerate-relations.ts";
