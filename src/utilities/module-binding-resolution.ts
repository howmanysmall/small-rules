import { getReferencedVariable } from "$oxc-utilities/ast-utilities";
import { isImportBinding, isModuleLevelScope } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

function isModuleScopeVariable(variable: ScopeVariable): boolean {
	return isModuleLevelScope(variable.scope);
}

/**
 * Whether `identifier` resolves to an import, or to a module-level variable
 * that `isModuleBinding` accepts (by default, any module-level variable).
 *
 * @param sourceCode - The source code of the current file.
 * @param identifier - The identifier to resolve.
 * @param isModuleBinding - Accepts a resolved variable that is not an import.
 * @returns Whether the identifier resolves to an accepted module binding.
 */
export function resolvesToModuleBinding(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
	isModuleBinding: (variable: ScopeVariable) => boolean = isModuleScopeVariable,
): boolean {
	const variable = getReferencedVariable(sourceCode, identifier);
	if (variable === undefined) return false;

	return isImportBinding(variable) || isModuleBinding(variable);
}
