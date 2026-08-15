import { getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const noFilterMapChain = createRule("no-filter-map-chain", "general", {
	create(context): Visitor {
		return {
			CallExpression(node): void {
				const mapCallee = unwrapExpression(node.callee);
				if (mapCallee.type !== "MemberExpression" || getMemberPropertyName(mapCallee) !== "map") return;

				const filterCall = unwrapExpression(mapCallee.object);
				if (filterCall.type !== "CallExpression") return;

				const filterCallee = unwrapExpression(filterCall.callee);
				if (filterCallee.type !== "MemberExpression" || getMemberPropertyName(filterCallee) !== "filter") {
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
