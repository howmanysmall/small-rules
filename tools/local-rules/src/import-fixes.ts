import { isIdentifier, isImportDeclaration, isImportSpecifier } from "@small-rules/oxlint-utilities";

import type { Definition, ESTree, Fix, Fixer, Scope, SourceCode, Variable } from "oxlint-plugin-utilities";

export interface ImportTarget {
	readonly name: string;
	readonly specifier: string;
}

export type ImportingFix = (fixer: Fixer) => Fix | undefined;

interface Insertion {
	readonly position: number;
	readonly text: string;
}

export const noFix: ImportingFix = () => undefined;

function findVariable(sourceCode: SourceCode, node: ESTree.Node, name: string): undefined | Variable {
	for (let scope: null | Scope = sourceCode.getScope(node); scope !== null; scope = scope.upper) {
		const variable = scope.set.get(name);
		if (variable !== undefined) return variable;
	}
	return undefined;
}

function isImportDefinition({ type }: Definition): boolean {
	return type === "ImportBinding";
}

function getImportedName({ imported }: ESTree.ImportSpecifier): string {
	return isIdentifier(imported) ? imported.name : imported.value;
}

function importsTarget(variable: Variable, { name, specifier }: ImportTarget): boolean {
	return variable.defs.some(
		({ node, parent }) =>
			isImportSpecifier(node) &&
			isImportDeclaration(parent) &&
			parent.source.value === specifier &&
			getImportedName(node) === name,
	);
}

/**
 * Where to make `name` importable: added to an existing value import from the
 * same module, or as a new import after the last one.
 *
 * @param program - The file.
 * @param target - Name and module to import.
 * @returns The text to insert and where.
 */
function planInsertion(program: ESTree.Program, { name, specifier }: ImportTarget): Insertion {
	let lastImport: ESTree.ImportDeclaration | undefined;
	for (const statement of program.body) {
		if (!isImportDeclaration(statement)) continue;
		lastImport = statement;
		if (statement.source.value !== specifier || statement.importKind === "type") continue;

		const lastSpecifier = statement.specifiers.at(-1);
		if (lastSpecifier !== undefined && isImportSpecifier(lastSpecifier)) {
			return { position: lastSpecifier.range[1], text: `, ${name}` };
		}
	}

	const declaration = `import { ${name} } from "${specifier}";`;
	if (lastImport === undefined) {
		return { position: program.range[0], text: `${declaration}\n` };
	}
	return { position: lastImport.range[1], text: `\n${declaration}` };
}

/**
 * A fix that replaces `node` with code using `target.name`, importing it when
 * needed. The import and the replacement form one edit, so a second report
 * needing the same import cannot add it twice.
 *
 * @param sourceCode - The file.
 * @param node - Node to replace.
 * @param replacement - Replacement text, which uses `target.name`.
 * @param target - Name and module to import.
 * @param isDefiningModule - Whether this file is the module that exports the name.
 * @param range - Source to replace, when it is not exactly `node`.
 * @returns The fix; it does nothing when the name already means something else.
 */
export function createImportingFix(
	sourceCode: SourceCode,
	node: ESTree.Node,
	replacement: string,
	target: ImportTarget,
	isDefiningModule: boolean,
	range: readonly [number, number] = node.range,
): ImportingFix {
	const variable = findVariable(sourceCode, node, target.name);
	if (variable !== undefined) {
		const isAvailable =
			importsTarget(variable, target) || (isDefiningModule && !variable.defs.some(isImportDefinition));
		return isAvailable ? (fixer): Fix => fixer.replaceTextRange([range[0], range[1]], replacement) : noFix;
	}

	const { position, text } = planInsertion(sourceCode.ast, target);
	const [start, end] = range;
	// An import that only comes after the code would have to move first.
	if (position > start) return noFix;

	const between = sourceCode.text.slice(position, start);
	return (fixer): Fix => fixer.replaceTextRange([position, end], `${text}${between}${replacement}`);
}
