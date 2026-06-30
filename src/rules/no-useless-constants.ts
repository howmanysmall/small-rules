import { isCallbackFunction, isExportNamedDeclaration } from "$oxc-utilities/oxc-utilities";
import { DEFAULT_STATIC_GLOBAL_FACTORIES, isStaticExpression } from "$oxc-utilities/static-expression-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";
import type { ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

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
	readonly declarationNode: ESTree.VariableDeclaration;
	readonly initializerText: string;
	readonly name: string;
	readonly referenceIdentifier: ESTree.BindingIdentifier;
	readonly reportNode: ESTree.BindingIdentifier;
}

interface UselessConstantCandidate {
	readonly declarationNode: ESTree.VariableDeclaration;
	readonly enclosingDeclaration: ESTree.VariableDeclaration;
	readonly initializer: ESTree.Expression;
	readonly name: string;
	readonly referenceIdentifier: ESTree.BindingIdentifier;
	readonly reportNode: ESTree.BindingIdentifier;
}

type ScopeVariable = Scope["variables"][number];

function collectAllScopes(root: Scope): Array<Scope> {
	const scopes: Array<Scope> = [];
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

function isBindingIdentifier(node: ESTree.Node): node is ESTree.BindingIdentifier {
	return node.type === "Identifier";
}

function isVariableDeclarator(node: ESTree.Node): node is ESTree.VariableDeclarator {
	return node.type === "VariableDeclarator";
}

function isVariableDeclaration(node: ESTree.Node): node is ESTree.VariableDeclaration {
	return node.type === "VariableDeclaration";
}

function isFunctionLikeInitializer(node: ESTree.Node): boolean {
	return isCallbackFunction(node) || node.type === "ClassExpression";
}

function isObjectLikeInitializer(
	initializer: ESTree.Expression,
	patterns: ReadonlyArray<RegExp>,
	sourceCode: SourceCode,
): boolean {
	if (initializer.type === "ArrayExpression" || initializer.type === "ObjectExpression") return true;
	if (initializer.type === "JSXElement" || initializer.type === "JSXFragment") return true;
	if (initializer.type !== "CallExpression" && initializer.type !== "NewExpression") return false;

	const candidateText = sourceCode.getText(initializer.callee);
	for (const pattern of patterns) if (pattern.test(candidateText)) return true;
	return false;
}

function isStatementContainer(node: ESTree.Node): node is ESTree.BlockStatement | ESTree.Program {
	return node.type === "Program" || node.type === "BlockStatement";
}

function getCallRootIdentifierName(node: ESTree.Node): string | undefined {
	/* v8 ignore next 10 -- @preserve CallExpression/NewExpression callees do not expose TS wrapper nodes after parser normalization. */
	switch (node.type) {
		case "ChainExpression":
		case "ParenthesizedExpression":
		case "TSAsExpression":
		case "TSInstantiationExpression":
		case "TSNonNullExpression":
		case "TSSatisfiesExpression":
		case "TSTypeAssertion":
			return getCallRootIdentifierName(node.expression);

		case "Identifier":
			return node.name;

		case "MemberExpression":
			return getCallRootIdentifierName(node.object);

		default:
			/* v8 ignore next -- @preserve only handled expression nodes can appear as relocatable static call roots. */
			return undefined;
	}
}

function hasOnlyRelocatableCalls(node: ESTree.Node, staticGlobalFactories: ReadonlySet<string>): boolean {
	switch (node.type) {
		case "ArrayExpression":
			return hasOnlyRelocatableArrayElements(node, staticGlobalFactories);

		case "BinaryExpression":
		case "LogicalExpression":
			return hasOnlyRelocatablePair(node, staticGlobalFactories);

		case "CallExpression":
		case "NewExpression":
			return hasOnlyRelocatableCall(node, staticGlobalFactories);

		case "ChainExpression":
			return hasOnlyRelocatableCalls(node.expression, staticGlobalFactories);

		/* v8 ignore next -- @preserve the current parser path does not emit ParenthesizedExpression nodes. */
		case "ParenthesizedExpression":
		case "TSAsExpression":
		case "TSInstantiationExpression":
		case "TSNonNullExpression":
		case "TSSatisfiesExpression":
		case "TSTypeAssertion": {
			return hasOnlyRelocatableCalls(node.expression, staticGlobalFactories);
		}

		case "ConditionalExpression":
			return hasOnlyRelocatableConditional(node, staticGlobalFactories);

		case "MemberExpression":
			return hasOnlyRelocatableMember(node, staticGlobalFactories);

		case "ObjectExpression":
			return hasOnlyRelocatableObjectProperties(node, staticGlobalFactories);

		case "SequenceExpression":
			return false;

		case "SpreadElement":
			return false;

		case "TemplateLiteral":
			return hasOnlyRelocatableExpressions(node.expressions, staticGlobalFactories);

		case "UnaryExpression":
			return hasOnlyRelocatableCalls(node.argument, staticGlobalFactories);

		default:
			return true;
	}
}

function hasOnlyRelocatableArrayElements(
	node: ESTree.ArrayExpression,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	for (const element of node.elements) {
		if (element === null || !hasOnlyRelocatableCalls(element, staticGlobalFactories)) return false;
	}

	return true;
}

function hasOnlyRelocatablePair(
	node: ESTree.BinaryExpression | ESTree.LogicalExpression | ESTree.PrivateInExpression,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	return (
		hasOnlyRelocatableCalls(node.left, staticGlobalFactories) &&
		hasOnlyRelocatableCalls(node.right, staticGlobalFactories)
	);
}

function hasOnlyRelocatableCall(
	node: ESTree.CallExpression | ESTree.NewExpression,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	const rootName = getCallRootIdentifierName(node.callee);
	/* v8 ignore next -- @preserve static-expression filtering rejects calls without an identifier or member root before relocation checks. */
	if (rootName === undefined || !staticGlobalFactories.has(rootName)) return false;
	/* v8 ignore next -- @preserve parser-normalized static call callees are identifiers or static member chains handled above. */
	if (!hasOnlyRelocatableCalls(node.callee, staticGlobalFactories)) return false;
	return hasOnlyRelocatableExpressions(node.arguments, staticGlobalFactories);
}

function hasOnlyRelocatableConditional(
	node: ESTree.ConditionalExpression,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	return (
		hasOnlyRelocatableCalls(node.test, staticGlobalFactories) &&
		hasOnlyRelocatableCalls(node.consequent, staticGlobalFactories) &&
		hasOnlyRelocatableCalls(node.alternate, staticGlobalFactories)
	);
}

function hasOnlyRelocatableMember(node: ESTree.MemberExpression, staticGlobalFactories: ReadonlySet<string>): boolean {
	return (
		hasOnlyRelocatableCalls(node.object, staticGlobalFactories) &&
		(!node.computed || hasOnlyRelocatableCalls(node.property, staticGlobalFactories))
	);
}

function hasOnlyRelocatableObjectProperties(
	node: ESTree.ObjectExpression,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	for (const property of node.properties) {
		/* v8 ignore next -- @preserve spread object properties are rejected by static-expression analysis before relocation checks. */
		if (property.type !== "Property") return false;
		/* v8 ignore next -- @preserve computed object keys with non-relocatable expressions are rejected by static-expression analysis first. */
		if (property.computed && !hasOnlyRelocatableCalls(property.key, staticGlobalFactories)) return false;
		/* v8 ignore next -- @preserve object property values have already passed static-expression analysis before relocation checks. */
		if (!hasOnlyRelocatableCalls(property.value, staticGlobalFactories)) return false;
	}

	return true;
}

function hasOnlyRelocatableExpressions(
	expressions: ReadonlyArray<ESTree.Node>,
	staticGlobalFactories: ReadonlySet<string>,
): boolean {
	for (const expression of expressions) {
		if (!hasOnlyRelocatableCalls(expression, staticGlobalFactories)) return false;
	}

	return true;
}

function isAutoInlineSafeInitializer(sourceCode: SourceCode, node: ESTree.Expression): boolean {
	if (node.type === "Literal") return true;

	const seen = new Set<ESTree.Node>();
	return (
		isStaticExpression(sourceCode, node, seen, STATIC_OPTIONS) &&
		hasOnlyRelocatableCalls(node, STATIC_OPTIONS.staticGlobalFactories)
	);
}

function getInlineInitializerText(sourceCode: SourceCode, initializer: ESTree.Expression): string {
	let current = initializer;
	while (current.type === "ParenthesizedExpression") current = current.expression;
	return sourceCode.getText(current);
}

function areAdjacentStatements(first: ESTree.VariableDeclaration, second: ESTree.VariableDeclaration): boolean {
	const { parent } = first;
	/* v8 ignore next -- @preserve VariableDeclaration parents visited by this rule are Program or BlockStatement containers. */
	if (parent === undefined || parent === null || !isStatementContainer(parent)) return false;

	const { body } = parent;
	for (let index = 0; index < body.length; index += 1) {
		const statement = body[index];
		if (statement === first) {
			const nextStatement = body[index + 1];
			return nextStatement === second;
		}
	}

	/* v8 ignore next -- @preserve ESTree parent/body invariant: a declaration parented by a statement container is present in that container body. */
	return false;
}

function getDeclarationRemovalRange(
	sourceText: string,
	declarationNode: ESTree.VariableDeclaration,
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

function findEnclosingConstDeclarator(node: ESTree.Node): ESTree.VariableDeclarator | undefined {
	let current: ESTree.Node | null | undefined = node.parent;
	let previous: ESTree.Node = node;

	while (current !== undefined && current !== null) {
		if (isVariableDeclarator(current) && current.init === previous) return current;

		previous = current;
		current = current.parent;
	}

	return undefined;
}

const noUselessConstants = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const [rawOptions] = context.options;
		const ignoreCallPatterns = rawOptions?.ignoreCallPatterns ?? OBJECT_CONSTRUCTOR_PATTERNS;
		const ignoredCallPatternMatchers = ignoreCallPatterns.map((pattern) => new RegExp(pattern, "u"));

		function hasAttachedComments(node: ESTree.Node): boolean {
			if (sourceCode.getCommentsInside(node).length > 0) return true;

			const nodeStartLine = node.loc?.start.line;
			const nodeEndLine = node.loc?.end.line;
			/* v8 ignore next -- @preserve parser-provided rule nodes always include location data. */
			if (nodeStartLine === undefined || nodeEndLine === undefined) return false;

			for (const comment of sourceCode.getCommentsBefore(node)) {
				const commentEndLine = comment.loc?.end.line;
				if (commentEndLine === nodeStartLine || commentEndLine === nodeStartLine - 1) return true;
			}

			for (const comment of sourceCode.getCommentsAfter(node)) {
				const commentStartLine = comment.loc?.start.line;
				if (commentStartLine === nodeEndLine || commentStartLine === nodeEndLine + 1) return true;
			}

			return false;
		}

		function getSingleReadOnlyReference(
			scope: Scope,
			scopeVariable: ScopeVariable,
		): Scope["references"][number] | undefined {
			let readOnlyReference: Scope["references"][number] | undefined;
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

		function getUselessConstantCandidate(
			scope: Scope,
			scopeVariable: ScopeVariable,
		): UselessConstantCandidate | undefined {
			const { name } = scopeVariable;
			if (!SCREAMING_SNAKE_CASE.test(name)) return undefined;

			const [variableDefinition] = scopeVariable.defs;
			if (variableDefinition?.type !== "Variable") return undefined;

			const declaratorNode = variableDefinition.node;
			/* v8 ignore next -- @preserve ESLint Variable defs for this scope variable point at binding variable declarators. */
			if (!(isVariableDeclarator(declaratorNode) && isBindingIdentifier(declaratorNode.id))) return undefined;
			/* v8 ignore next -- @preserve reported runtime VariableDeclarators for const bindings always have initializers. */
			if (declaratorNode.init === null) return undefined;

			const declarationNode = variableDefinition.parent;
			/* v8 ignore next -- @preserve ESLint variable definitions for Variable defs are parented by their VariableDeclaration. */
			if (declarationNode === null || !isVariableDeclaration(declarationNode)) {
				return undefined;
			}
			if (declarationNode.kind !== "const" || declarationNode.declarations.length !== 1) return undefined;
			if (isExportNamedDeclaration(declarationNode.parent)) return undefined;

			const initializer = declaratorNode.init;
			if (isFunctionLikeInitializer(initializer)) return undefined;
			if (isObjectLikeInitializer(initializer, ignoredCallPatternMatchers, sourceCode)) return undefined;

			const readOnlyReference = getSingleReadOnlyReference(scope, scopeVariable);
			if (readOnlyReference === undefined || !isBindingIdentifier(readOnlyReference.identifier)) return undefined;

			const enclosingDeclarator = findEnclosingConstDeclarator(readOnlyReference.identifier);
			if (enclosingDeclarator === undefined) return undefined;

			const enclosingDeclaration = enclosingDeclarator.parent;
			if (!isVariableDeclaration(enclosingDeclaration) || enclosingDeclaration.kind !== "const") return undefined;

			return {
				declarationNode,
				enclosingDeclaration,
				initializer,
				name,
				referenceIdentifier: readOnlyReference.identifier,
				reportNode: declaratorNode.id,
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
					!hasAttachedComments(candidate.declarationNode);

				if (!canFix) {
					context.report({
						data: { name: candidate.name },
						messageId: "uselessConstantNoFix",
						node: candidate.reportNode,
					});
					continue;
				}

				fixableConstants.push({
					declarationNode: candidate.declarationNode,
					initializerText: getInlineInitializerText(sourceCode, candidate.initializer),
					name: candidate.name,
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
					const fixes: Array<Fix> = [];
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

				for (const scope of allScopes) {
					inspectScope(scope);
				}
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
