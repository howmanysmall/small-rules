import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isObjectPattern,
	isProperty,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

interface ResultVariable {
	readonly firstSuccessNode: ESTree.Node;
	readonly properties: Set<string>;
	referencedFully: boolean;
}

function isIanitorFactoryCall(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (!isCallExpression(unwrapped)) return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (!isMemberExpression(callee) || callee.computed) return false;

	const object = unwrapExpression(callee.object);
	return isIdentifierNamed(object, "Ianitor") && isIdentifierName(callee.property);
}

function isFromIanitorCheckVariable(scopeVariable: ScopeVariable): boolean {
	for (const { node } of scopeVariable.defs) {
		if (!isVariableDeclarator(node)) continue;

		const { init } = node;
		if (init !== null && isIanitorFactoryCall(init)) return true;
	}

	return false;
}

function isCallToIanitorCheck(node: ESTree.CallExpression, sourceCode: SourceCode): boolean {
	const unwrappedCallee = unwrapExpression(node.callee);
	if (isCallExpression(unwrappedCallee)) return isIanitorFactoryCall(unwrappedCallee);

	if (isIdentifierName(unwrappedCallee)) {
		const variable = getVariableByName(sourceCode.getScope(node), unwrappedCallee.name);
		return variable !== undefined && isFromIanitorCheckVariable(variable);
	}

	return false;
}

function isDestructuringSuccessOnly(objectPattern: ESTree.ObjectPattern): boolean {
	let hasSuccess = false;

	for (const property of objectPattern.properties) {
		if (!isProperty(property) || !isIdentifierName(property.key)) continue;
		const { name } = property.key;
		if (name === "error" || name === "value") return false;
		/* v8 ignore next -- @preserve success-only object patterns reach this path from parser Property keys. */
		if (name === "success") hasSuccess = true;
	}

	return hasSuccess;
}

function findSuccessPropertyKey(objectPattern: ESTree.ObjectPattern): ESTree.Node | undefined {
	for (const property of objectPattern.properties) {
		/* v8 ignore next -- @preserve isDestructuringSuccessOnly filters to an identifier success property. */
		if (isProperty(property) && isIdentifierNamed(property.key, "success")) return property.key;
	}

	/* v8 ignore next -- @preserve isDestructuringSuccessOnly proves a success key before this helper is called. */
	return undefined;
}

function isFactoryCheckDeclarator(id: ESTree.Node, init: ESTree.CallExpression): boolean {
	return isIdentifierName(id) && isIanitorFactoryCall(init);
}

function isSuccessOnlyDestructuring(id: ESTree.Node, init: ESTree.CallExpression, sourceCode: SourceCode): boolean {
	return isObjectPattern(id) && isCallToIanitorCheck(init, sourceCode) && isDestructuringSuccessOnly(id);
}

function isStoredCheckResult(
	id: ESTree.Node,
	init: ESTree.CallExpression,
	ianitorCheckVariables: ReadonlySet<string>,
): boolean {
	if (!isIdentifierName(id)) return false;

	const callee = unwrapExpression(init.callee);
	return isIdentifierName(callee) && ianitorCheckVariables.has(callee.name);
}

const noIanitorSuccessAccess = createRule("no-ianitor-success-access", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		const ianitorCheckVariables = new Set<string>();
		const ianitorResultVariables = new Map<string, ResultVariable>();

		function markResultFullyUsed(name: string): void {
			const result = ianitorResultVariables.get(name);
			if (result !== undefined) result.referencedFully = true;
		}

		function reportSuccessOnlyDestructuring(objectPattern: ESTree.ObjectPattern): void {
			const keyNode = findSuccessPropertyKey(objectPattern);
			/* v8 ignore next -- @preserve isDestructuringSuccessOnly already proves the key exists. */
			if (keyNode !== undefined) {
				context.report({
					messageId: "preferCreateGuard",
					node: keyNode,
				});
			}
		}

		return {
			CallExpression(node): void {
				for (const argument of node.arguments) {
					if (!isIdentifierName(argument)) continue;
					const result = ianitorResultVariables.get(argument.name);
					if (result !== undefined) result.referencedFully = true;
				}
			},

			MemberExpression({ computed, object, property }): void {
				if (computed || !isIdentifierName(property)) return;
				const unwrapped = unwrapExpression(object);

				if (isCallExpression(unwrapped) && property.name === "success") {
					if (isCallToIanitorCheck(unwrapped, sourceCode)) {
						context.report({
							messageId: "preferCreateGuard",
							node: property,
						});
					}
					return;
				}

				/* v8 ignore next -- @preserve non-call member objects are only tracked when they are identifiers. */
				if (isIdentifierName(unwrapped)) {
					const result = ianitorResultVariables.get(unwrapped.name);
					if (result !== undefined) result.properties.add(property.name);
				}
			},

			"Program:exit"(): void {
				for (const [, { firstSuccessNode, properties, referencedFully }] of ianitorResultVariables) {
					if (
						!referencedFully &&
						properties.has("success") &&
						!properties.has("error") &&
						!properties.has("value")
					) {
						context.report({
							messageId: "preferCreateGuard",
							node: firstSuccessNode,
						});
					}
				}
			},

			ReturnStatement({ argument }): void {
				if (!isIdentifierName(argument)) return;
				markResultFullyUsed(argument.name);
			},

			VariableDeclarator({ id, init }): void {
				if (init === null) return;

				const unwrappedInit = unwrapExpression(init);
				if (!isCallExpression(unwrappedInit)) return;

				if (isIdentifierName(id) && isFactoryCheckDeclarator(id, unwrappedInit)) {
					ianitorCheckVariables.add(id.name);
					return;
				}

				if (isObjectPattern(id) && isSuccessOnlyDestructuring(id, unwrappedInit, sourceCode)) {
					reportSuccessOnlyDestructuring(id);
				}

				if (isIdentifierName(id) && isStoredCheckResult(id, unwrappedInit, ianitorCheckVariables)) {
					ianitorResultVariables.set(id.name, {
						firstSuccessNode: id,
						properties: new Set(),
						referencedFully: false,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow accessing `.success` on Ianitor check results when the full result object is not needed.",
		},
		messages: {
			preferCreateGuard:
				"Replace with Flamework.createGuard<T>(). Ianitor check results allocate a table on every call; Flamework.createGuard returns a plain boolean at runtime with zero allocation.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default noIanitorSuccessAccess;
