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
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
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
	UPDATE_EXPRESSION,
	YIELD_EXPRESSION,
} from "@small-rules/oxlint-utilities";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { NodeType } from "@small-rules/oxlint-utilities";
import type { Definition, ESTree, Scope, SourceCode } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

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
	const unwrapped = stripExpressionWrappers(expression);
	if (seen.has(unwrapped)) return false;
	seen.add(unwrapped);

	if (isIdentifierNamed(unwrapped, "undefined") || (isUnaryExpression(unwrapped) && unwrapped.operator === "void")) {
		return true;
	}
	if (!isIdentifier(unwrapped)) return false;

	const initializer = getConstInitializerForIdentifier(sourceCode, unwrapped);
	return initializer === undefined ? false : isExplicitUndefinedExpression(sourceCode, initializer, seen);
}

function isStaticMemberProperty(
	sourceCode: SourceCode,
	property: ESTree.Expression | ESTree.IdentifierName | ESTree.PrivateIdentifier,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	/* v8 ignore next -- @preserve PrivateIdentifier cannot be produced as a valid computed member property expression. */
	if (!isExpression(property)) return false;
	return isStaticExpression(sourceCode, property, seen, options);
}

function getStaticFactoryRootName(callee: ESTree.Expression): string | undefined {
	let unwrapped = stripExpressionWrappers(callee);
	while (isMemberExpression(unwrapped)) unwrapped = stripExpressionWrappers(unwrapped.object);
	return isIdentifier(unwrapped) ? unwrapped.name : undefined;
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

	const unwrapped = stripExpressionWrappers(callee);
	if (isIdentifier(unwrapped)) return isStaticIdentifier(sourceCode, unwrapped, seen, options);
	if (!isMemberExpression(unwrapped) || !isStaticExpression(sourceCode, unwrapped.object, seen, options)) {
		return false;
	}
	if (unwrapped.computed) return isStaticExpression(sourceCode, unwrapped.property, seen, options);
	return isIdentifier(unwrapped.property);
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
	const unwrapped = stripExpressionWrappers(expression);
	// `seen` holds the expressions on the current path only, so a constant
	// that refers back to itself is rejected while one used twice is not.
	if (seen.has(unwrapped)) return false;
	seen.add(unwrapped);
	const result = classifyStaticExpression(sourceCode, unwrapped, seen, options);
	seen.delete(unwrapped);
	return result;
}

function classifyStaticExpression(
	sourceCode: SourceCode,
	unwrapped: ReturnType<typeof stripExpressionWrappers>,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
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
		if (isStaticInitializer(sourceCode, initializer, seen, options)) return true;
	}

	return false;
}

// A module constant can be referenced many times, and constants can refer to
// each other, so each initializer is classified once per options object.
const initializerVerdictsByOptions = new WeakMap<StaticExpressionOptions, WeakMap<ESTree.Node, boolean>>();

function isStaticInitializer(
	sourceCode: SourceCode,
	initializer: ESTree.Expression,
	seen: Set<ESTree.Node>,
	options: StaticExpressionOptions,
): boolean {
	let verdicts = initializerVerdictsByOptions.get(options);
	if (verdicts === undefined) {
		verdicts = new WeakMap();
		initializerVerdictsByOptions.set(options, verdicts);
	}

	const cached = verdicts.get(initializer);
	if (cached !== undefined) return cached;

	const verdict = isStaticExpression(sourceCode, initializer, seen, options);
	verdicts.set(initializer, verdict);
	return verdict;
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
				isExpression(property.key) &&
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
