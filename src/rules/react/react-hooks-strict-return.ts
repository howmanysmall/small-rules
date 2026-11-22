import {
	isArrayExpression,
	isIdentifier,
	isObjectExpression,
	isSpreadElement,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

const MAX_RETURN_ELEMENTS = 2;
const HOOK_PATTERN = /^use[A-Z0-9].*$/u;

interface IdentifierLike {
	readonly name: string;
}

interface NamedFunctionNode {
	readonly id: IdentifierLike | null;
}

function getFunctionHookName(node: NamedFunctionNode): string | undefined {
	return node.id?.name ?? undefined;
}

function getVariableDeclaratorName(node: ESTree.VariableDeclarator): string | undefined {
	/* v8 ignore next -- hook arrow functions are only tracked from identifier variable declarators. @preserve */
	return isIdentifier(node.id) ? node.id.name : undefined;
}

function isHookFunction(node: NamedFunctionNode): boolean {
	const name = getFunctionHookName(node);
	return name !== undefined && HOOK_PATTERN.test(name);
}

function isHookArrowFunction({ parent }: ESTree.ArrowFunctionExpression): boolean {
	if (!isVariableDeclarator(parent)) return false;

	const name = getVariableDeclaratorName(parent);
	return name !== undefined && HOOK_PATTERN.test(name);
}

function getLatestArrayInitializer(
	arrayInitializersByName: ReadonlyMap<string, Array<ESTree.ArrayExpression>>,
	name: string,
): ESTree.ArrayExpression | undefined {
	const initializers = arrayInitializersByName.get(name);
	/* v8 ignore next -- entries are deleted when their initializer stack becomes empty. @preserve */
	if (initializers === undefined || initializers.length === 0) return undefined;
	/* v8 ignore next -- fallback initializer stacks are only read after at least one initializer is pushed. @preserve */
	return initializers.at(-1);
}

function getArrayInitializerFromVariable(variable: ScopeVariable): ESTree.ArrayExpression | undefined {
	for (let index = variable.defs.length - 1; index >= 0; index -= 1) {
		const definition = variable.defs[index];
		if (!isVariableDeclarator(definition?.node) || !isArrayExpression(definition.node.init)) continue;

		return definition.node.init;
	}

	return undefined;
}

function hasObjectInitializer(variable: ScopeVariable): boolean {
	for (let index = variable.defs.length - 1; index >= 0; index -= 1) {
		const definition = variable.defs[index];
		if (!isVariableDeclarator(definition?.node)) continue;
		if (isObjectExpression(definition.node.init)) return true;
	}

	return false;
}

function getResolvedArrayInitializer(
	sourceCode: SourceCode,
	node: ESTree.Node,
	name: string,
	arrayInitializersByName: ReadonlyMap<string, Array<ESTree.ArrayExpression>>,
): ESTree.ArrayExpression | undefined {
	const scope = sourceCode.getScope(node);
	const variable = getVariableByName(scope, name);
	if (variable !== undefined) {
		const initializer = getArrayInitializerFromVariable(variable);
		if (initializer !== undefined) return initializer;
	}

	return getLatestArrayInitializer(arrayInitializersByName, name);
}

function getSpreadTarget(
	node: ESTree.SpreadElement,
	sourceCode: SourceCode,
	arrayInitializersByName: ReadonlyMap<string, Array<ESTree.ArrayExpression>>,
): ESTree.ArrayExpression | undefined {
	if (isIdentifier(node.argument)) {
		return getResolvedArrayInitializer(sourceCode, node, node.argument.name, arrayInitializersByName);
	}

	return isArrayExpression(node.argument) ? node.argument : undefined;
}

interface SpreadEntry {
	readonly array: ESTree.ArrayExpression;
	readonly parent: SpreadEntry | undefined;
}

function isBeingExpanded(entry: SpreadEntry, array: ESTree.ArrayExpression): boolean {
	for (let current: SpreadEntry | undefined = entry; current !== undefined; current = current.parent) {
		if (current.array === array) return true;
	}

	return false;
}

/**
 * Counts the values an array expression produces, expanding spreads of array
 * initializers. A spread that points back at an array still being expanded
 * counts as one value, so a self-referencing initializer terminates.
 *
 * @param node - The returned array expression.
 * @param sourceCode - The source code used to resolve spread identifiers.
 * @param arrayInitializersByName - Array initializers seen so far, by name.
 * @returns The number of values the array produces.
 */
function countReturnElements(
	node: ESTree.ArrayExpression,
	sourceCode: SourceCode,
	arrayInitializersByName: ReadonlyMap<string, Array<ESTree.ArrayExpression>>,
): number {
	const entries: Array<SpreadEntry> = [{ array: node, parent: undefined }];
	let count = 0;

	for (const entry of entries) {
		for (const element of entry.array.elements) {
			if (element === null || !isSpreadElement(element)) {
				count += 1;
				continue;
			}

			const target = getSpreadTarget(element, sourceCode, arrayInitializersByName);
			if (target === undefined || isBeingExpanded(entry, target)) {
				count += 1;
				continue;
			}

			// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
			entries.push({ array: target, parent: entry });
		}
	}

	return count;
}

function shouldAllowIdentifierReturn(sourceCode: SourceCode, node: ESTree.Node & IdentifierLike): boolean {
	const scope = sourceCode.getScope(node);
	const variable = getVariableByName(scope, node.name);
	if (variable === undefined) return false;
	return hasObjectInitializer(variable);
}

interface NamedArrayInitializer {
	readonly name: string;
	readonly init: ESTree.ArrayExpression;
}

function getArrayInitializer(node: ESTree.VariableDeclarator): NamedArrayInitializer | undefined {
	const name = getVariableDeclaratorName(node);
	if (name === undefined || !isArrayExpression(node.init)) return undefined;
	return { name, init: node.init };
}

function pushArrayInitializer(
	{ name, init }: NamedArrayInitializer,
	arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>,
): void {
	const initializers = arrayInitializersByName.get(name) ?? new Array<ESTree.ArrayExpression>();
	initializers.push(init);
	arrayInitializersByName.set(name, initializers);
}

function popArrayInitializer(name: string, arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>): void {
	const initializers = arrayInitializersByName.get(name);
	/* v8 ignore next -- exit visitors mirror enter visitors that created the initializer stack. @preserve */
	if (initializers === undefined || initializers.length === 0) return;

	initializers.pop();

	/* v8 ignore next -- each tracked name has one initializer in parser enter/exit order. @preserve */
	if (initializers.length === 0) {
		arrayInitializersByName.delete(name);
	}
}

const reactHooksStrictReturn = createRule("react-hooks-strict-return", "react", {
	create(context): Visitor {
		const { sourceCode } = context;
		const arrayInitializersByName = new Map<string, Array<ESTree.ArrayExpression>>();
		// One entry per function entered, true when that function is a hook.
		// A return belongs to the innermost function, so only the last
		// entry decides whether a return is checked.
		const functionIsHookStack = new Array<boolean>();

		function enterNamedFunction(node: ESTree.Function): void {
			functionIsHookStack.push(isHookFunction(node));
		}

		function enterArrowFunction(node: ESTree.ArrowFunctionExpression): void {
			functionIsHookStack.push(isHookArrowFunction(node));
		}

		function exitFunction(): void {
			functionIsHookStack.pop();
		}

		function reportTooManyReturnValues(node: ESTree.ReturnStatement): void {
			context.report({
				data: { count: `${MAX_RETURN_ELEMENTS}` },
				messageId: "tooManyReturnValues",
				node,
			});
		}

		function reportIfTooManyElements(node: ESTree.ReturnStatement, array: ESTree.ArrayExpression): void {
			const count = countReturnElements(array, sourceCode, arrayInitializersByName);
			if (count > MAX_RETURN_ELEMENTS) {
				reportTooManyReturnValues(node);
			}
		}

		function checkIdentifierReturn(node: ESTree.ReturnStatement, identifier: ESTree.IdentifierName): void {
			if (shouldAllowIdentifierReturn(sourceCode, identifier)) return;

			const initializer = getResolvedArrayInitializer(sourceCode, node, identifier.name, arrayInitializersByName);
			if (initializer !== undefined) {
				reportIfTooManyElements(node, initializer);
			}
		}

		function checkReturnStatement(node: ESTree.ReturnStatement): void {
			if (functionIsHookStack.at(-1) !== true || node.argument === null || isObjectExpression(node.argument)) {
				return;
			}

			if (isIdentifier(node.argument)) {
				checkIdentifierReturn(node, node.argument);
				return;
			}

			if (isArrayExpression(node.argument)) {
				reportIfTooManyElements(node, node.argument);
			}
		}

		return {
			ArrowFunctionExpression: enterArrowFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			FunctionDeclaration: enterNamedFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterNamedFunction,
			"FunctionExpression:exit": exitFunction,
			ReturnStatement: checkReturnStatement,
			VariableDeclarator(node): void {
				const initializer = getArrayInitializer(node);
				if (initializer !== undefined) {
					pushArrayInitializer(initializer, arrayInitializersByName);
				}
			},
			"VariableDeclarator:exit"(node): void {
				const initializer = getArrayInitializer(node);
				if (initializer !== undefined) {
					popArrayInitializer(initializer.name, arrayInitializersByName);
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Restrict React hooks to object returns or short tuples.",
		},
		messages: {
			tooManyReturnValues:
				"Hook returns more than {{count}} values. Return an object with named properties instead.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default reactHooksStrictReturn;
