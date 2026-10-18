import {
	getTypeAnnotationFromBinding,
	hasName,
	isArrayExpression,
	isCallExpression,
	isIdentifier,
	isImportDeclaration,
	isMemberExpression,
	isNewExpression,
	isNode,
	isObjectExpression,
	isProperty,
	isSpreadElement,
	isStringLiteral,
	isTsImportType,
	isTsIndexedAccessType,
	isTsInterfaceDeclaration,
	isTsIntersectionType,
	isTsQualifiedName,
	isTsSatisfiesExpression,
	isTsTypeAliasDeclaration,
	isTsTypeReference,
	isTsUnionType,
	isTypeAssertionExpression,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";

import type { Definition, ESTree, Scope, SourceCode, Variable } from "oxlint-plugin-utilities";

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

const NON_PACKAGE_IMPORT_PATTERN = /^(?:[#$./]|[~@]\/)/u;

function isExternalModuleSpecifier(specifier: string): boolean {
	return !NON_PACKAGE_IMPORT_PATTERN.test(specifier);
}

export function isExternalPackageImport(definition: Definition | undefined): boolean {
	if (definition?.type !== "ImportBinding") return false;

	const { parent } = definition;
	/* v8 ignore next -- @preserve parser import bindings retain their ImportDeclaration parent. */
	if (parent === null || !isImportDeclaration(parent) || !isStringLiteral(parent.source)) return false;

	return isExternalModuleSpecifier(parent.source.value);
}

function getRootTypeName(typeName: ESTree.TSTypeName): ESTree.IdentifierReference | undefined {
	let current = typeName;
	while (isTsQualifiedName(current)) current = current.left;
	/* v8 ignore next -- @preserve TSTypeReference cannot use a this expression as its type name in parsed source. */
	return isIdentifier(current) ? current : undefined;
}

export function isExternalType(typeAnnotation: ESTree.TSType, sourceCode: SourceCode): boolean {
	return isExternalTypeNode(typeAnnotation, sourceCode, new Set<object>());
}

function isExternalTypeNode(
	typeAnnotation: ESTree.TSType,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	let current = typeAnnotation;
	while (isTsIndexedAccessType(current)) current = current.objectType;

	if (isTsImportType(current)) return isExternalModuleSpecifier(current.source.value);
	if (isTsTypeReference(current)) {
		const rootTypeName = getRootTypeName(current.typeName);
		/* v8 ignore next -- @preserve parsed TSTypeReference names always resolve to an identifier root. */
		if (rootTypeName === undefined) return false;

		return isExternalNamedType(
			rootTypeName.name,
			sourceCode.getScope(rootTypeName),
			current.typeArguments,
			sourceCode,
			visitedDeclarations,
		);
	}
	if (isTsUnionType(current) || isTsIntersectionType(current)) {
		return current.types.some((member) => isExternalTypeNode(member, sourceCode, visitedDeclarations));
	}

	return false;
}

function isExternalNamedType(
	name: string,
	scope: null | Scope,
	typeArguments: ESTree.TSTypeParameterInstantiation | null,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	const definition = getVariableByName(scope, name)?.defs[0];
	if (isExternalPackageImport(definition)) return true;

	if (definition === undefined) {
		if (typeArguments === null) return false;
		return typeArguments.params.some((parameter) => isExternalTypeNode(parameter, sourceCode, visitedDeclarations));
	}

	const declaration = definition.node;
	if (isTsTypeAliasDeclaration(declaration)) {
		if (visitedDeclarations.has(declaration)) return false;
		visitedDeclarations.add(declaration);
		return isExternalTypeNode(declaration.typeAnnotation, sourceCode, visitedDeclarations);
	}
	if (isTsInterfaceDeclaration(declaration)) {
		return declaration.extends.some((heritage) =>
			isExternalInterfaceHeritage(heritage, sourceCode, visitedDeclarations),
		);
	}

	return false;
}

function isExternalInterfaceHeritage(
	heritage: ESTree.TSInterfaceHeritage,
	sourceCode: SourceCode,
	visitedDeclarations: Set<object>,
): boolean {
	const rootNode = resolveRootObjectIdentifier(heritage.expression);
	/* v8 ignore next -- @preserve parsed heritage roots resolve to named identifiers or import types. */
	if (rootNode === undefined || !hasName(rootNode)) return false;

	return isExternalNamedType(
		rootNode.name,
		sourceCode.getScope(rootNode),
		heritage.typeArguments,
		sourceCode,
		visitedDeclarations,
	);
}

export function resolveRootObjectIdentifier(node: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	while (true) {
		if (isIdentifier(current)) return current;
		if (isMemberExpression(current)) {
			current = current.object;
			continue;
		}
		if (isTsQualifiedName(current)) {
			current = current.left;
			continue;
		}
		return undefined;
	}
}

function isExternalRoot(outer: ESTree.Node, current: ESTree.Node, sourceCode: SourceCode): boolean | undefined {
	if (isTsSatisfiesExpression(outer)) return true;
	if (isCallExpression(outer) || isNewExpression(outer)) {
		return outer.arguments.some((argument) => argument === current);
	}
	if (isVariableDeclarator(outer) && outer.init === current) {
		const annotation = getTypeAnnotationFromBinding(outer.id)?.typeAnnotation;
		return annotation !== undefined && isExternalType(annotation, sourceCode);
	}
	if (
		isTypeAssertionExpression(outer) &&
		outer.expression === current &&
		isExternalType(outer.typeAnnotation, sourceCode)
	) {
		return true;
	}
	return undefined;
}

function getClimbTarget(outer: ESTree.Node, current: ESTree.Node): ESTree.Node | undefined {
	if (isProperty(outer)) {
		if (outer.value !== current) return undefined;
		return outer.parent;
	}
	if (isArrayExpression(outer) || isSpreadElement(outer)) return outer;
	if (isTypeAssertionExpression(outer) && outer.expression === current) return outer;
	return undefined;
}

/**
 * Checks whether an object property's name is dictated by its consumer, such
 * as an object passed to a call, checked with `satisfies`, or annotated with
 * a type imported from another package.
 *
 * Nested objects and arrays inside an externally constrained object are also
 * constrained because the outer API dictates their keys.
 *
 * @param property - The object property to check.
 * @param sourceCode - The source code used to resolve type and import bindings.
 * @returns Whether the property name is constrained by external code.
 */
export function isExternallyConstrainedProperty({ parent }: ESTree.Node, sourceCode: SourceCode): boolean {
	/* v8 ignore next -- Property visitors are reached with ObjectExpression parents. @preserve */
	if (!isObjectExpression(parent)) return false;

	let current: ESTree.Node = parent;
	while (true) {
		// eslint-disable-next-line flawless/no-redundant-type-annotation -- fact check: false.
		const outer: ESTree.Node | null = current.parent;
		/* v8 ignore next -- climbable Object/Array/Property chains always terminate in a call, satisfies, or non-climbable wrapper before the parent chain ends. @preserve */
		if (outer === null) return false;
		const root = isExternalRoot(outer, current, sourceCode);
		if (root !== undefined) return root;
		const target = getClimbTarget(outer, current);
		if (target === undefined) return false;
		current = target;
	}
}
