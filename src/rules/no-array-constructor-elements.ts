import { getMemberPropertyName, hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isExpressionSideEffectSafe } from "$oxc-utilities/expression-safety";
import {
	isArrayExpression,
	isArrowFunctionExpression,
	isAssignmentPattern,
	isCallExpression,
	isClass,
	isExpressionStatement,
	isFunctionDeclaration,
	isLiteral,
	isMemberExpression,
	isNewExpression,
	isObjectExpression,
	isPropertyDefinition,
	isTemplateLiteral,
	isTsAsExpression,
	isTsTypeAssertion,
	isUnaryExpression,
	isVariableDeclaration,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { isNumberRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { BindingName } from "$oxc-types/missing-types";
import type { FixReturn } from "$oxc-utilities/oxc-utilities";
import type { Environment } from "$oxc-utilities/react-utilities";
import type { Diagnostic, ESTree, Fix, Fixer, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface NoArrayConstructorElementsOptions {
	readonly environment?: Environment;
	readonly requireExplicitGenericOnNewArray?: boolean;
}

type ProgramStatement = ESTree.ModuleDeclaration | ESTree.Statement;

interface PushCollapseCandidate {
	readonly arrayIdentifierName: string;
	readonly declarator: ESTree.VariableDeclarator;
	readonly hasUnsafeArgument: boolean;
	readonly literalText: string;
	readonly pushStatements: ReadonlyArray<ESTree.ExpressionStatement>;
	readonly statement: ESTree.VariableDeclaration;
}

type NoArrayConstructorElementsMessageId =
	| "avoidConstructorEnumeration"
	| "avoidLengthConstructorInStandard"
	| "avoidSingleArgumentConstructor"
	| "collapseArrayPushInitialization"
	| "requireExplicitGenericOnNewArray"
	| "suggestArrayFromLength"
	| "suggestArrayLiteral"
	| "suggestCollapseArrayPushInitialization";

interface NoArrayConstructorElementsContext {
	readonly report: (diagnostic: Diagnostic<NoArrayConstructorElementsMessageId>) => void;
	readonly sourceCode: SourceCode;
}

const DEFAULT_OPTIONS: Required<NoArrayConstructorElementsOptions> = {
	environment: "roblox-ts",
	requireExplicitGenericOnNewArray: true,
};

function isIdentifier(
	node: BindingName | ESTree.Expression | ESTree.TSTypeName,
): node is ESTree.BindingIdentifier | ESTree.IdentifierReference {
	return node.type === "Identifier";
}

function isGlobalArrayConstructor(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
	const callee = unwrapExpression(node.callee);
	if (!isIdentifier(callee) || callee.name !== "Array") return false;
	return !hasShadowedBinding(sourceCode, callee, "Array");
}

function extractElementTypeFromArrayAnnotation(typeNode: ESTree.TSType, sourceCode: SourceCode): string | undefined {
	if (typeNode.type !== "TSTypeReference") return undefined;
	if (!isIdentifier(typeNode.typeName)) return undefined;
	if (typeNode.typeName.name !== "Array" && typeNode.typeName.name !== "ReadonlyArray") return undefined;
	if (typeNode.typeArguments?.params.length !== 1) return undefined;

	const [elementType] = typeNode.typeArguments.params;
	return elementType === undefined ? undefined : sourceCode.getText(elementType);
}

const IS_ANNOTATION = /:\s*(?:Array<.+>|ReadonlyArray<.+>)\s*=/u;

function hasArrayAnnotationInAssignmentPatternText(assignmentText: string): boolean {
	return IS_ANNOTATION.exec(assignmentText) !== null;
}

function getBindingTypeAnnotation(bindingName: BindingName): ESTree.TSTypeAnnotation | undefined {
	if (isIdentifier(bindingName)) return bindingName.typeAnnotation ?? undefined;
	if (bindingName.type === "ArrayPattern") return bindingName.typeAnnotation ?? undefined;
	if (bindingName.type === "ObjectPattern") return bindingName.typeAnnotation ?? undefined;
	return undefined;
}

function hasContextualArrayAnnotation(node: ESTree.NewExpression, sourceCode: SourceCode): boolean {
	const { parent } = node;

	if (isVariableDeclarator(parent) && parent.init === node) {
		const typeAnnotation = getBindingTypeAnnotation(parent.id);
		if (typeAnnotation === undefined) return false;
		return extractElementTypeFromArrayAnnotation(typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (isAssignmentPattern(parent) && parent.right === node) {
		return hasArrayAnnotationInAssignmentPatternText(sourceCode.getText(parent));
	}

	if (
		isPropertyDefinition(parent) &&
		parent.value === node &&
		parent.typeAnnotation !== undefined &&
		parent.typeAnnotation !== null
	) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation.typeAnnotation, sourceCode) !== undefined;
	}

	if (isTsAsExpression(parent) && parent.expression === node) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation, sourceCode) !== undefined;
	}

	if (isTsTypeAssertion(parent) && parent.expression === node) {
		return extractElementTypeFromArrayAnnotation(parent.typeAnnotation, sourceCode) !== undefined;
	}

	return false;
}

function isReadonlyArrayAnnotation(typeAnnotation: ESTree.TSTypeAnnotation | undefined): boolean {
	if (typeAnnotation === undefined) return false;
	const { typeAnnotation: annotationType } = typeAnnotation;
	if (annotationType.type !== "TSTypeReference" || !isIdentifier(annotationType.typeName)) return false;
	return annotationType.typeName.name === "ReadonlyArray";
}

function isDefinitelyNonNumericExpression(expression: ESTree.Expression): boolean {
	const unwrapped = unwrapExpression(expression);
	if (isLiteral(unwrapped) && "value" in unwrapped) return !isNumberRaw(unwrapped.value);

	if (
		isArrayExpression(unwrapped) ||
		isObjectExpression(unwrapped) ||
		isArrowFunctionExpression(unwrapped) ||
		isFunctionDeclaration(unwrapped) ||
		isClass(unwrapped)
	) {
		return true;
	}

	if (isTemplateLiteral(unwrapped)) return unwrapped.expressions.length === 0;
	if (isUnaryExpression(unwrapped)) {
		return unwrapped.operator === "void" || (unwrapped.operator === "typeof" && !unwrapped.prefix);
	}

	return false;
}

function getPushCallForIdentifier(
	expression: ESTree.Expression,
	identifierName: string,
): ESTree.CallExpression | undefined {
	const unwrapped = unwrapExpression(expression);
	if (!isCallExpression(unwrapped) || unwrapped.optional) return undefined;
	if (!isMemberExpression(unwrapped.callee) || unwrapped.callee.optional) return undefined;
	if (!isIdentifier(unwrapped.callee.object) || unwrapped.callee.object.name !== identifierName) {
		return undefined;
	}

	return getMemberPropertyName(unwrapped.callee) === "push" ? unwrapped : undefined;
}

function containsLaterPushCall(
	statements: ReadonlyArray<ProgramStatement>,
	startIndex: number,
	identifierName: string,
): boolean {
	for (let index = startIndex; index < statements.length; index += 1) {
		const statement = statements[index];
		if (statement === undefined || !isExpressionStatement(statement)) continue;
		if (getPushCallForIdentifier(statement.expression, identifierName) !== undefined) return true;
	}

	return false;
}

function buildArrayLiteralFromArguments(argumentsList: ReadonlyArray<ESTree.Argument>, sourceCode: SourceCode): string {
	const parts = new Array<string>();
	let size = 0;

	for (const argument of argumentsList) {
		if (argument.type === "SpreadElement") {
			parts[size++] = `...${sourceCode.getText(argument.argument)}`;
			continue;
		}

		parts[size++] = sourceCode.getText(argument);
	}

	return `[${parts.join(", ")}]`;
}

function createCollapseFixes(
	fixer: Fixer,
	sourceCode: SourceCode,
	declarator: ESTree.VariableDeclarator,
	pushStatements: ReadonlyArray<ESTree.ExpressionStatement>,
	arrayLiteralText: string,
): Array<Fix> {
	if (declarator.init === null || pushStatements.length === 0) return [];

	const [firstPushStatement] = pushStatements;
	const lastPushStatement = pushStatements.at(-1);
	if (firstPushStatement === undefined || lastPushStatement === undefined) return [];

	let [collapseStart] = firstPushStatement.range;
	while (collapseStart > 0) {
		const previousCharacter = sourceCode.text[collapseStart - 1];
		if (previousCharacter === " " || previousCharacter === "\t") {
			collapseStart -= 1;
			continue;
		}

		if (previousCharacter === "\n") collapseStart -= 1;
		break;
	}

	return [
		fixer.replaceText(declarator.init, arrayLiteralText),
		fixer.removeRange([collapseStart, lastPushStatement.range[1]]),
	];
}

function reportArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	options: Required<NoArrayConstructorElementsOptions>,
): void {
	const { sourceCode } = context;

	if (node.arguments.length === 0) {
		reportEmptyArrayConstructor(context, node, options);
		return;
	}

	if (node.arguments.length > 1) {
		reportMultiArgumentArrayConstructor(context, node, options);
		return;
	}

	reportSingleArgumentArrayConstructor(context, node, options, sourceCode);
}

function reportEmptyArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	options: Required<NoArrayConstructorElementsOptions>,
): void {
	if (!options.requireExplicitGenericOnNewArray) return;

	const hasTypeArguments =
		node.typeArguments !== undefined && node.typeArguments !== null && node.typeArguments.params.length > 0;
	if (hasTypeArguments || hasContextualArrayAnnotation(node, context.sourceCode)) return;

	context.report({
		messageId: "requireExplicitGenericOnNewArray",
		node,
	});
}

function reportMultiArgumentArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	options: Required<NoArrayConstructorElementsOptions>,
): void {
	const [firstArgument] = node.arguments;
	if (firstArgument === undefined) return;
	if (
		firstArgument.type !== "SpreadElement" &&
		options.environment === "roblox-ts" &&
		!isDefinitelyNonNumericExpression(firstArgument)
	) {
		return;
	}

	const literalText = buildArrayLiteralFromArguments(node.arguments, context.sourceCode);
	const hasSpread = node.arguments.some((argument) => argument.type === "SpreadElement");

	if (!hasSpread) {
		context.report({
			fix(fixer) {
				return fixer.replaceText(node, literalText);
			},
			messageId: "avoidConstructorEnumeration",
			node,
		});
		return;
	}

	context.report({
		messageId: "avoidConstructorEnumeration",
		node,
		suggest: [
			{
				fix(fixer): FixReturn {
					return fixer.replaceText(node, literalText);
				},
				messageId: "suggestArrayLiteral",
			},
		],
	});
}

function reportSingleArgumentArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	options: Required<NoArrayConstructorElementsOptions>,
	sourceCode: SourceCode,
): void {
	const [firstArgument] = node.arguments;
	if (firstArgument === undefined) return;

	if (firstArgument.type === "SpreadElement") {
		reportSpreadArrayConstructor(context, node, sourceCode.getText(firstArgument.argument));
		return;
	}

	if (!isDefinitelyNonNumericExpression(firstArgument)) {
		reportLengthArrayConstructor(context, node, options, sourceCode.getText(firstArgument));
		return;
	}

	const singleElementLiteral = `[${sourceCode.getText(firstArgument)}]`;
	context.report({
		fix(fixer) {
			return fixer.replaceText(node, singleElementLiteral);
		},
		messageId: "avoidSingleArgumentConstructor",
		node,
	});
}

function reportSpreadArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	argumentText: string,
): void {
	context.report({
		messageId: "avoidSingleArgumentConstructor",
		node,
		suggest: [
			{
				fix(fixer): FixReturn {
					return fixer.replaceText(node, `[...${argumentText}]`);
				},
				messageId: "suggestArrayLiteral",
			},
		],
	});
}

function reportLengthArrayConstructor(
	context: NoArrayConstructorElementsContext,
	node: ESTree.NewExpression,
	options: Required<NoArrayConstructorElementsOptions>,
	lengthExpressionText: string,
): void {
	if (options.environment === "roblox-ts") return;

	context.report({
		messageId: "avoidLengthConstructorInStandard",
		node,
		suggest: [
			{
				fix(fixer): FixReturn {
					return fixer.replaceText(node, `Array.from({ length: ${lengthExpressionText} })`);
				},
				messageId: "suggestArrayFromLength",
			},
		],
	});
}

function getPushCollapseCandidate(
	sourceCode: SourceCode,
	statements: ReadonlyArray<ProgramStatement>,
	index: number,
): PushCollapseCandidate | undefined {
	const statement = statements[index];
	if (statement === undefined || !isVariableDeclaration(statement)) return undefined;
	if (statement.kind !== "const" && statement.kind !== "let") return undefined;
	if (statement.declarations.length !== 1) return undefined;

	const [declarator] = statement.declarations;
	if (declarator === undefined || !isIdentifier(declarator.id)) return undefined;
	if (declarator.init === null || !isNewExpression(declarator.init)) return undefined;
	if (!isGlobalArrayConstructor(sourceCode, declarator.init)) return undefined;
	if (declarator.init.arguments.length > 0) return undefined;
	if (isReadonlyArrayAnnotation(getBindingTypeAnnotation(declarator.id))) return undefined;

	const arrayIdentifierName = declarator.id.name;
	const scan = scanPushStatements(sourceCode, statements, index + 1, arrayIdentifierName);
	if (scan.pushStatements.length === 0) return undefined;
	if (containsLaterPushCall(statements, scan.nextIndex, arrayIdentifierName)) return undefined;

	return {
		arrayIdentifierName,
		declarator,
		hasUnsafeArgument: scan.hasUnsafeArgument,
		literalText: `[${scan.argumentParts.join(", ")}]`,
		pushStatements: scan.pushStatements,
		statement,
	};
}

function scanPushStatements(
	sourceCode: SourceCode,
	statements: ReadonlyArray<ProgramStatement>,
	startIndex: number,
	arrayIdentifierName: string,
): {
	readonly argumentParts: ReadonlyArray<string>;
	readonly hasUnsafeArgument: boolean;
	readonly nextIndex: number;
	readonly pushStatements: ReadonlyArray<ESTree.ExpressionStatement>;
} {
	const pushStatements = new Array<ESTree.ExpressionStatement>();
	const argumentParts = new Array<string>();
	let hasUnsafeArgument = false;
	let scanIndex = startIndex;

	while (scanIndex < statements.length) {
		const nextStatement = statements[scanIndex];
		if (nextStatement === undefined || !isExpressionStatement(nextStatement)) break;

		const pushCall = getPushCallForIdentifier(nextStatement.expression, arrayIdentifierName);
		if (pushCall === undefined || pushCall.arguments.length === 0) break;

		pushStatements.push(nextStatement);
		hasUnsafeArgument = appendPushArguments(sourceCode, pushCall, argumentParts) || hasUnsafeArgument;
		scanIndex += 1;
	}

	return {
		argumentParts,
		hasUnsafeArgument,
		nextIndex: scanIndex,
		pushStatements,
	};
}

function appendPushArguments(
	sourceCode: SourceCode,
	pushCall: ESTree.CallExpression,
	argumentParts: Array<string>,
): boolean {
	let hasUnsafeArgument = false;
	for (const argument of pushCall.arguments) {
		if (argument.type === "SpreadElement") {
			hasUnsafeArgument = true;
			argumentParts.push(`...${sourceCode.getText(argument.argument)}`);
			continue;
		}

		if (!isExpressionSideEffectSafe(argument)) hasUnsafeArgument = true;
		argumentParts.push(sourceCode.getText(argument));
	}

	return hasUnsafeArgument;
}

const noArrayConstructorElements = defineRule({
	create(context): Visitor {
		const rawOptions = context.options?.[0];
		const options: Required<NoArrayConstructorElementsOptions> =
			typeof rawOptions === "object" && rawOptions !== null
				? { ...DEFAULT_OPTIONS, ...(rawOptions as Partial<NoArrayConstructorElementsOptions>) }
				: { ...DEFAULT_OPTIONS };
		const { sourceCode } = context;

		function inspectPushCollapse(statements: ReadonlyArray<ProgramStatement>): void {
			for (let index = 0; index < statements.length; index += 1) {
				const candidate = getPushCollapseCandidate(sourceCode, statements, index);
				if (candidate === undefined) continue;

				if (!candidate.hasUnsafeArgument) {
					context.report({
						fix(fixer) {
							return createCollapseFixes(
								fixer,
								sourceCode,
								candidate.declarator,
								candidate.pushStatements,
								candidate.literalText,
							);
						},
						messageId: "collapseArrayPushInitialization",
						node: candidate.statement,
					});
					continue;
				}

				context.report({
					messageId: "collapseArrayPushInitialization",
					node: candidate.statement,
					suggest: [
						{
							fix(fixer): FixReturn {
								return createCollapseFixes(
									fixer,
									sourceCode,
									candidate.declarator,
									candidate.pushStatements,
									candidate.literalText,
								);
							},
							messageId: "suggestCollapseArrayPushInitialization",
						},
					],
				});
			}
		}

		return {
			BlockStatement(node): void {
				inspectPushCollapse(node.body);
			},

			NewExpression(node): void {
				if (!isGlobalArrayConstructor(sourceCode, node)) return;
				reportArrayConstructor(context, node, options);
			},

			Program(node): void {
				inspectPushCollapse(node.body);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow array constructor element forms and enforce roblox-ts-aware constructor patterns.",
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			avoidConstructorEnumeration:
				"Do not use Array constructor enumeration arguments. Use an array literal instead.",
			avoidLengthConstructorInStandard:
				"Length-based Array constructor is not allowed in standard mode. Prefer Array.from({ length: n }).",
			avoidSingleArgumentConstructor:
				"Single-argument Array constructor form is not allowed here. Use an array literal instead.",
			collapseArrayPushInitialization:
				"Collapse new Array<T>() + consecutive .push(...) calls into a single array literal initializer.",
			requireExplicitGenericOnNewArray:
				"new Array() must use an explicit generic argument or a contextual Array<T>/ReadonlyArray<T> annotation.",
			suggestArrayFromLength: "Replace with Array.from({ length: value }).",
			suggestArrayLiteral: "Replace constructor form with an array literal.",
			suggestCollapseArrayPushInitialization:
				"Collapse constructor + push sequence into a single array literal initializer.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description:
							"Array constructor environment mode: 'roblox-ts' allows new Array(length); 'standard' reports it.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					requireExplicitGenericOnNewArray: {
						default: true,
						description:
							"When true, zero-argument new Array() requires explicit generic type arguments or contextual array typing.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noArrayConstructorElements;
