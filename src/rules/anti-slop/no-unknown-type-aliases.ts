// Vendored from src/rules/no-unknown-type-aliases.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to the local createRule API and path aliases; uses
// repository AST guards and the shared iterative lexical alias resolver;
// enqueues parenthesized types preserved by yuku-parser and union members.

import { createTypeAliasEnvironment, resolvedTypeMatches } from "$oxc-utilities/anti-slop/type-alias-resolution";
import { createRule } from "$oxc-utilities/create-rule";
import { isTsParenthesizedType, isTsUnionType, isTsUnknownKeyword } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

import type { TypeAliasEnvironment } from "$oxc-utilities/anti-slop/type-alias-resolution";

const noUnknownTypeAliases = createRule("no-unknown-type-aliases", "anti-slop", {
	createOnce(context): Visitor {
		let environment: TypeAliasEnvironment;

		function resolvesToUnknown(type: ESTree.TSType): boolean {
			return resolvedTypeMatches(type, environment, (resolved, enqueue) => {
				if (isTsUnknownKeyword(resolved)) return true;
				if (isTsParenthesizedType(resolved)) {
					enqueue(resolved.typeAnnotation);
					return false;
				}
				if (isTsUnionType(resolved)) {
					for (const member of resolved.types) enqueue(member);
				}
				return false;
			});
		}

		return {
			Program(node): void {
				environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
			},
			TSTypeAliasDeclaration(node): void {
				if (!resolvesToUnknown(node.typeAnnotation)) return;
				context.report({ data: { alias: node.id.name }, messageId: "unknownAlias", node: node.id });
			},
		};
	},
	meta: {
		docs: {
			description:
				"Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary.",
			recommended: true,
		},
		messages: {
			unknownAlias:
				"Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.",
		},
		type: "problem",
	},
});

export default noUnknownTypeAliases;
