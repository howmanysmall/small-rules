import { getDeclarationRemovalRange, hasAttachedComments } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isBindingIdentifier,
	isCallbackFunction,
	isExportNamedDeclaration,
	isVariableDeclaration,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { DEFAULT_STATIC_GLOBAL_FACTORIES, isStaticExpression } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

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
	return isCallbackFunction(node) || node.type === "ClassExpression";
}

const OBJECT_LIKE_INITIALIZER_TYPES: ReadonlySet<ESTree.Node["type"]> = new Set([
	"ArrayExpression",
	"ObjectExpression",
	"JSXElement",
	"JSXFragment",
] as const);

function isObjectLikeInitializer(
	initializer: ESTree.Expression,
	patterns: ReadonlyArray<RegExp>,
	sourceCode: SourceCode,
): boolean {
	if (OBJECT_LIKE_INITIALIZER_TYPES.has(initializer.type)) return true;
	if (initializer.type !== "CallExpression" && initializer.type !== "NewExpression") return false;

	const candidateText = sourceCode.getText(initializer.callee);
	for (const pattern of patterns) if (pattern.test(candidateText)) return true;
	return false;
}

function isStatementContainer(node: ESTree.Node): node is ESTree.BlockStatement | ESTree.Program {
	return node.type === "Program" || node.type === "BlockStatement";
}

function getCallRootIdentifierName(node: ESTree.Node): string | undefined {
	let current = node;
	while (true) {
		/* v8 ignore next 10 -- @preserve CallExpression/NewExpression callees do not expose TS wrapper nodes after parser normalization. */
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

			case "Identifier": {
				return current.name;
			}

			case "MemberExpression": {
				current = current.object;
				break;
			}

			default: {
				/* v8 ignore next -- @preserve only handled expression nodes can appear as relocatable static call roots. */
				return undefined;
			}
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
		if (property.type !== "Property") return false;
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
		node.type === "ChainExpression" ||
		node.type === "ParenthesizedExpression" ||
		node.type === "TSAsExpression" ||
		node.type === "TSInstantiationExpression" ||
		node.type === "TSNonNullExpression" ||
		node.type === "TSSatisfiesExpression" ||
		node.type === "TSTypeAssertion"
	) {
		worklist.push(node.expression);
		return true;
	}

	switch (node.type) {
		case "ArrayExpression": {
			return appendRelocatableArrayElements(node, worklist);
		}

		case "BinaryExpression":
		case "LogicalExpression": {
			worklist.push(node.left, node.right);
			return true;
		}

		case "CallExpression":
		case "NewExpression": {
			return appendRelocatableCallChildren(node, staticGlobalFactories, worklist);
		}

		case "ConditionalExpression": {
			worklist.push(node.test, node.consequent, node.alternate);
			return true;
		}

		case "MemberExpression": {
			worklist.push(node.object);
			if (node.computed) worklist.push(node.property);
			return true;
		}

		case "ObjectExpression": {
			return appendRelocatableObjectProperties(node, worklist);
		}

		case "SequenceExpression":
		case "SpreadElement": {
			return false;
		}

		case "TemplateLiteral": {
			for (const expression of node.expressions) worklist.push(expression);
			return true;
		}

		case "UnaryExpression": {
			worklist.push(node.argument);
			return true;
		}

		default: {
			return true;
		}
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
	if (!isStatementContainer(parent)) return false;

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

const noUselessConstants = createRule("no-useless-constants", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		const [rawOptions] = context.options;
		const ignoreCallPatterns = rawOptions?.ignoreCallPatterns ?? OBJECT_CONSTRUCTOR_PATTERNS;
		const ignoredCallPatternMatchers = ignoreCallPatterns.map((pattern) => new RegExp(pattern, "u"));

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
		): undefined | UselessConstantCandidate {
			const { name } = scopeVariable;
			if (!SCREAMING_SNAKE_CASE.test(name)) return undefined;

			const [variableDefinition] = scopeVariable.defs;
			if (variableDefinition?.type !== "Variable") return undefined;

			const declaratorNode = variableDefinition.node;
			/* v8 ignore next -- @preserve ESLint Variable defs for this scope variable point at binding variable declarators. */
			if (!isVariableDeclarator(declaratorNode) || !isBindingIdentifier(declaratorNode.id)) return undefined;
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
				name,
				declarationNode,
				enclosingDeclaration,
				initializer,
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
