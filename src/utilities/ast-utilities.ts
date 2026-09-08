import { isNode } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

export type ScopeVariable = Scope["set"] extends Map<string, infer VariableType> ? VariableType : never;

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

const AST_NODE_KEYS_TO_SKIP = new Set(["comments", "loc", "parent", "range", "tokens"]);
export const STOP_NODE_TRAVERSAL = Symbol("STOP_NODE_TRAVERSAL");

function pushNodeChildren(node: ESTree.Node, worklist: Array<ESTree.Node>): void {
	for (const [key, value] of Object.entries(node)) {
		if (AST_NODE_KEYS_TO_SKIP.has(key)) continue;
		if (Array.isArray(value)) {
			for (const child of value) {
				if (isNode(child)) worklist.push(child);
			}
			continue;
		}
		if (isNode(value)) worklist.push(value);
	}
}

export function forEachNode(
	root: ESTree.Node,
	visit: (node: ESTree.Node) => boolean | typeof STOP_NODE_TRAVERSAL | undefined | void,
): void {
	const worklist: Array<ESTree.Node> = [root];
	for (const current of worklist) {
		const result = visit(current);
		if (result === STOP_NODE_TRAVERSAL) break;
		if (result === false) continue;
		pushNodeChildren(current, worklist);
	}
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
