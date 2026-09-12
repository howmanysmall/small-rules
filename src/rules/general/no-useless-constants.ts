import { getDeclarationRemovalRange, hasAttachedComments } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ARRAY_EXPRESSION,
	BINARY_EXPRESSION,
	CALL_EXPRESSION,
	CHAIN_EXPRESSION,
	CONDITIONAL_EXPRESSION,
	IDENTIFIER,
	isAnyLiteral,
	isBindingIdentifier,
	isBlockStatement,
	isCallbackFunction,
	isCallExpression,
	isChainExpression,
	isClassExpression,
	isExportNamedDeclaration,
	isNewExpression,
	isParenthesizedExpression,
	isProgram,
	isProperty,
	isTsAsExpression,
	isTsInstantiationExpression,
	isTsNonNullExpression,
	isTsSatisfiesExpression,
	isTsTypeAssertion,
	isVariableDeclaration,
	isVariableDeclarator,
	JSX_ELEMENT,
	JSX_FRAGMENT,
	LOGICAL_EXPRESSION,
	MEMBER_EXPRESSION,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	SEQUENCE_EXPRESSION,
	SPREAD_ELEMENT,
	TEMPLATE_LITERAL,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
	UNARY_EXPRESSION,
	unwrapParenthesis,
} from "$oxc-utilities/oxc-utilities";
import { DEFAULT_STATIC_GLOBAL_FACTORIES, isStaticExpression } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, Fix, Reference, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/u;
const STATIC_OPTIONS: StaticExpressionOptions = {
	staticGlobalFactories: new Set(DEFAULT_STATIC_GLOBAL_FACTORIES),
};
const OBJECT_CONSTRUCTOR_PATTERNS: ReadonlyArray<string> = [
	String.raw`^Array\b`,
	String.raw`^Object\b`,
	String.raw`^Map\b`,
	String.raw`^Set\b`,
	String.raw`^WeakMap\b`,
	String.raw`^WeakSet\b`,
];

interface FixableConstant {
	readonly name: string;
	readonly declarationNode: ESTree.VariableDeclaration;
	readonly initializerText: string;
	readonly referenceIdentifier: ESTree.BindingIdentifier;
	readonly reportNode: ESTree.BindingIdentifier;
}

interface UselessConstantCandidate {
	readonly name: string;
	readonly declarationNode: ESTree.VariableDeclaration;
	readonly enclosingDeclaration: ESTree.VariableDeclaration;
	readonly initializer: ESTree.Expression;
	readonly referenceIdentifier: ESTree.BindingIdentifier;
	readonly reportNode: ESTree.BindingIdentifier;
}

type ScopeVariable = Scope["variables"][number];

function collectAllScopes(root: Scope): Array<Scope> {
	const scopes = new Array<Scope>();
	let size = 0;
	const stack = [root];

	while (stack.length > 0) {
		const current = stack.pop();
		/* v8 ignore next -- @preserve non-empty traversal stack always yields a scope from pop. */
		if (current === undefined) break;
		if (current.type !== "global") scopes[size++] = current;
		for (const childScope of current.childScopes) stack.push(childScope);
	}

	return scopes;
}

function isFunctionLikeInitializer(node: ESTree.Node): boolean {
	return isCallbackFunction(node) || isClassExpression(node);
}

const OBJECT_LIKE_INITIALIZER_TYPES: ReadonlySet<ESTree.Node["type"]> = new Set([
	ARRAY_EXPRESSION,
	OBJECT_EXPRESSION,
	JSX_ELEMENT,
	JSX_FRAGMENT,
] as const);

function isObjectLikeInitializer(
	initializer: ESTree.Expression,
	patterns: ReadonlyArray<RegExp>,
	sourceCode: SourceCode,
): boolean {
	if (OBJECT_LIKE_INITIALIZER_TYPES.has(initializer.type)) return true;
	if (!isCallExpression(initializer) && !isNewExpression(initializer)) return false;

	const candidateText = sourceCode.getText(initializer.callee);
	for (const pattern of patterns) if (pattern.test(candidateText)) return true;
	return false;
}

function isStatementContainer(node: ESTree.Node): node is ESTree.BlockStatement | ESTree.Program {
	return isProgram(node) || isBlockStatement(node);
}

function getCallRootIdentifierName(node: ESTree.Node): string | undefined {
	let current = node;
	while (true) {
		/* v8 ignore next 10 -- @preserve CallExpression/NewExpression callees do not expose TS wrapper nodes after parser normalization. */
		switch (current.type) {
			case CHAIN_EXPRESSION:
			case PARENTHESIZED_EXPRESSION:
			case TS_AS_EXPRESSION:
			case TS_INSTANTIATION_EXPRESSION:
			case TS_NON_NULL_EXPRESSION:
			case TS_SATISFIES_EXPRESSION:
			case TS_TYPE_ASSERTION: {
				current = current.expression;
				break;
			}

			case IDENTIFIER:
				return current.name;

			case MEMBER_EXPRESSION: {
				current = current.object;
				break;
			}

			default:
				/* v8 ignore next -- @preserve only handled expression nodes can appear as relocatable static call roots. */
				return undefined;
		}
	}
}

function appendRelocatableArrayElements(node: ESTree.ArrayExpression, worklist: Array<ESTree.Node>): boolean {
	for (const element of node.elements) {
		if (element === null) return false;
		worklist.push(element);
	}
	return true;
}

function appendRelocatableCallChildren(
	node: ESTree.CallExpression | ESTree.NewExpression,
	staticGlobalFactories: ReadonlySet<string>,
	worklist: Array<ESTree.Node>,
): boolean {
	const rootName = getCallRootIdentifierName(node.callee);
	/* v8 ignore next -- @preserve static-expression filtering rejects calls without an identifier or member root before relocation checks. */
	if (rootName === undefined || !staticGlobalFactories.has(rootName)) return false;

	worklist.push(node.callee);
	for (const parameter of node.arguments) worklist.push(parameter);
	return true;
}

function appendRelocatableObjectProperties(node: ESTree.ObjectExpression, worklist: Array<ESTree.Node>): boolean {
	for (const property of node.properties) {
		/* v8 ignore next -- @preserve spread object properties are rejected by static-expression analysis before relocation checks. */
		if (!isProperty(property)) return false;
		if (property.computed) worklist.push(property.key);
		worklist.push(property.value);
	}
	return true;
}

function appendRelocatableChildren(
	node: ESTree.Node,
	staticGlobalFactories: ReadonlySet<string>,
	worklist: Array<ESTree.Node>,
): boolean {
	/* v8 ignore next -- @preserve the current parser path does not emit ParenthesizedExpression nodes. */
	if (
		isChainExpression(node) ||
		isParenthesizedExpression(node) ||
		isTsAsExpression(node) ||
		isTsInstantiationExpression(node) ||
		isTsNonNullExpression(node) ||
		isTsSatisfiesExpression(node) ||
		isTsTypeAssertion(node)
	) {
		worklist.push(node.expression);
		return true;
	}

	switch (node.type) {
		case ARRAY_EXPRESSION:
			return appendRelocatableArrayElements(node, worklist);

		case BINARY_EXPRESSION:
		case LOGICAL_EXPRESSION: {
			worklist.push(node.left, node.right);
			return true;
		}

		case CALL_EXPRESSION:
		case NEW_EXPRESSION:
			return appendRelocatableCallChildren(node, staticGlobalFactories, worklist);

		case CONDITIONAL_EXPRESSION: {
			worklist.push(node.test, node.consequent, node.alternate);
			return true;
		}

		case MEMBER_EXPRESSION: {
			worklist.push(node.object);
			if (node.computed) worklist.push(node.property);
			return true;
		}

		case OBJECT_EXPRESSION:
			return appendRelocatableObjectProperties(node, worklist);

		case SEQUENCE_EXPRESSION:
		case SPREAD_ELEMENT:
			return false;

		case TEMPLATE_LITERAL: {
			for (const expression of node.expressions) worklist.push(expression);
			return true;
		}

		case UNARY_EXPRESSION: {
			worklist.push(node.argument);
			return true;
		}

		default:
			return true;
	}
}

function hasOnlyRelocatableCalls(node: ESTree.Node, staticGlobalFactories: ReadonlySet<string>): boolean {
	const worklist: Array<ESTree.Node> = [node];
	let index = 0;
	while (index < worklist.length) {
		const current = worklist[index];
		/* v8 ignore next -- @preserve the index is bounded by the worklist length. */
		if (current === undefined) return false;
		index += 1;
		if (!appendRelocatableChildren(current, staticGlobalFactories, worklist)) return false;
	}
	return true;
}

function isAutoInlineSafeInitializer(sourceCode: SourceCode, node: ESTree.Expression): boolean {
	if (isAnyLiteral(node)) return true;

	const seen = new Set<ESTree.Node>();
	return (
		isStaticExpression(sourceCode, node, seen, STATIC_OPTIONS) &&
		hasOnlyRelocatableCalls(node, STATIC_OPTIONS.staticGlobalFactories)
	);
}

function getInlineInitializerText(sourceCode: SourceCode, initializer: ESTree.Expression): string {
	return sourceCode.getText(unwrapParenthesis(initializer));
}

function areAdjacentStatements(first: ESTree.VariableDeclaration, second: ESTree.VariableDeclaration): boolean {
	const { parent } = first;
	/* v8 ignore next -- @preserve VariableDeclaration parents visited by this rule are Program or BlockStatement containers. */
	if (!isStatementContainer(parent)) return false;

	const { body } = parent;
	for (let index = 0; index < body.length; index += 1) {
		const statement = body[index];
		if (statement === first) return body[index + 1] === second;
	}

	/* v8 ignore next -- @preserve ESTree parent/body invariant: a declaration parented by a statement container is present in that container body. */
	return false;
}

function findEnclosingConstDeclarator(node: ESTree.Node): ESTree.VariableDeclarator | undefined {
	let current: ESTree.Node | null = node.parent;
	let previous: ESTree.Node = node;

	while (current !== null) {
		if (isVariableDeclarator(current) && current.init === previous) return current;

		previous = current;
		current = current.parent;
	}

	return undefined;
}

interface SingleConstDeclarator {
	readonly declarationNode: ESTree.VariableDeclaration;
	readonly declaratorId: ESTree.BindingIdentifier;
	readonly initializer: ESTree.Expression;
}

interface DeclaratorParts {
	readonly id: ESTree.BindingIdentifier;
	readonly init: ESTree.Expression;
}

function getDeclaratorParts(node: ESTree.Node): DeclaratorParts | undefined {
	/* v8 ignore next -- @preserve ESLint Variable defs for this scope variable point at binding variable declarators. */
	if (!isVariableDeclarator(node) || !isBindingIdentifier(node.id)) return undefined;
	const { init } = node;
	/* v8 ignore next -- @preserve reported runtime VariableDeclarators for const bindings always have initializers. */
	if (init === null) return undefined;
	return { id: node.id, init };
}

function getSingleDeclaration(parent: ESTree.Node | null): ESTree.VariableDeclaration | undefined {
	/* v8 ignore next -- @preserve ESLint variable definitions for Variable defs are parented by their VariableDeclaration. */
	if (parent === null || !isVariableDeclaration(parent)) return undefined;
	if (parent.kind !== "const") return undefined;
	if (parent.declarations.length !== 1) return undefined;
	if (isExportNamedDeclaration(parent.parent)) return undefined;
	return parent;
}

const noUselessConstants = createRule("no-useless-constants", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		const [rawOptions] = context.options;
		const ignoreCallPatterns = rawOptions?.ignoreCallPatterns ?? OBJECT_CONSTRUCTOR_PATTERNS;
		const ignoredCallPatternMatchers = ignoreCallPatterns.map((pattern) => new RegExp(pattern, "u"));

		function getSingleReadOnlyReference(scope: Scope, scopeVariable: ScopeVariable): Reference | undefined {
			let readOnlyReference: Reference | undefined;
			let readOnlyCount = 0;
			for (const scopeReference of scopeVariable.references) {
				if (!scopeReference.isReadOnly()) continue;
				readOnlyCount += 1;
				readOnlyReference = scopeReference;
			}

			if (
				readOnlyCount !== 1 ||
				readOnlyReference === undefined ||
				readOnlyReference.from !== scope ||
				sourceCode.getScope(readOnlyReference.identifier) !== scope
			) {
				return undefined;
			}

			return readOnlyReference;
		}

		function getSingleConstDeclarator(scopeVariable: ScopeVariable): SingleConstDeclarator | undefined {
			if (!SCREAMING_SNAKE_CASE.test(scopeVariable.name)) return undefined;

			const [variableDefinition] = scopeVariable.defs;
			if (variableDefinition?.type !== "Variable") return undefined;

			const parts = getDeclaratorParts(variableDefinition.node);
			if (parts === undefined) return undefined;

			const declarationNode = getSingleDeclaration(variableDefinition.parent);
			if (declarationNode === undefined) return undefined;

			return { declarationNode, declaratorId: parts.id, initializer: parts.init };
		}

		function isSkippedInitializer(initializer: ESTree.Expression): boolean {
			return (
				isFunctionLikeInitializer(initializer) ||
				isObjectLikeInitializer(initializer, ignoredCallPatternMatchers, sourceCode)
			);
		}

		function getSingleUseIdentifier(
			scope: Scope,
			scopeVariable: ScopeVariable,
		): ESTree.BindingIdentifier | undefined {
			const readOnlyReference = getSingleReadOnlyReference(scope, scopeVariable);
			if (readOnlyReference === undefined || !isBindingIdentifier(readOnlyReference.identifier)) {
				return undefined;
			}
			return readOnlyReference.identifier;
		}

		function getEnclosingConstDeclaration(
			identifier: ESTree.BindingIdentifier,
		): ESTree.VariableDeclaration | undefined {
			const enclosingDeclarator = findEnclosingConstDeclarator(identifier);
			if (enclosingDeclarator === undefined) return undefined;

			const enclosingDeclaration = enclosingDeclarator.parent;
			if (!isVariableDeclaration(enclosingDeclaration)) return undefined;
			if (enclosingDeclaration.kind !== "const") return undefined;
			return enclosingDeclaration;
		}

		function getUselessConstantCandidate(
			scope: Scope,
			scopeVariable: ScopeVariable,
		): undefined | UselessConstantCandidate {
			const declarator = getSingleConstDeclarator(scopeVariable);
			if (declarator === undefined) return undefined;
			if (isSkippedInitializer(declarator.initializer)) return undefined;

			const referenceIdentifier = getSingleUseIdentifier(scope, scopeVariable);
			if (referenceIdentifier === undefined) return undefined;

			const enclosingDeclaration = getEnclosingConstDeclaration(referenceIdentifier);
			if (enclosingDeclaration === undefined) return undefined;

			return {
				name: scopeVariable.name,
				declarationNode: declarator.declarationNode,
				enclosingDeclaration,
				initializer: declarator.initializer,
				referenceIdentifier,
				reportNode: declarator.declaratorId,
			};
		}

		function inspectScope(scope: Scope): void {
			const fixableConstants = new Array<FixableConstant>();
			for (const scopeVariable of scope.variables) {
				const candidate = getUselessConstantCandidate(scope, scopeVariable);
				if (candidate === undefined) continue;

				const isAdjacent = areAdjacentStatements(candidate.declarationNode, candidate.enclosingDeclaration);
				const isSafeStaticInitializer = isAutoInlineSafeInitializer(sourceCode, candidate.initializer);
				const hasSafeInlineSyntax = hasOnlyRelocatableCalls(
					candidate.initializer,
					STATIC_OPTIONS.staticGlobalFactories,
				);
				const canFix =
					(isAdjacent || isSafeStaticInitializer) &&
					hasSafeInlineSyntax &&
					!hasAttachedComments(sourceCode, candidate.declarationNode);

				if (!canFix) {
					context.report({
						data: { name: candidate.name },
						messageId: "uselessConstantNoFix",
						node: candidate.reportNode,
					});
					continue;
				}

				fixableConstants.push({
					name: candidate.name,
					declarationNode: candidate.declarationNode,
					initializerText: getInlineInitializerText(sourceCode, candidate.initializer),
					referenceIdentifier: candidate.referenceIdentifier,
					reportNode: candidate.reportNode,
				});
			}

			reportFixableConstants(fixableConstants);
		}

		function reportFixableConstants(fixableConstants: ReadonlyArray<FixableConstant>): void {
			const [firstFixableConstant] = fixableConstants;
			if (firstFixableConstant === undefined) return;

			context.report({
				data: {
					name: firstFixableConstant.name,
					names: fixableConstants.map((constant) => constant.name).join(", "),
				},
				fix(fixer): Array<Fix> {
					const fixes = new Array<Fix>();
					let size = 0;

					for (const constant of fixableConstants) {
						fixes[size++] = fixer.replaceText(constant.referenceIdentifier, constant.initializerText);
					}

					for (const constant of fixableConstants) {
						fixes[size++] = fixer.removeRange(
							getDeclarationRemovalRange(sourceCode.text, constant.declarationNode),
						);
					}

					return fixes;
				},
				messageId: fixableConstants.length === 1 ? "uselessConstant" : "uselessConstants",
				node: firstFixableConstant.reportNode,
			});
		}

		return {
			"Program:exit"(programNode): void {
				const programScope = sourceCode.getScope(programNode);
				const allScopes = collectAllScopes(programScope);

				for (const scope of allScopes) inspectScope(scope);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow constants that do not add value.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			uselessConstant:
				"Constant '{{name}}' is only referenced once in the same scope. Inline it directly, or move it to a higher scope if reference stability is needed.",
			uselessConstantNoFix:
				"Constant '{{name}}' is only referenced once in the same scope. It cannot be auto-inlined because the initializer is not safely movable or the declaration has attached comments. Inline it manually, or move it to a higher scope if reference stability is needed.",
			uselessConstants:
				"Constants '{{names}}' are only referenced once in the same scope. Inline them directly, or move them to a higher scope if reference stability is needed.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					ignoreCallPatterns: {
						default: [...OBJECT_CONSTRUCTOR_PATTERNS],
						description: "Regular expression patterns for call expressions that should be ignored.",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noUselessConstants;
