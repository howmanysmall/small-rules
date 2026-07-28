import { getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noFilterMapChain = defineRule({
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
			url: "https://docs.howmanysmall.com/small-rules/rules/general/no-filter-map-chain/",
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
