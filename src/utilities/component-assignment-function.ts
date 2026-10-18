import { isCallbackFunction, isIdentifier, isVariableDeclarator } from "@small-rules/oxlint-utilities";

import { isComponentAssignment } from "$oxc-utilities/lint-utilities";

import type { CallbackFunction } from "@small-rules/oxlint-utilities";
import type { ESTree } from "oxlint-plugin-utilities";

export interface ComponentAssignment {
	readonly id: ESTree.BindingIdentifier;
	readonly init: CallbackFunction;
}

/**
 * Narrows a component assignment (`const Name = () => ...`) to its binding
 * identifier and function initializer.
 *
 * @param node - The node to inspect.
 * @returns The binding and function, or `undefined` when `node` is not a
 *   component assignment.
 */
export function getComponentAssignment(node: ESTree.Node): ComponentAssignment | undefined {
	if (
		!isComponentAssignment(node) ||
		!isVariableDeclarator(node) ||
		!isIdentifier(node.id) ||
		!isCallbackFunction(node.init)
	) {
		return undefined;
	}
	return { id: node.id, init: node.init };
}
