import {
	isExpressionStatement,
	isIdentifierNamed,
	isImportSpecifier,
	isUnaryExpression,
} from "$oxc-utilities/oxc-utilities";
import { isReactImport } from "$oxc-utilities/react-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

export function isStandaloneUseMemo(node: ESTree.CallExpression): boolean {
	if (isExpressionStatement(node.parent)) return true;
	if (!isUnaryExpression(node.parent) || node.parent.operator !== "void") return false;
	return isExpressionStatement(node.parent.parent);
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
		if (isImportSpecifier(specifier)) {
			if (isIdentifierNamed(specifier.imported, "useMemo")) memoIdentifiers.add(specifier.local.name);
			continue;
		}

		reactNamespaces.add(specifier.local.name);
	}
}
