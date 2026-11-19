import type { BackoffStrategy } from "@openrouter/sdk/lib/retries";

import type { JudgmentThresholds } from "./types";

export const decisionModel = "liquid/d1.2-ultra";
export const generatedRelationDocumentPath = "documentation/src/data/generated/rule-relations.json";
export const judgmentBatchSize = 10;
export const judgmentPromptVersion = 2;

// `relatedness` is tuned for `decisionModel`: 0.5 means the model rates
// "publish" as more likely than not, and liquid/d1.2-ultra puts real
// relationships at 0.5 to 0.93. Re-check it when `decisionModel` changes.
export const judgmentThresholds = { accept: 0.8, relatedness: 0.5, review: 0.55 } satisfies JudgmentThresholds;

export const maxReasonAttempts = 3;
export const maxReasonLength = 160;
export const maxRelationsPerRule = 8;
export const reasonModel = "meta/muse-ember";
export const reasonPromptVersion = 2;
export const relationGeneratorPath = "scripts/regenerate-relations.ts";
export const requestConcurrency = 4;

// Milliseconds. The SDK waits Retry-After when sent, capped at maxInterval.
export const requestRetryBackoff = {
	exponent: 2,
	initialInterval: 1_000,
	maxElapsedTime: 5 * 60_000,
	maxInterval: 60_000,
} satisfies BackoffStrategy;

// The SDK default is ["5XX"], which leaves 429 unretried.
export const requestRetryCodes: ReadonlyArray<string> = ["429", "5XX"];
export const reviewReportPath = "reports/rule-relations.review.json";
