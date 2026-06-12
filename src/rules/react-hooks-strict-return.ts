import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const MAX_RETURN_ELEMENTS = 2;
const HOOK_PATTERN = /^use[A-Z0-9].*$/u;

interface IdentifierLike {
	readonly name: string;
}

interface NamedFunctionNode {
	readonly id: IdentifierLike | null;
}

function isHookName(name: string): boolean {
	return HOOK_PATTERN.test(name);
}

function getFunctionHookName(node: NamedFunctionNode): string | undefined {
	if (node.id === null) return undefined;
	return node.id.name;
}

function getVariableDeclaratorName(node: ESTree.VariableDeclarator): string | undefined {
	return node.id.type === "Identifier" ? node.id.name : undefined;
}

function isHookFunction(node: NamedFunctionNode): boolean {
	const name = getFunctionHookName(node);
	return name !== undefined && isHookName(name);
}

function isHookArrowFunction({ parent }: ESTree.ArrowFunctionExpression): boolean {
	if (parent.type !== "VariableDeclarator") return false;

	const name = getVariableDeclaratorName(parent);
	return name !== undefined && isHookName(name);
}

function getLatestArrayInitializer(
	arrayInitializersByName: ReadonlyMap<string, Array<ESTree.ArrayExpression>>,
	name: string,
): ESTree.ArrayExpression | undefined {
	const initializers = arrayInitializersByName.get(name);
	if (initializers === undefined || initializers.length === 0) return undefined;
	return initializers.at(-1);
}

function getArrayInitializerFromVariable(variable: ScopeVariable): ESTree.ArrayExpression | undefined {
	for (let index = variable.defs.length - 1; index >= 0; index -= 1) {
		const definition = variable.defs[index];
		if (definition?.node.type !== "VariableDeclarator" || definition.node.init?.type !== "ArrayExpression") {
			continue;
		}
		return definition.node.init;
	}

	return undefined;
}

function hasObjectInitializer(variable: ScopeVariable): boolean {
	for (let index = variable.defs.length - 1; index >= 0; index -= 1) {
		const definition = variable.defs[index];
		if (definition?.node.type !== "VariableDeclarator") continue;
		if (definition.node.init?.type === "ObjectExpression") return true;
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

function countSpreadElement(
	node: ESTree.SpreadElement,
	sourceCode: SourceCode,
	arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>,
): number {
	if (node.argument.type === "Identifier") {
		const initializer = getResolvedArrayInitializer(sourceCode, node, node.argument.name, arrayInitializersByName);
		if (initializer === undefined) return 1;
		return countReturnElements(initializer, sourceCode, arrayInitializersByName);
	}

	if (node.argument.type === "ArrayExpression") {
		return countReturnElements(node.argument, sourceCode, arrayInitializersByName);
	}

	return 1;
}

function countReturnElements(
	node: ESTree.ArrayExpression,
	sourceCode: SourceCode,
	arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>,
): number {
	let count = 0;

	for (const element of node.elements) {
		if (element === null) {
			count += 1;
			continue;
		}

		if (element.type === "SpreadElement") {
			count += countSpreadElement(element, sourceCode, arrayInitializersByName);
			continue;
		}

		count += 1;
	}

	return count;
}

function shouldAllowIdentifierReturn(sourceCode: SourceCode, node: ESTree.Node & IdentifierLike): boolean {
	const scope = sourceCode.getScope(node);
	const variable = getVariableByName(scope, node.name);
	if (variable === undefined) return false;
	return hasObjectInitializer(variable);
}

function getArrayInitializer(
	node: ESTree.VariableDeclarator,
): { init: ESTree.ArrayExpression; name: string } | undefined {
	const name = getVariableDeclaratorName(node);
	if (name === undefined || node.init?.type !== "ArrayExpression") return undefined;
	return { init: node.init, name };
}

function pushArrayInitializer(
	node: ESTree.VariableDeclarator,
	arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>,
): void {
	const initializer = getArrayInitializer(node);
	if (initializer === undefined) return;

	const { init, name } = initializer;
	const initializers = arrayInitializersByName.get(name) ?? new Array<ESTree.ArrayExpression>();
	initializers.push(init);
	arrayInitializersByName.set(name, initializers);
}

function popArrayInitializer(
	node: ESTree.VariableDeclarator,
	arrayInitializersByName: Map<string, Array<ESTree.ArrayExpression>>,
): void {
	const initializer = getArrayInitializer(node);
	if (initializer === undefined) return;

	const { name } = initializer;
	const initializers = arrayInitializersByName.get(name);
	if (initializers === undefined || initializers.length === 0) return;

	initializers.pop();
	if (initializers.length === 0) {
		arrayInitializersByName.delete(name);
	}
}

const reactHooksStrictReturn = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const arrayInitializersByName = new Map<string, Array<ESTree.ArrayExpression>>();
		let hookDepth = 0;

		function enterNamedHook(node: ESTree.Function): void {
			if (isHookFunction(node)) hookDepth += 1;
		}

		function exitNamedHook(node: ESTree.Function): void {
			if (isHookFunction(node)) hookDepth -= 1;
		}

		function enterArrowHook(node: ESTree.ArrowFunctionExpression): void {
			if (isHookArrowFunction(node)) hookDepth += 1;
		}

		function exitArrowHook(node: ESTree.ArrowFunctionExpression): void {
			if (isHookArrowFunction(node)) hookDepth -= 1;
		}

		function reportTooManyReturnValues(node: ESTree.ReturnStatement): void {
			context.report({
				data: { count: `${MAX_RETURN_ELEMENTS}` },
				messageId: "tooManyReturnValues",
				node,
			});
		}

		function checkReturnStatement(node: ESTree.ReturnStatement): void {
			if (hookDepth === 0 || node.argument === null || node.argument.type === "ObjectExpression") return;

			if (node.argument.type === "Identifier") {
				if (shouldAllowIdentifierReturn(sourceCode, node.argument)) return;

				const initializer = getResolvedArrayInitializer(
					sourceCode,
					node,
					node.argument.name,
					arrayInitializersByName,
				);
				if (initializer === undefined) return;

				const count = countReturnElements(initializer, sourceCode, arrayInitializersByName);
				if (count > MAX_RETURN_ELEMENTS) reportTooManyReturnValues(node);
				return;
			}

			if (node.argument.type !== "ArrayExpression") return;

			const count = countReturnElements(node.argument, sourceCode, arrayInitializersByName);
			if (count > MAX_RETURN_ELEMENTS) reportTooManyReturnValues(node);
		}

		return {
			ArrowFunctionExpression: enterArrowHook,
			"ArrowFunctionExpression:exit": exitArrowHook,
			FunctionDeclaration: enterNamedHook,
			"FunctionDeclaration:exit": exitNamedHook,
			FunctionExpression: enterNamedHook,
			"FunctionExpression:exit": exitNamedHook,
			ReturnStatement: checkReturnStatement,
			VariableDeclarator(node): void {
				pushArrayInitializer(node, arrayInitializersByName);
			},
			"VariableDeclarator:exit"(node): void {
				popArrayInitializer(node, arrayInitializersByName);
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
