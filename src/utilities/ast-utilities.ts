import { Predicate } from "effect";

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
		return node.property.type === "Literal" && Predicate.isString(node.property.value)
			? node.property.value
			: undefined;
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

export function pushChildScopes(scopes: Array<Scope>, scope: Scope): void {
	for (const child of scope.childScopes) scopes.push(child);
}

export function forEachScopeVariable(sourceCode: SourceCode, callback: (variable: ScopeVariable) => void): void {
	const scopes = [sourceCode.getScope(sourceCode.ast)];
	for (const scope of scopes) {
		pushChildScopes(scopes, scope);
		for (const variable of scope.variables) callback(variable);
	}
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

export function getDeclarationRemovalRange(
	sourceText: string,
	declarationNode: ESTree.Node,
): [start: number, end: number] {
	let [start] = declarationNode.range;
	while (start > 0) {
		const previousCharacter = sourceText[start - 1];
		if (previousCharacter === " " || previousCharacter === "\t") {
			start -= 1;
			continue;
		}
		break;
	}

	const [, declarationEnd] = declarationNode.range;
	let end = declarationEnd;
	while (end < sourceText.length) {
		const nextCharacter = sourceText[end];
		if (nextCharacter === "\n" || nextCharacter === "\r") {
			end += 1;
			continue;
		}
		break;
	}

	return [start, end];
}

export function hasAttachedComments(sourceCode: SourceCode, node: ESTree.Node): boolean {
	if (sourceCode.getCommentsInside(node).length > 0) return true;

	const nodeStartLine = node.loc.start.line;
	const nodeEndLine = node.loc.end.line;

	for (const comment of sourceCode.getCommentsBefore(node)) {
		const commentEndLine = comment.loc.end.line;
		if (commentEndLine === nodeStartLine || commentEndLine === nodeStartLine - 1) return true;
	}

	for (const comment of sourceCode.getCommentsAfter(node)) {
		const commentStartLine = comment.loc.start.line;
		if (commentStartLine === nodeEndLine || commentStartLine === nodeEndLine + 1) return true;
	}

	return false;
}
