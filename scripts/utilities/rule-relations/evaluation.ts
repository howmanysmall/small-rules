import { getPairKey } from "./types";

import type { RuleRelationKind } from "$data/rule-relations";

import type { RelationResolution, UnorderedRulePair } from "./types";

export interface EvaluationReport {
	readonly falseNegatives: number;
	readonly falsePositives: number;
	readonly kindMismatches: number;
	readonly trueNegatives: number;
	readonly truePositives: number;
}

interface EvaluateOptions {
	readonly expectedNegatives: ReadonlyArray<UnorderedRulePair>;
	readonly expectedPositives: ReadonlyArray<{
		readonly kind: RuleRelationKind;
		readonly pair: UnorderedRulePair;
	}>;
	readonly resolutions: ReadonlyMap<string, RelationResolution>;
}

export function evaluatePairs(options: EvaluateOptions): EvaluationReport {
	let falseNegatives = 0;
	let falsePositives = 0;
	let kindMismatches = 0;
	let trueNegatives = 0;
	let truePositives = 0;

	for (const expected of options.expectedPositives) {
		const resolution = options.resolutions.get(getPairKey(expected.pair.left, expected.pair.right));
		if (resolution?.type === "relation") {
			truePositives += 1;
			if (resolution.relation.kind !== expected.kind) kindMismatches += 1;
		} else falseNegatives += 1;
	}

	for (const expected of options.expectedNegatives) {
		const resolution = options.resolutions.get(getPairKey(expected.left, expected.right));
		if (resolution?.type === "relation") falsePositives += 1;
		else trueNegatives += 1;
	}

	return { falseNegatives, falsePositives, kindMismatches, trueNegatives, truePositives };
}
