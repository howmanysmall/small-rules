import { isCallExpression, isMemberExpression } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { getMemberPropertyName, stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noFilterMapChain = createRule("no-filter-map-chain", "general", {
	create(context): Visitor {
		return {
			CallExpression(node): void {
				const mapCallee = stripExpressionWrappers(node.callee);
				if (!isMemberExpression(mapCallee) || getMemberPropertyName(mapCallee) !== "map") return;

				const filterCall = stripExpressionWrappers(mapCallee.object);
				if (!isCallExpression(filterCall)) return;

				const filterCallee = stripExpressionWrappers(filterCall.callee);
				if (!isMemberExpression(filterCallee) || getMemberPropertyName(filterCallee) !== "filter") {
					return;
				}

				context.report({
					messageId: "avoidFilterMapChain",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow map(...) directly after filter(...).",
		},
		messages: {
			avoidFilterMapChain:
				"Do not chain map(...) directly after filter(...). Combine both operations in a single loop.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default noFilterMapChain;
