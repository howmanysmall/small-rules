// Vendored from src/rules/no-shape-in-symbol-names.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.
// oxlint-disable small-rules/no-shape-in-symbol-names -- what?

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const FORBIDDEN_SYMBOL_NAME = "shape";

function containsForbiddenSymbolName(name: string): boolean {
	return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

const noShapeInSymbolNames = createRule("no-shape-in-symbol-names", "anti-slop", {
	createOnce(context): Visitor {
		function reportForbiddenSymbolName(node: ESTree.Node & { name: string }): void {
			if (!containsForbiddenSymbolName(node.name)) return;
			context.report({ data: { name: node.name }, messageId: "forbiddenSymbolName", node });
		}

		return {
			Identifier: reportForbiddenSymbolName,
			JSXIdentifier: reportForbiddenSymbolName,
			PrivateIdentifier: reportForbiddenSymbolName,
		};
	},
	meta: {
		docs: {
			description:
				'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol names.',
			recommended: true,
		},
		messages: {
			forbiddenSymbolName:
				'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
		},
		type: "problem",
	},
});

export default noShapeInSymbolNames;
