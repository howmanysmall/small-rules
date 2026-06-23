import { isIdentifierNamed } from "$oxc-utilities/oxc-utilities";
import { isReactImport } from "$oxc-utilities/react-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

export function isStandaloneUseMemo(node: ESTree.CallExpression): boolean {
	if (node.parent.type === "ExpressionStatement") return true;
	if (node.parent.type !== "UnaryExpression" || node.parent.operator !== "void") return false;
	return node.parent.parent.type === "ExpressionStatement";
}

export function trackUseMemoImports(
	node: ESTree.ImportDeclaration,
	reactSources: ReadonlySet<string>,
	memoIdentifiers: Set<string>,
	reactNamespaces: Set<string>,
): void {
	if (!isReactImport(node, reactSources)) return;

	for (const specifier of node.specifiers) {
		/* v8 ignore next -- @preserve React useMemo tracking currently receives named imports in exercised rule paths. */
		if (specifier.type === "ImportSpecifier") {
			if (isIdentifierNamed(specifier.imported, "useMemo")) memoIdentifiers.add(specifier.local.name);
			continue;
		}

		reactNamespaces.add(specifier.local.name);
	}
}
