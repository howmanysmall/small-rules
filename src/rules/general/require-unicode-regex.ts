import { isIdentifierNamed, isNotSpread, isStringLiteral } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const FLAG_U = "u";
const FLAG_V = "v";

function hasUnicodeFlag(flags: string): boolean {
	return flags.includes(FLAG_U) || flags.includes(FLAG_V);
}

function getFlagsString(node: ESTree.Node): string | undefined {
	return isStringLiteral(node) ? node.value : undefined;
}

const requireUnicodeRegex = createRule("require-unicode-regex", "general", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				if (!isIdentifierNamed(node.callee, "regex")) return;

				if (node.arguments.length < 2) {
					context.report({ messageId: "requireUnicodeFlag", node });
					return;
				}

				const [, flagsNode] = node.arguments;
				if (flagsNode === undefined || !isNotSpread(flagsNode)) return;

				const flags = getFlagsString(flagsNode);
				if (flags !== undefined && !hasUnicodeFlag(flags)) {
					context.report({ messageId: "requireUnicodeFlag", node });
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require the 'u' or 'v' unicode flag on calls named regex().",
		},
		messages: {
			requireUnicodeFlag:
				"Missing the 'u' or 'v' unicode flag on this regex() call. Use the unicode flag to avoid silently creating invalid regex patterns.",
		},
		schema: [],
		type: "problem",
	},
});

export default requireUnicodeRegex;
