import { isCallbackFunction, isFunctionDeclarationRaw } from "@small-rules/oxlint-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

/**
 * The name of the function declaration `node` sits directly in, so a rule can
 * leave a shared helper's own definition alone.
 *
 * @param node - Node to place.
 * @returns The declaration's name, or `undefined` inside a callback or at the top level.
 */
export function getEnclosingFunctionName(node: ESTree.Node): string | undefined {
	for (let current = node.parent; current !== null; current = current.parent) {
		if (isFunctionDeclarationRaw(current)) return current.id?.name;
		if (isCallbackFunction(current)) return undefined;
	}
	return undefined;
}
