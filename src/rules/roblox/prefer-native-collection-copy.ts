import { getNativeCollectionKind } from "$oxc-utilities/api-provenance";
import {
	forEachNode,
	hasAttachedComments,
	hasShadowedBinding,
	STOP_NODE_TRAVERSAL,
} from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isArrayPattern,
	isBlockStatement,
	isCallExpression,
	isExpressionStatement,
	isForOfStatement,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isNewExpression,
	isSpreadElement,
	isVariableDeclaration,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { NativeCollectionKind } from "$oxc-utilities/api-provenance";

type ProgramStatement = ESTree.ModuleDeclaration | ESTree.Statement;

interface EmptyCollectionDeclaration {
	readonly declaration: ESTree.VariableDeclaration;
	readonly identifier: ESTree.BindingIdentifier;
	readonly initializer: ESTree.NewExpression;
	readonly kind: NativeCollectionKind;
}

function getEmptyCollectionDeclaration(
	statement: ProgramStatement,
	sourceCode: SourceCode,
): EmptyCollectionDeclaration | undefined {
	if (!isVariableDeclaration(statement) || statement.declarations.length !== 1) return undefined;
	const [declarator] = statement.declarations;
	if (
		declarator === undefined ||
		!isIdentifierName(declarator.id) ||
		!isNewExpression(declarator.init) ||
		declarator.init.arguments.length > 0
	) {
		return undefined;
	}

	const kind = getNativeCollectionKind(sourceCode, declarator.init);
	return kind === undefined
		? undefined
		: { declaration: statement, identifier: declarator.id, initializer: declarator.init, kind };
}

function getSingleLoopCall(loop: ESTree.ForOfStatement): ESTree.CallExpression | undefined {
	let statement: ESTree.Statement = loop.body;
	if (isBlockStatement(statement)) {
		if (statement.body.length !== 1) return undefined;
		const [onlyStatement] = statement.body;
		/* v8 ignore next -- the length check proves the element exists. @preserve */
		if (onlyStatement === undefined) return undefined;
		statement = onlyStatement;
	}
	if (!isExpressionStatement(statement) || !isCallExpression(statement.expression)) return undefined;
	return statement.expression;
}

function containsIdentifier(node: ESTree.Node, name: string): boolean {
	let found = false;
	forEachNode(node, (current) => {
		if (!isIdentifierNamed(current, name)) return true;
		found = true;
		return STOP_NODE_TRAVERSAL;
	});
	return found;
}

function isMapCopyCall(call: ESTree.CallExpression, loopDeclarator: ESTree.VariableDeclarator): boolean {
	/* v8 ignore next -- the caller only passes statically named member calls. @preserve */
	if (!isMemberExpression(call.callee) || !isIdentifierNamed(call.callee.property, "set")) return false;
	if (call.arguments.length !== 2 || !isArrayPattern(loopDeclarator.id) || loopDeclarator.id.elements.length !== 2) {
		return false;
	}

	const [keyBinding, valueBinding] = loopDeclarator.id.elements;
	const [keyArgument, valueArgument] = call.arguments;
	if (keyBinding === null || valueBinding === null || keyArgument === undefined || valueArgument === undefined) {
		return false;
	}

	if (
		!isIdentifierName(keyBinding) ||
		!isIdentifierName(valueBinding) ||
		isSpreadElement(keyArgument) ||
		isSpreadElement(valueArgument)
	) {
		return false;
	}

	return isIdentifierNamed(keyArgument, keyBinding.name) && isIdentifierNamed(valueArgument, valueBinding.name);
}

function isSetCopyCall(call: ESTree.CallExpression, loopDeclarator: ESTree.VariableDeclarator): boolean {
	if (!isMemberExpression(call.callee) || !isIdentifierNamed(call.callee.property, "add")) return false;
	if (call.arguments.length !== 1 || !isIdentifierName(loopDeclarator.id)) return false;

	const [valueArgument] = call.arguments;
	/* v8 ignore next -- the length check proves the element exists. @preserve */
	if (valueArgument === undefined) return false;
	return !isSpreadElement(valueArgument) && isIdentifierNamed(valueArgument, loopDeclarator.id.name);
}

function isMatchingCopyLoop(
	loop: ESTree.ForOfStatement,
	destination: EmptyCollectionDeclaration,
	sourceCode: SourceCode,
): boolean {
	if (!isVariableDeclaration(loop.left) || loop.left.declarations.length !== 1) return false;
	const [loopDeclarator] = loop.left.declarations;
	/* v8 ignore next -- the length check proves the element exists. @preserve */
	if (loopDeclarator === undefined || loopDeclarator.init !== null) return false;
	if (getNativeCollectionKind(sourceCode, loop.right) !== destination.kind) return false;
	if (containsIdentifier(loop.right, destination.identifier.name)) return false;

	const call = getSingleLoopCall(loop);
	if (call === undefined || !isMemberExpression(call.callee) || call.callee.computed) return false;
	if (!isIdentifierNamed(call.callee.object, destination.identifier.name)) return false;

	return destination.kind === "Map" ? isMapCopyCall(call, loopDeclarator) : isSetCopyCall(call, loopDeclarator);
}

interface CopyCandidate {
	readonly declaration: EmptyCollectionDeclaration;
	readonly loop: ESTree.ForOfStatement;
}

function getCopyCandidate(
	statements: ReadonlyArray<ProgramStatement>,
	index: number,
	sourceCode: SourceCode,
): CopyCandidate | undefined {
	const current = statements[index];
	const next = statements[index + 1];
	if (current === undefined || next === undefined || !isForOfStatement(next)) return undefined;

	const declaration = getEmptyCollectionDeclaration(current, sourceCode);
	if (declaration === undefined || !isMatchingCopyLoop(next, declaration, sourceCode)) return undefined;
	return { declaration, loop: next };
}

const preferNativeCollectionCopy = createRule("prefer-native-collection-copy", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		function inspectStatements(statements: ReadonlyArray<ProgramStatement>): void {
			for (let index = 0; index + 1 < statements.length; index += 1) {
				const candidate = getCopyCandidate(statements, index, sourceCode);
				if (candidate === undefined) continue;
				const { declaration, loop } = candidate;

				const sourceText = sourceCode.getText(loop.right);
				const fixable =
					!hasShadowedBinding(sourceCode, declaration.declaration, "table") &&
					!hasAttachedComments(sourceCode, declaration.declaration) &&
					!hasAttachedComments(sourceCode, loop);
				if (fixable) {
					context.report({
						fix: (fixer) => {
							const declarationText = sourceCode.getText(declaration.declaration);
							const [declarationStart] = declaration.declaration.range;
							const [initializerStart, initializerEnd] = declaration.initializer.range;
							const relativeStart = initializerStart - declarationStart;
							const relativeEnd = initializerEnd - declarationStart;
							const replacement = `${declarationText.slice(0, relativeStart)}table.clone(${sourceText})${declarationText.slice(relativeEnd)}`;
							return fixer.replaceTextRange(
								[declaration.declaration.range[0], loop.range[1]],
								replacement,
							);
						},
						messageId: "preferNativeCollectionCopy",
						node: loop,
					});
				} else context.report({ messageId: "preferNativeCollectionCopy", node: loop });
			}
		}

		function onStatement(node: ESTree.BlockStatement | ESTree.Program): void {
			inspectStatements(node.body);
		}

		return {
			BlockStatement: onStatement,
			Program: onStatement,
		} satisfies Visitor;
	},
	meta: {
		docs: { description: "Prefer table.clone over a manual shallow Map or Set copy loop." },
		fixable: "code",
		messages: {
			preferNativeCollectionCopy: "Use table.clone for this shallow collection copy.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default preferNativeCollectionCopy;
