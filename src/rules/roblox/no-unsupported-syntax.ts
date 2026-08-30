// Vendored from src/rules/no-unsupported-syntax/rule.ts@e1581d4f3d83a3d05b015a0a216507c3a20016de by roblox-ts.
// Source: https://github.com/roblox-ts/eslint-plugin-roblox-ts
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to the oxlint-plugin-utilities createRule API, options
// added to toggle each check, and regex-literal detection moved from token
// inspection to the `regex` literal property.

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

const noUnsupportedSyntax = createRule("no-unsupported-syntax", "roblox", {
	create(context) {
		const [rawOptions] = context.options;
		const checks = {
			globalThis: rawOptions?.globalThis ?? true,
			labels: rawOptions?.labels ?? true,
			prototype: rawOptions?.prototype ?? true,
			regexLiterals: rawOptions?.regexLiterals ?? true,
			spreadDestructuring: rawOptions?.spreadDestructuring ?? true,
		};

		return {
			ArrayPattern(node) {
				if (checks.spreadDestructuring) reportRestElements(context, node.elements);
			},
			Identifier(node) {
				if (checks.globalThis && node.name === "globalThis") {
					context.report({ messageId: "globalThis", node });
				}
			},
			LabeledStatement(node) {
				if (checks.labels) context.report({ messageId: "label", node });
			},
			Literal(node) {
				if (checks.regexLiterals && "regex" in node) context.report({ messageId: "regexLiteral", node });
			},
			MemberExpression(node) {
				if (
					checks.prototype &&
					!node.computed &&
					node.property.type === "Identifier" &&
					node.property.name === "prototype"
				) {
					context.report({ messageId: "prototype", node: node.property });
				}
			},
			ObjectPattern(node) {
				if (checks.spreadDestructuring) reportRestElements(context, node.properties);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow syntax that roblox-ts cannot compile to Luau.",
		},
		messages: {
			globalThis: "`globalThis` is not supported in roblox-ts.",
			label: "`label` is not supported in roblox-ts.",
			prototype: "`.prototype` is not supported in roblox-ts.",
			regexLiteral: "Regex literals are not supported in roblox-ts.",
			spreadDestructuring: "Operator `...` is not supported for destructuring!",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					globalThis: {
						default: true,
						description: "Disallow the globalThis identifier.",
						type: "boolean",
					},
					labels: {
						default: true,
						description: "Disallow labeled statements.",
						type: "boolean",
					},
					prototype: {
						default: true,
						description: "Disallow `.prototype` member access.",
						type: "boolean",
					},
					regexLiterals: {
						default: true,
						description: "Disallow regular expression literals.",
						type: "boolean",
					},
					spreadDestructuring: {
						default: true,
						description: "Disallow rest elements in destructuring patterns.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

function reportRestElements(
	context: InferContextFromRule<typeof noUnsupportedSyntax>,
	members: ReadonlyArray<ESTree.Node | null>,
): void {
	for (const member of members) {
		if (member?.type !== "RestElement") continue;
		context.report({ messageId: "spreadDestructuring", node: member });
	}
}

export default noUnsupportedSyntax;
