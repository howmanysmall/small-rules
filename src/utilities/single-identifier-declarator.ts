import { isIdentifier } from "@small-rules/oxlint-utilities";

import type { ESTree } from "oxlint-plugin-utilities";

export type IdentifierDeclarator = ESTree.VariableDeclarator & { readonly id: ESTree.BindingIdentifier };

function isIdentifierDeclarator(declarator: ESTree.VariableDeclarator): declarator is IdentifierDeclarator {
	return isIdentifier(declarator.id);
}

/**
 * Gets the only declarator of a declaration when it binds a plain identifier.
 *
 * @param declaration - Variable declaration to inspect.
 * @param declaration.declarations - Declarators of the declaration.
 * @returns The sole declarator, or undefined for multiple declarators or a
 *   destructuring pattern.
 */
export function getSingleIdentifierDeclarator({
	declarations,
}: ESTree.VariableDeclaration): IdentifierDeclarator | undefined {
	const declarator = declarations.length === 1 ? declarations[0] : undefined;
	return declarator !== undefined && isIdentifierDeclarator(declarator) ? declarator : undefined;
}
