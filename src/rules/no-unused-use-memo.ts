import { isUseMemoCall } from "$oxc-utilities/oxc-utilities";
import { isStandaloneUseMemo, trackUseMemoImports } from "$oxc-utilities/react-memo-utilities";
import { getReactSourcesFromOptions } from "$oxc-utilities/react-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noUnusedUseMemo = defineRule({
	create(context): Visitor {
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const reactSources = getReactSourcesFromOptions(context.options[0]);

		return {
			CallExpression(node): void {
				if (!(isUseMemoCall(node, memoIdentifiers, reactNamespaces) && isStandaloneUseMemo(node))) return;

				context.report({
					messageId: "unusedUseMemo",
					node,
				});
			},
			ImportDeclaration(node): void {
				trackUseMemoImports(node, reactSources, memoIdentifiers, reactNamespaces);
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
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noUnusedUseMemo;
