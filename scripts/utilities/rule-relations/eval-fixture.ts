import { getPairKey } from "./types";

import type { RuleRelationKind } from "$data/rule-relations";

import type { RelationResolution, UnorderedRulePair } from "./types";

function defineEvalPairs<const TPairs extends ReadonlyArray<UnorderedRulePair>>(pairs: TPairs): TPairs {
	return pairs;
}

const noTaskWait = "no-task-wait";
const preferIdiv = "prefer-idiv";

export const evalNegativePairs = defineEvalPairs([
	{ left: "ban-react-fc", right: noTaskWait },
	{ left: "prefer-pascal-case-enums", right: "directive-no-use" },
	{ left: "no-giant-component", right: "prefer-udim2-shorthand" },
	{ left: "use-hook-at-top-level", right: "no-array-size-assignment" },
	{ left: "require-react-component-keys", right: "no-async-in-system" },
	{ left: "no-underscore-react-props", right: "prefer-math-min-max" },
	{ left: "prefer-ternary-conditional-rendering", right: "no-table-create-map" },
	{ left: "strict-component-boundaries", right: noTaskWait },
	{ left: "prefer-direct-hook-imports", right: preferIdiv },
	{ left: "no-useless-use-spring", right: "directive-require-description" },
	{ left: "memoized-effect-dependencies", right: "no-array-constructor-elements" },
	{ left: "require-named-effect-functions", right: "prefer-udim2-shorthand" },
	{ left: "react-hooks-strict-return", right: "no-ianitor-in-function-body" },
	{ left: "no-derived-state", right: "prefer-singular-enums" },
	{ left: "prefer-context-stack", right: "no-error" },
	{ left: "rerender-memo-with-default-value", right: "no-array-constructor-index-assignment" },
	{ left: "require-react-display-names", right: noTaskWait },
	{ left: "prefer-hoisted-jsx-elements", right: "no-table-create-map" },
	{ left: "no-static-react-create-element", right: preferIdiv },
	{ left: "no-god-components", right: "directive-no-duplicate-disable" },
	{ left: "prefer-use-reducer", right: "prefer-math-min-max" },
	{ left: "no-cascading-set-state", right: "no-array-size-assignment" },
	{ left: "no-useless-use-memo", right: "enforce-ianitor-check-type" },
	{ left: "prefer-hoisted-jsx-object-properties", right: "no-async-in-system" },
	{ left: "prefer-local-portal-component", right: "prefer-singular-enums" },
	{ left: "no-inline-property-on-memo-component", right: "directive-no-unlimited-disable" },
	{ left: "no-event-handler", right: preferIdiv },
	{ left: "no-initialize-state", right: noTaskWait },
	{ left: "prefer-padding-components", right: "prefer-pascal-case-enums" },
	{ left: "prefer-constant-dispatch", right: "directive-require-description" },
]);

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
