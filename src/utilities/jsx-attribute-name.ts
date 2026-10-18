import { isJsxIdentifier } from "@small-rules/oxlint-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

/**
 * Returns a JSX attribute's name, using the local part of a namespaced name
 * (`name` for `xml:name`).
 *
 * @param name - The attribute name node.
 * @returns The identifier text, or the local part of a namespaced name.
 */
export function getJsxAttributeName(name: ESTree.JSXAttributeName): string {
	return isJsxIdentifier(name) ? name.name : name.name.name;
}
