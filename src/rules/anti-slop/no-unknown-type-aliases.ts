// Vendored from src/rules/no-unknown-type-aliases.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function referencedAliasName(type: ESTree.TSType): string | undefined {
	let current = type;
	while (current.type === "TSParenthesizedType") current = current.typeAnnotation;
	if (current.type !== "TSTypeReference" || current.typeName.type !== "Identifier") return undefined;
	const argumentCount = current.typeArguments?.params.length ?? 0;
	return argumentCount === 0 ? current.typeName.name : undefined;
}

const noUnknownTypeAliases = createRule("no-unknown-type-aliases", "anti-slop", {
	createOnce(context): Visitor {
		const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();

		function resolvesToUnknown(type: ESTree.TSType): boolean {
			const visited = new Set<string>();
			let current = type;
			while (true) {
				if (current.type === "TSUnknownKeyword") return true;
				const aliasName = referencedAliasName(current);
				if (aliasName === undefined || visited.has(aliasName)) return false;
				const alias = aliases.get(aliasName);
				if (alias === undefined || alias.typeParameters) return false;
				visited.add(aliasName);
				current = alias.typeAnnotation;
			}
		}

		return {
			Program(node): void {
				aliases.clear();
				for (const statement of node.body) {
					const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
					if (declaration?.type === "TSTypeAliasDeclaration") {
						aliases.set(declaration.id.name, declaration);
					}
				}
				for (const alias of aliases.values()) {
					if (!resolvesToUnknown(alias.typeAnnotation)) continue;
					context.report({ data: { alias: alias.id.name }, messageId: "unknownAlias", node: alias.id });
				}
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
