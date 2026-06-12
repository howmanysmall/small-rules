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

function collectAllScopes(root: Scope): Array<Scope> {
	const scopes: Array<Scope> = [];
	let size = 0;
	const stack = [root];

	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) break;
		scopes[size++] = current;
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
	return patterns.some((pattern) => pattern.test(candidateText));
}

function isStatementContainer(node: ESTree.Node): node is ESTree.BlockStatement | ESTree.Program {
	return node.type === "Program" || node.type === "BlockStatement";
}

function getCallRootIdentifierName(node: ESTree.Node): string | undefined {
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
			return undefined;
	}
}

function hasOnlyRelocatableCalls(node: ESTree.Node, staticGlobalFactories: ReadonlySet<string>): boolean {
	switch (node.type) {
		case "ArrayExpression": {
			for (const element of node.elements) {
				if (element === null || !hasOnlyRelocatableCalls(element, staticGlobalFactories)) return false;
			}
			return true;
		}

		case "BinaryExpression":
		case "LogicalExpression": {
			return (
				hasOnlyRelocatableCalls(node.left, staticGlobalFactories) &&
				hasOnlyRelocatableCalls(node.right, staticGlobalFactories)
			);
		}

		case "CallExpression":
		case "NewExpression": {
			const rootName = getCallRootIdentifierName(node.callee);
			if (rootName === undefined || !staticGlobalFactories.has(rootName)) return false;
			if (!hasOnlyRelocatableCalls(node.callee, staticGlobalFactories)) return false;

			for (const argument of node.arguments) {
				if (!hasOnlyRelocatableCalls(argument, staticGlobalFactories)) return false;
			}
			return true;
		}

		case "ChainExpression":
		case "ParenthesizedExpression":
		case "TSAsExpression":
		case "TSInstantiationExpression":
		case "TSNonNullExpression":
		case "TSSatisfiesExpression":
		case "TSTypeAssertion": {
			return hasOnlyRelocatableCalls(node.expression, staticGlobalFactories);
		}

		case "ConditionalExpression": {
			return (
				hasOnlyRelocatableCalls(node.test, staticGlobalFactories) &&
				hasOnlyRelocatableCalls(node.consequent, staticGlobalFactories) &&
				hasOnlyRelocatableCalls(node.alternate, staticGlobalFactories)
			);
		}

		case "MemberExpression": {
			return (
				hasOnlyRelocatableCalls(node.object, staticGlobalFactories) &&
				(!node.computed || hasOnlyRelocatableCalls(node.property, staticGlobalFactories))
			);
		}

		case "ObjectExpression": {
			for (const property of node.properties) {
				if (property.type !== "Property") return false;
				if (property.computed && !hasOnlyRelocatableCalls(property.key, staticGlobalFactories)) return false;
				if (!hasOnlyRelocatableCalls(property.value, staticGlobalFactories)) return false;
			}
			return true;
		}

		case "SequenceExpression": {
			for (const expression of node.expressions) {
				if (!hasOnlyRelocatableCalls(expression, staticGlobalFactories)) return false;
			}
			return node.expressions.length > 0;
		}

		case "SpreadElement":
			return false;

		case "TemplateLiteral": {
			for (const expression of node.expressions) {
				if (!hasOnlyRelocatableCalls(expression, staticGlobalFactories)) return false;
			}
			return true;
		}

		case "UnaryExpression":
			return hasOnlyRelocatableCalls(node.argument, staticGlobalFactories);

		default:
			return true;
	}
}

function isAutoInlineSafeInitializer(sourceCode: SourceCode, node: ESTree.Expression): boolean {
	if (node.type === "Literal") return true;

	const seen = new Set<ESTree.Node>();
	return (
		isStaticExpression(sourceCode, node, seen, STATIC_OPTIONS) &&
		hasOnlyRelocatableCalls(node, STATIC_OPTIONS.staticGlobalFactories)
	);
}

function areAdjacentStatements(first: ESTree.VariableDeclaration, second: ESTree.VariableDeclaration): boolean {
	const { parent } = first;
	if (parent === undefined || parent === null || !isStatementContainer(parent)) return false;

	const { body } = parent;
	for (let index = 0; index < body.length; index += 1) {
		const statement = body[index];
		if (statement === first) {
			const nextStatement = body[index + 1];
			return nextStatement === second;
		}
	}

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

	// biome-ignore lint/nursery/useDestructuring: produces ugly
	let end = declarationNode.range[1];
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

		return {
			"Program:exit"(programNode): void {
				const programScope = sourceCode.getScope(programNode);
				const allScopes = collectAllScopes(programScope);

				for (const scope of allScopes) {
					if (scope.type === "global") continue;

					const fixableConstants = new Array<FixableConstant>();
					for (const scopeVariable of scope.variables) {
						const { name } = scopeVariable;
						if (!SCREAMING_SNAKE_CASE.test(name)) continue;

						const [variableDefinition] = scopeVariable.defs;
						if (variableDefinition?.type !== "Variable") continue;

						const declaratorNode = variableDefinition.node;
						if (!(isVariableDeclarator(declaratorNode) && isBindingIdentifier(declaratorNode.id))) continue;
						if (declaratorNode.init === null) continue;

						const declarationNode = variableDefinition.parent;
						if (declarationNode === null || !isVariableDeclaration(declarationNode)) continue;
						if (declarationNode.kind !== "const" || declarationNode.declarations.length !== 1) continue;

						const declarationParentNode = declarationNode.parent;
						if (declarationParentNode !== undefined && isExportNamedDeclaration(declarationParentNode)) {
							continue;
						}

						const initializer = declaratorNode.init;
						if (isFunctionLikeInitializer(initializer)) continue;
						if (isObjectLikeInitializer(initializer, ignoredCallPatternMatchers, sourceCode)) continue;

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
							continue;
						}

						const referenceIdentifier = readOnlyReference.identifier;
						if (!isBindingIdentifier(referenceIdentifier)) continue;

						const enclosingDeclarator = findEnclosingConstDeclarator(referenceIdentifier);
						if (enclosingDeclarator === undefined) continue;

						const enclosingDeclaration = enclosingDeclarator.parent;
						if (!isVariableDeclaration(enclosingDeclaration) || enclosingDeclaration.kind !== "const") {
							continue;
						}

						const canFix =
							(areAdjacentStatements(declarationNode, enclosingDeclaration) ||
								isAutoInlineSafeInitializer(sourceCode, initializer)) &&
							!hasAttachedComments(declarationNode);

						if (!canFix) {
							context.report({
								data: { name },
								messageId: "uselessConstantNoFix",
								node: declaratorNode.id,
							});
							continue;
						}

						fixableConstants.push({
							declarationNode,
							initializerText: sourceCode.getText(initializer),
							name,
							referenceIdentifier,
							reportNode: declaratorNode.id,
						});
					}

					const [firstFixableConstant] = fixableConstants;
					if (firstFixableConstant !== undefined) {
						context.report({
							data: {
								name: firstFixableConstant.name,
								names: fixableConstants.map((constant) => constant.name).join(", "),
							},
							fix(fixer): Array<Fix> {
								const fixes: Array<Fix> = [];
								let size = 0;

								for (const constant of fixableConstants) {
									fixes[size++] = fixer.replaceText(
										constant.referenceIdentifier,
										constant.initializerText,
									);
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
