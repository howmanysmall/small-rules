import { isStringRaw } from "./type-utilities";

import type { ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

export type ScopeVariable = Scope["set"] extends Map<string, infer VariableType> ? VariableType : never;

export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
	let current: ESTree.Expression = expression;

	while (true) {
		switch (current.type) {
			case "ChainExpression":
			case "ParenthesizedExpression":
			case "TSAsExpression":
			case "TSInstantiationExpression":
			case "TSNonNullExpression":
			case "TSSatisfiesExpression":
			case "TSTypeAssertion": {
				current = current.expression;
				break;
			}

			default:
				return current;
		}
	}
}

export function getMemberPropertyName(node: ESTree.MemberExpression): string | undefined {
	if (node.computed) {
		return node.property.type === "Literal" && isStringRaw(node.property.value) ? node.property.value : undefined;
	}

	/* v8 ignore next -- @preserve non-computed member properties are parser-provided identifiers. */
	return node.property.type === "Identifier" ? node.property.name : undefined;
}

export function getVariableByName(scope: null | Scope, name: string): ScopeVariable | undefined {
	let currentScope = scope;
	while (currentScope !== null) {
		const variable = currentScope.set.get(name);
		if (variable !== undefined) return variable;
		currentScope = currentScope.upper;
	}
	return undefined;
}

export function hasShadowedBinding(sourceCode: SourceCode, node: ESTree.Node, name: string): boolean {
	let scope: null | Scope = sourceCode.getScope(node);

	while (scope !== null) {
		const variable = scope.set.get(name);
		if (variable !== undefined && variable.defs.length > 0) return true;
		scope = scope.upper;
	}

	return false;
}
