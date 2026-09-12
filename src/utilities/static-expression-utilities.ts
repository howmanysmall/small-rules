import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	ASSIGNMENT_EXPRESSION,
	AWAIT_EXPRESSION,
	BINARY_EXPRESSION,
	CALL_EXPRESSION,
	CHAIN_EXPRESSION,
	CLASS_EXPRESSION,
	CONDITIONAL_EXPRESSION,
	FUNCTION_EXPRESSION,
	IDENTIFIER,
	IMPORT_EXPRESSION,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isPrivateIdentifier,
	isProperty,
	isSpreadElement,
	isUnaryExpression,
	isVariableDeclaration,
	isVariableDeclarator,
	LITERAL,
	LOGICAL_EXPRESSION,
	MEMBER_EXPRESSION,
	META_PROPERTY,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	SEQUENCE_EXPRESSION,
	SUPER,
	TAGGED_TEMPLATE_EXPRESSION,
	TEMPLATE_LITERAL,
	THIS_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
	UNARY_EXPRESSION,
	unwrapExpression,
	UPDATE_EXPRESSION,
	YIELD_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { NodeType } from "$oxc-utilities/oxc-utilities";

export interface StaticExpressionOptions {
	readonly staticCallsRequireFactories?: boolean;
	readonly staticGlobalFactories: ReadonlySet<string>;
}

export const DEFAULT_STATIC_GLOBAL_FACTORIES: ReadonlyArray<string> = [
	"Axes",
	"BrickColor",
	"CFrame",
	"Color3",
	"ColorSequence",
	"ColorSequenceKeypoint",
	"DateTime",
	"Enum",
	"Faces",
	"NumberRange",
	"NumberSequence",
	"NumberSequenceKeypoint",
	"PathWaypoint",
	"PhysicalProperties",
	"Ray",
	"Rect",
	"Region3",
	"Region3int16",
	"TweenInfo",
	"UDim",
	"UDim2",
	"Vector2",
	"Vector3",
	"Vector3int16",
	"Vector3int32",
];

const STATIC_UNARY_OPERATORS = new Set(["!", "+", "-", "typeof", "void", "~"]);

const VALID_EXPRESSIONS = new Set<NodeType>([
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	ASSIGNMENT_EXPRESSION,
	AWAIT_EXPRESSION,
	BINARY_EXPRESSION,
	CALL_EXPRESSION,
	CHAIN_EXPRESSION,
	CLASS_EXPRESSION,
	CONDITIONAL_EXPRESSION,
	FUNCTION_EXPRESSION,
	IDENTIFIER,
	IMPORT_EXPRESSION,
	LITERAL,
	LOGICAL_EXPRESSION,
	MEMBER_EXPRESSION,
	META_PROPERTY,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	SEQUENCE_EXPRESSION,
	SUPER,
	TAGGED_TEMPLATE_EXPRESSION,
	TEMPLATE_LITERAL,
	THIS_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
	UNARY_EXPRESSION,
	UPDATE_EXPRESSION,
	YIELD_EXPRESSION,
]);

function isExpression(node: ESTree.Node): node is ESTree.Expression {
	return VALID_EXPRESSIONS.has(node.type);
}

export function isModuleLevelScope(scope: Scope): boolean {
	return scope.type === "module" || scope.type === "global";
}

export function isImportBinding(scopeVariable: ScopeVariable): boolean {
	for (const definition of scopeVariable.defs) {
		if (definition.type === "ImportBinding") return true;
	}
	return false;
}

function isVariableDefinition(definition: Definition): boolean {
	return definition.type === "Variable";
}

export function getConstInitializer(definition: Definition): ESTree.Expression | undefined {
	if (!isVariableDefinition(definition)) return undefined;

	const { node } = definition;
	/* v8 ignore next -- @preserve Variable definitions from the parser always point at VariableDeclarator nodes. */
	if (!isVariableDeclarator(node)) return undefined;

	const { parent } = node;
	if (!isVariableDeclaration(parent) || parent.kind !== "const") return undefined;

	return node.init ?? undefined;
}

export function getModuleConstInitializer(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): ESTree.Expression | undefined {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined || !isModuleLevelScope(variable.scope)) return undefined;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer !== undefined) return initializer;
	}

	return undefined;
}

function getConstInitializerForIdentifier(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): ESTree.Expression | undefined {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return undefined;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer !== undefined) return initializer;
	}

	return undefined;
}

export function isExplicitUndefinedExpression(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	seen: Set<ESTree.Node>,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (seen.has(unwrapped)) return false;
	seen.add(unwrapped);

	if (isIdentifierNamed(unwrapped, "undefined") || (isUnaryExpression(unwrapped) && unwrapped.operator === "void")) {
		return true;
	}
	if (!isIdentifierName(unwrapped)) return false;

	const initializer = getConstInitializerForIdentifier(sourceCode, unwrapped);
	return initializer === undefined ? false : isExplicitUndefinedExpression(sourceCode, initializer, seen);
}

function isStaticMemberProperty(
	sourceCode: SourceCode,
	property: ESTree.Expression | ESTree.IdentifierName | ESTree.PrivateIdentifier,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	if (isIdentifierName(property)) return true;
	/* v8 ignore next -- @preserve PrivateIdentifier cannot be produced as a valid computed member property expression. */
	if (!isExpression(property)) return false;
	return isStaticExpression(sourceCode, property, seen, options);
}

function getStaticFactoryRootName(callee: ESTree.Expression): string | undefined {
	let unwrapped = unwrapExpression(callee);
	while (isMemberExpression(unwrapped)) unwrapped = unwrapExpression(unwrapped.object);
	return isIdentifierName(unwrapped) ? unwrapped.name : undefined;
}

function isStaticCallCallee(
	sourceCode: SourceCode,
	callee: ESTree.Expression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	if (options.staticCallsRequireFactories === true) {
		const factoryRootName = getStaticFactoryRootName(callee);
		if (factoryRootName === undefined || !options.staticGlobalFactories.has(factoryRootName)) return false;
	}

	const unwrapped = unwrapExpression(callee);
	if (isIdentifierName(unwrapped)) return isStaticIdentifier(sourceCode, unwrapped, seen, options);
	if (!isMemberExpression(unwrapped) || !isStaticExpression(sourceCode, unwrapped.object, seen, options)) {
		return false;
	}
	if (unwrapped.computed) return isStaticExpression(sourceCode, unwrapped.property, seen, options);
	return isIdentifierName(unwrapped.property);
}

function checkStaticCallOrNewExpression(
	sourceCode: SourceCode,
	parameters: ReadonlyArray<ESTree.Argument>,
	callee: ESTree.Expression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	if (!isStaticCallCallee(sourceCode, callee, seen, options)) return false;

	return parameters.every(
		(argument) => !isSpreadElement(argument) && isStaticExpression(sourceCode, argument, seen, options),
	);
}

function isStaticConditionalExpression(
	sourceCode: SourceCode,
	node: ESTree.ConditionalExpression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	return (
		isStaticExpression(sourceCode, node.test, seen, options) &&
		isStaticExpression(sourceCode, node.consequent, seen, options) &&
		isStaticExpression(sourceCode, node.alternate, seen, options)
	);
}

function isStaticMemberAccess(
	sourceCode: SourceCode,
	node: ESTree.MemberExpression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	return (
		isStaticExpression(sourceCode, node.object, seen, options) &&
		(!node.computed || isStaticMemberProperty(sourceCode, node.property, seen, options))
	);
}

export function isStaticExpression(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (seen.has(unwrapped)) return false;
	seen.add(unwrapped);

	switch (unwrapped.type) {
		case ARRAY_EXPRESSION:
			return isStaticArrayExpression(sourceCode, unwrapped, seen, options);

		case BINARY_EXPRESSION:
		case LOGICAL_EXPRESSION: {
			/* v8 ignore next -- @preserve Parser-produced binary and logical left operands are expressions. */
			if (!isExpression(unwrapped.left)) return false;
			return (
				isStaticExpression(sourceCode, unwrapped.left, seen, options) &&
				isStaticExpression(sourceCode, unwrapped.right, seen, options)
			);
		}

		case CALL_EXPRESSION:
			return checkStaticCallOrNewExpression(sourceCode, unwrapped.arguments, unwrapped.callee, seen, options);

		case CONDITIONAL_EXPRESSION: {
			return isStaticConditionalExpression(sourceCode, unwrapped, seen, options);
		}

		case IDENTIFIER:
			return isStaticIdentifier(sourceCode, unwrapped, seen, options);

		case LITERAL:
			return true;

		case MEMBER_EXPRESSION: {
			return isStaticMemberAccess(sourceCode, unwrapped, seen, options);
		}

		case NEW_EXPRESSION:
			return checkStaticCallOrNewExpression(sourceCode, unwrapped.arguments, unwrapped.callee, seen, options);

		case OBJECT_EXPRESSION:
			return isStaticObjectExpression(sourceCode, unwrapped, seen, options);

		case SEQUENCE_EXPRESSION: {
			return (
				unwrapped.expressions.length > 0 &&
				unwrapped.expressions.every((expression_) => isStaticExpression(sourceCode, expression_, seen, options))
			);
		}

		case TEMPLATE_LITERAL:
			return unwrapped.expressions.length === 0;

		case UNARY_EXPRESSION: {
			return (
				STATIC_UNARY_OPERATORS.has(unwrapped.operator) &&
				isStaticExpression(sourceCode, unwrapped.argument, seen, options)
			);
		}

		default:
			return false;
	}
}

function isStaticIdentifier(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return options.staticGlobalFactories.has(identifier.name);
	if (!isModuleLevelScope(variable.scope)) return false;
	if (isImportBinding(variable)) return true;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;
		if (isStaticExpression(sourceCode, initializer, seen, options)) return true;
	}

	return false;
}

function isExpressionKey(key: ESTree.PropertyKey): key is ESTree.Expression {
	return !isPrivateIdentifier(key) && !isIdentifierName(key);
}

export function isStaticObjectExpression(
	sourceCode: SourceCode,
	objectExpression: ESTree.ObjectExpression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	for (const property of objectExpression.properties) {
		if (!isProperty(property) || property.kind !== "init") return false;

		if (
			(property.computed &&
				isExpressionKey(property.key) &&
				!isStaticExpression(sourceCode, property.key, seen, options)) ||
			!isStaticExpression(sourceCode, property.value, seen, options)
		) {
			return false;
		}
	}
	return true;
}

export function isStaticArrayExpression(
	sourceCode: SourceCode,
	{ elements }: ESTree.ArrayExpression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	for (const element of elements) {
		if (element === null) return false;
		if (isSpreadElement(element) || !isStaticExpression(sourceCode, element, seen, options)) return false;
	}
	return true;
}
