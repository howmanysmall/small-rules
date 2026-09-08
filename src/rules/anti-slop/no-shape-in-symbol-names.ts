// Vendored from src/rules/no-shape-in-symbol-names.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local
// path aliases.
// Local departure from the pinned commit: non-computed MemberExpression
// (and equivalent JSXMemberExpression / TSQualifiedName) property identifiers
// are ignored because they often name an external API surface such as
// `Part.Shape` in Roblox, which is not within the author's control to rename.
// oxlint-disable small-rules/no-shape-in-symbol-names -- what?

import { createRule } from "$oxc-utilities/create-rule";
import { isJsxMemberExpression, isMemberExpression, isTsQualifiedName } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const FORBIDDEN_SYMBOL_NAME = "shape";

function containsForbiddenSymbolName(name: string): boolean {
	return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

type IdentifierNode =
	| ESTree.BindingIdentifier
	| ESTree.IdentifierName
	| ESTree.IdentifierReference
	| ESTree.JSXIdentifier
	| ESTree.LabelIdentifier
	| ESTree.PrivateIdentifier
	| ESTree.TSIndexSignatureName
	| ESTree.TSThisParameter;

function isExternalMemberPropertyIdentifier(node: IdentifierNode): boolean {
	const { parent } = node;

	return (
		(isMemberExpression(parent) && !parent.computed && parent.property === node) ||
		(isJsxMemberExpression(parent) && parent.property === node) ||
		(isTsQualifiedName(parent) && parent.right === node)
	);
}

const noShapeInSymbolNames = createRule("no-shape-in-symbol-names", "anti-slop", {
	createOnce(context): Visitor {
		function reportForbiddenSymbolName(node: IdentifierNode): void {
			if (isExternalMemberPropertyIdentifier(node) || !containsForbiddenSymbolName(node.name)) return;
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
