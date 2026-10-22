import { createRule } from "$oxc-utilities/create-rule";
import { isStandaloneUseMemo } from "$oxc-utilities/react-memo-utilities";
import { ENVIRONMENT_SCHEMA, getReactSourcesFromOptions } from "$oxc-utilities/react-utilities";
import { createUseMemoCallTracker } from "$oxc-utilities/use-memo-call-tracker";

import type { Visitor } from "oxlint-plugin-utilities";

const noUnusedUseMemo = createRule("no-unused-use-memo", "react", {
	create(context): Visitor {
		const useMemoCalls = createUseMemoCallTracker(getReactSourcesFromOptions(context.options[0]));

		return {
			...useMemoCalls.visitor,
			CallExpression(node): void {
				if (!useMemoCalls.isUseMemoCall(node) || !isStandaloneUseMemo(node)) return;

				context.report({
					messageId: "unusedUseMemo",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow standalone useMemo calls that ignore the memoized value.",
			recommended: true,
		},
		messages: {
			unusedUseMemo:
				"useMemo results must be used. Standalone useMemo calls add overhead without preserving a value.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: { environment: ENVIRONMENT_SCHEMA },
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noUnusedUseMemo;
