import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface ResultVariable {
	readonly firstSuccessNode: ESTree.Node;
	readonly properties: Set<string>;
	referencedFully: boolean;
}

function isIanitorFactoryCall(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type !== "CallExpression") return false;

	const callee = unwrapExpression(unwrapped.callee);
	if (callee.type !== "MemberExpression" || callee.computed) return false;

	const object = unwrapExpression(callee.object);
	return object.type === "Identifier" && object.name === "Ianitor" && callee.property.type === "Identifier";
}

function isFromIanitorCheckVariable(scopeVariable: ScopeVariable): boolean {
	for (const { node } of scopeVariable.defs) {
		if (node.type !== "VariableDeclarator") continue;

		const { init } = node;
		if (init !== null && isIanitorFactoryCall(init)) return true;
	}

	return false;
}

function isCallToIanitorCheck(node: ESTree.CallExpression, sourceCode: SourceCode): boolean {
	const unwrappedCallee = unwrapExpression(node.callee);
	if (unwrappedCallee.type === "CallExpression") return isIanitorFactoryCall(unwrappedCallee);

	if (unwrappedCallee.type === "Identifier") {
		const variable = getVariableByName(sourceCode.getScope(node), unwrappedCallee.name);
		return variable !== undefined && isFromIanitorCheckVariable(variable);
	}

	return false;
}

function isDestructuringSuccessOnly(objectPattern: ESTree.ObjectPattern): boolean {
	let hasSuccess = false;

	for (const property of objectPattern.properties) {
		if (property.type !== "Property" || property.key.type !== "Identifier") continue;
		if (property.key.name === "error" || property.key.name === "value") return false;
		/* v8 ignore next -- @preserve success-only object patterns reach this path from parser Property keys. */
		if (property.key.name === "success") hasSuccess = true;
	}

	return hasSuccess;
}

function findSuccessPropertyKey(objectPattern: ESTree.ObjectPattern): ESTree.Node | undefined {
	for (const property of objectPattern.properties) {
		/* v8 ignore next -- @preserve isDestructuringSuccessOnly filters to an identifier success property. */
		if (property.type === "Property" && property.key.type === "Identifier" && property.key.name === "success") {
			return property.key;
		}
	}

	/* v8 ignore next -- @preserve isDestructuringSuccessOnly proves a success key before this helper is called. */
	return undefined;
}

const noIanitorSuccessAccess = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		const ianitorCheckVariables = new Set<string>();
		const ianitorResultVariables = new Map<string, ResultVariable>();

		function markResultFullyUsed(name: string): void {
			const result = ianitorResultVariables.get(name);
			if (result !== undefined) result.referencedFully = true;
		}

		return {
			CallExpression(node): void {
				for (const argument of node.arguments) {
					if (argument.type === "Identifier") {
						const result = ianitorResultVariables.get(argument.name);
						if (result !== undefined) result.referencedFully = true;
					}
				}
			},

			MemberExpression({ computed, object, property }): void {
				if (computed || property.type !== "Identifier") return;
				const unwrapped = unwrapExpression(object);

				if (unwrapped.type === "CallExpression" && property.name === "success") {
					if (isCallToIanitorCheck(unwrapped, sourceCode)) {
						context.report({
							messageId: "preferCreateGuard",
							node: property,
						});
					}
					return;
				}

				/* v8 ignore next -- @preserve non-call member objects are only tracked when they are identifiers. */
				if (unwrapped.type === "Identifier") {
					const result = ianitorResultVariables.get(unwrapped.name);
					if (result !== undefined) result.properties.add(property.name);
				}
			},

			"Program:exit"(): void {
				for (const [, { firstSuccessNode, properties, referencedFully }] of ianitorResultVariables) {
					if (
						properties.has("success") &&
						!properties.has("error") &&
						!properties.has("value") &&
						!referencedFully
					) {
						context.report({
							messageId: "preferCreateGuard",
							node: firstSuccessNode,
						});
					}
				}
			},

			ReturnStatement({ argument }): void {
				if (argument?.type !== "Identifier") return;
				markResultFullyUsed(argument.name);
			},

			VariableDeclarator({ id, init }): void {
				if (init === null) return;

				const unwrappedInit = unwrapExpression(init);
				if (unwrappedInit.type !== "CallExpression") return;

				if (id.type === "Identifier" && isIanitorFactoryCall(unwrappedInit)) {
					ianitorCheckVariables.add(id.name);
					return;
				}

				if (
					id.type === "ObjectPattern" &&
					isCallToIanitorCheck(unwrappedInit, sourceCode) &&
					isDestructuringSuccessOnly(id)
				) {
					const keyNode = findSuccessPropertyKey(id);
					/* v8 ignore next -- @preserve isDestructuringSuccessOnly already proves the key exists. */
					if (keyNode !== undefined) {
						context.report({
							messageId: "preferCreateGuard",
							node: keyNode,
						});
					}
				}

				if (
					id.type === "Identifier" &&
					unwrappedInit.callee.type === "Identifier" &&
					ianitorCheckVariables.has(unwrappedInit.callee.name)
				) {
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
