import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isAnyFunction, isNode } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const DEFAULT_SYSTEM_TYPE_NAMES = ["PlanckSystem", "System", "SystemFunction", "SystemReturn", "SystemTableLike"];
const KEYS_TO_SKIP = new Set(["comments", "loc", "parent", "range", "tokens"]);

function getTypeName(typeNode: ESTree.Node): string | undefined {
	if (typeNode.type === "Identifier") return typeNode.name;
	/* v8 ignore else -- @preserve TypeScript type references only use identifiers or qualified names. */
	if (typeNode.type === "TSQualifiedName") return getTypeName(typeNode.right);
	/* v8 ignore next -- @preserve TypeScript type reference name parser invariant. */
	return undefined;
}

function isRecognizedType(typeNode: ESTree.Node | null | undefined, systemTypeNames: ReadonlySet<string>): boolean {
	if (typeNode === null || typeNode === undefined) return false;
	if (typeNode.type === "TSTypeAnnotation") return isRecognizedType(typeNode.typeAnnotation, systemTypeNames);
	if (typeNode.type !== "TSTypeReference") return false;

	const typeName = getTypeName(typeNode.typeName);
	return typeName !== undefined && systemTypeNames.has(typeName);
}

function pushChildren(node: ESTree.Node, stack: Array<unknown>): void {
	for (const key of Object.keys(node)) {
		if (KEYS_TO_SKIP.has(key)) continue;
		const value: unknown = Reflect.get(node, key);
		if (value !== null && value !== undefined) stack.push(value);
	}
}

function forEachNode(root: ESTree.Node, visit: (node: ESTree.Node) => boolean | undefined): void {
	const stack: Array<unknown> = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined || current === null || typeof current !== "object") continue;
		if (Array.isArray(current)) {
			for (const child of current) stack.push(child);
			continue;
		}
		/* v8 ignore next -- @preserve parser object fields are arrays or AST nodes. */
		if (!isNode(current)) continue;
		if (visit(current) === false) continue;
		pushChildren(current, stack);
	}
}

function getPropertyName(property: ESTree.ObjectExpression["properties"][number]): string | undefined {
	if (property.type !== "Property") return undefined;
	if (property.computed) {
		return property.key.type === "Literal" && typeof property.key.value === "string"
			? property.key.value
			: undefined;
	}
	return property.key.type === "Identifier" ? property.key.name : undefined;
}

function addSystemPropertyFunction(
	object: ESTree.ObjectExpression,
	namedFunctions: ReadonlyMap<string, CallbackFunction>,
	systemFunctions: Set<CallbackFunction>,
): void {
	for (const property of object.properties) {
		if (getPropertyName(property) !== "system" || property.type !== "Property") continue;
		if (isAnyFunction(property.value)) systemFunctions.add(property.value);
		else if (property.value.type === "Identifier") {
			const systemFunction = namedFunctions.get(property.value.name);
			if (systemFunction !== undefined) systemFunctions.add(systemFunction);
		}
	}
}

function getCallName(node: ESTree.CallExpression): string | undefined {
	if (node.callee.type === "Identifier") return node.callee.name;
	if (node.callee.type === "MemberExpression") return getMemberPropertyName(node.callee);
	return undefined;
}

function reportAsyncCalls(systemFunction: CallbackFunction, report: (node: ESTree.CallExpression) => void): void {
	if (systemFunction.async || systemFunction.body === null) return;

	forEachNode(systemFunction.body, (node) => {
		if (isAnyFunction(node) && node !== systemFunction && node.async) return false;
		if (node.type === "CallExpression" && getCallName(node)?.endsWith("Async") === true) report(node);
		return true;
	});
}

const noAsyncInSystem = defineRule({
	create(context): Visitor {
		const additionalSystemTypeNames = context.options[0]?.additionalSystemTypeNames ?? [];
		const systemTypeNames = new Set([...DEFAULT_SYSTEM_TYPE_NAMES, ...additionalSystemTypeNames]);

		return {
			"Program:exit"(program): void {
				const namedFunctions = new Map<string, CallbackFunction>();
				const systemFunctions = new Set<CallbackFunction>();
				const typedSystemObjects = new Array<ESTree.ObjectExpression>();

				forEachNode(program, (node) => {
					if (isAnyFunction(node)) {
						if (node.id !== null) namedFunctions.set(node.id.name, node);
						if (isRecognizedType(node.returnType, systemTypeNames)) systemFunctions.add(node);
						return;
					}

					if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
						if (!isRecognizedType(node.id.typeAnnotation, systemTypeNames) || node.init === null) return;
						if (isAnyFunction(node.init)) systemFunctions.add(node.init);
						else if (node.init.type === "ObjectExpression") typedSystemObjects.push(node.init);
						return;
					}

					if (
						node.type === "TSSatisfiesExpression" &&
						isRecognizedType(node.typeAnnotation, systemTypeNames) &&
						node.expression.type === "ObjectExpression"
					) {
						typedSystemObjects.push(node.expression);
					}
				});

				for (const object of typedSystemObjects) {
					addSystemPropertyFunction(object, namedFunctions, systemFunctions);
				}

				for (const systemFunction of systemFunctions) {
					reportAsyncCalls(systemFunction, (node) => {
						context.report({ messageId: "noAsyncInSystem", node });
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow Async-suffixed calls in synchronous Planck system execution.",
			recommended: true,
		},
		messages: {
			noAsyncInSystem: "Do not call an Async-suffixed function from a synchronous Planck system.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					additionalSystemTypeNames: {
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noAsyncInSystem;
