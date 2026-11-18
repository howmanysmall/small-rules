import {
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
	isObjectPattern,
	isProperty,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";

import { getReferencedVariable, getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

interface ResultVariable {
	readonly firstSuccessNode: ESTree.Node;
	readonly properties: Set<string>;
	referencedFully: boolean;
}

function isIanitorFactoryCall(expression: ESTree.Expression): boolean {
	const unwrapped = stripExpressionWrappers(expression);
	if (!isCallExpression(unwrapped)) return false;

	const callee = stripExpressionWrappers(unwrapped.callee);
	if (!isMemberExpression(callee) || callee.computed) return false;

	const object = stripExpressionWrappers(callee.object);
	return isIdentifierNamed(object, "Ianitor") && isIdentifier(callee.property);
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
	const unwrappedCallee = stripExpressionWrappers(node.callee);
	if (isCallExpression(unwrappedCallee)) return isIanitorFactoryCall(unwrappedCallee);

	if (isIdentifier(unwrappedCallee)) {
		const variable = getVariableByName(sourceCode.getScope(node), unwrappedCallee.name);
		return variable !== undefined && isFromIanitorCheckVariable(variable);
	}

	return false;
}

function isDestructuringSuccessOnly(objectPattern: ESTree.ObjectPattern): boolean {
	let hasSuccess = false;

	for (const property of objectPattern.properties) {
		if (!isProperty(property) || !isIdentifier(property.key)) continue;
		const { name } = property.key;
		if (name === "error" || name === "value") return false;

		/* v8 ignore next -- @preserve success-only object patterns reach this path from parser Property keys. */
		if (name === "success") {
			hasSuccess = true;
		}
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
	return isIdentifier(id) && isIanitorFactoryCall(init);
}

function isSuccessOnlyDestructuring(id: ESTree.Node, init: ESTree.CallExpression, sourceCode: SourceCode): boolean {
	return isObjectPattern(id) && isCallToIanitorCheck(init, sourceCode) && isDestructuringSuccessOnly(id);
}

function isStoredCheckResult(init: ESTree.CallExpression, ianitorCheckVariables: ReadonlySet<string>): boolean {
	const callee = stripExpressionWrappers(init.callee);
	return isIdentifier(callee) && ianitorCheckVariables.has(callee.name);
}

function isSuccessOnlyResult({ properties, referencedFully }: ResultVariable): boolean {
	return !referencedFully && properties.has("success") && !properties.has("error") && !properties.has("value");
}

const noIanitorSuccessAccess = createRule("no-ianitor-success-access", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		const ianitorCheckVariables = new Set<string>();
		const ianitorResultVariables = new Map<string, ResultVariable>();
		// Tracked per declared variable too, so a name reused in another
		// scope keeps its own state instead of replacing the first one.
		const scopeResultVariables = new Map<ScopeVariable, ResultVariable>();

		function getScopeResult(identifier: ESTree.IdentifierReference): ResultVariable | undefined {
			const variable = getReferencedVariable(sourceCode, identifier);
			return variable === undefined ? undefined : scopeResultVariables.get(variable);
		}

		function recordScopeResults(declarator: ESTree.VariableDeclarator, firstSuccessNode: ESTree.Node): void {
			for (const variable of sourceCode.getDeclaredVariables(declarator)) {
				scopeResultVariables.set(variable, {
					firstSuccessNode,
					properties: new Set(),
					referencedFully: false,
				});
			}
		}

		function markResultFullyUsed(identifier: ESTree.IdentifierReference): void {
			const named = ianitorResultVariables.get(identifier.name);
			if (named !== undefined) {
				named.referencedFully = true;
			}

			const scoped = getScopeResult(identifier);
			if (scoped !== undefined) {
				scoped.referencedFully = true;
			}
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
					if (!isIdentifier(argument)) continue;
					markResultFullyUsed(argument);
				}
			},

			MemberExpression({ computed, object, property }): void {
				if (computed || !isIdentifier(property)) return;
				const unwrapped = stripExpressionWrappers(object);

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
				if (isIdentifier(unwrapped)) {
					const result = ianitorResultVariables.get(unwrapped.name);
					if (result !== undefined) {
						result.properties.add(property.name);
					}

					getScopeResult(unwrapped)?.properties.add(property.name);
				}
			},

			"Program:exit"(): void {
				const reported = new Set<ESTree.Node>();
				for (const result of ianitorResultVariables.values()) {
					if (!isSuccessOnlyResult(result)) continue;

					reported.add(result.firstSuccessNode);
					context.report({
						messageId: "preferCreateGuard",
						node: result.firstSuccessNode,
					});
				}

				for (const result of scopeResultVariables.values()) {
					if (reported.has(result.firstSuccessNode) || !isSuccessOnlyResult(result)) continue;

					context.report({
						messageId: "preferCreateGuard",
						node: result.firstSuccessNode,
					});
				}
			},

			ReturnStatement({ argument }): void {
				if (!isIdentifier(argument)) return;
				markResultFullyUsed(argument);
			},

			VariableDeclarator(node): void {
				const { id, init } = node;
				if (init === null) return;

				const unwrappedInit = stripExpressionWrappers(init);
				if (!isCallExpression(unwrappedInit)) return;

				if (isIdentifier(id) && isFactoryCheckDeclarator(id, unwrappedInit)) {
					ianitorCheckVariables.add(id.name);
					return;
				}

				if (isObjectPattern(id) && isSuccessOnlyDestructuring(id, unwrappedInit, sourceCode)) {
					reportSuccessOnlyDestructuring(id);
				}

				if (isIdentifier(id) && isStoredCheckResult(unwrappedInit, ianitorCheckVariables)) {
					ianitorResultVariables.set(id.name, {
						firstSuccessNode: id,
						properties: new Set(),
						referencedFully: false,
					});

					recordScopeResults(node, id);
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
