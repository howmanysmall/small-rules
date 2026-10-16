import {
	isArrayExpression,
	isCallExpression,
	isNewExpression,
	isNode,
	isObjectExpression,
	isProperty,
	isSpreadElement,
	isTsSatisfiesExpression,
} from "@small-rules/oxlint-utilities";

import type { ESTree, Scope, SourceCode, Variable } from "oxlint-plugin-utilities";

export type ScopeVariable = Variable;

export function getVariableByName(scope: null | Scope, name: string): undefined | Variable {
	let currentScope = scope;
	while (currentScope !== null) {
		const variable = currentScope.set.get(name);
		if (variable !== undefined) return variable;
		currentScope = currentScope.upper;
	}
	return undefined;
}

export function getReferencedVariable(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): undefined | Variable {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

export function hasUninitializedWrite(variable: Variable): boolean {
	return variable.references.some((reference) => reference.isWrite() && !reference.init);
}

export function pushChildScopes(scopes: Array<Scope>, scope: Scope): void {
	for (const child of scope.childScopes) scopes.push(child);
}

const AST_NODE_KEYS_TO_SKIP = new Set(["comments", "loc", "parent", "range", "tokens"]);
export const STOP_NODE_TRAVERSAL = Symbol("STOP_NODE_TRAVERSAL");

function pushNodeChildren(node: ESTree.Node, workList: Array<ESTree.Node>): void {
	for (const [key, value] of Object.entries(node)) {
		if (AST_NODE_KEYS_TO_SKIP.has(key)) continue;
		if (Array.isArray(value)) {
			for (const child of value) if (isNode(child)) workList.push(child);
			continue;
		}
		if (isNode(value)) workList.push(value);
	}
}

export function forEachNode(
	root: ESTree.Node,
	visit: (node: ESTree.Node) => boolean | typeof STOP_NODE_TRAVERSAL | undefined | void,
): void {
	const workList: Array<ESTree.Node> = [root];
	for (const current of workList) {
		const result = visit(current);
		if (result === STOP_NODE_TRAVERSAL) break;
		if (result === false) continue;
		pushNodeChildren(current, workList);
	}
}

export function forEachScopeVariable(sourceCode: SourceCode, callback: (variable: Variable) => void): void {
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

function isExternalRoot(outer: ESTree.Node, current: ESTree.Node): boolean | undefined {
	if (isTsSatisfiesExpression(outer)) return true;
	if (isCallExpression(outer) || isNewExpression(outer)) {
		return outer.arguments.some((argument) => argument === current);
	}
	return undefined;
}

function getClimbTarget(outer: ESTree.Node, current: ESTree.Node): ESTree.Node | undefined {
	if (isProperty(outer)) {
		if (outer.value !== current) return undefined;
		return outer.parent;
	}
	if (isArrayExpression(outer) || isSpreadElement(outer)) return outer;
	return undefined;
}

/**
 * Checks whether an object property's name is dictated by its consumer, such
 * as an object passed to a call or checked with `satisfies`.
 *
 * Nested objects and arrays inside an externally constrained object are also
 * constrained because the outer API dictates their keys.
 *
 * @param property - The object property to check.
 * @returns Whether the property name is constrained by external code.
 */
export function isExternallyConstrainedProperty({ parent }: ESTree.Node): boolean {
	/* v8 ignore next -- Property visitors are reached with ObjectExpression parents. @preserve */
	if (!isObjectExpression(parent)) return false;

	let current: ESTree.Node = parent;
	while (true) {
		// eslint-disable-next-line flawless/no-redundant-type-annotation -- fact check: false.
		const outer: ESTree.Node | null = current.parent;
		/* v8 ignore next -- climbable Object/Array/Property chains always terminate in a call, satisfies, or non-climbable wrapper before the parent chain ends. @preserve */
		if (outer === null) return false;
		const root = isExternalRoot(outer, current);
		if (root !== undefined) return root;
		const target = getClimbTarget(outer, current);
		if (target === undefined) return false;
		current = target;
	}
}
