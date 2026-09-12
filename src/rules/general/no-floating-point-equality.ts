import { Predicate } from "effect";

import { forEachScopeVariable } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	getMemberPropertyName,
	isAnyLiteral,
	isBinaryExpression,
	isCallExpression,
	isIdentifierName,
	isImportDeclaration,
	isImportDefaultSpecifier,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isLogicalExpression,
	isMemberExpression,
	isNumericLiteral,
	isPrivateIdentifier,
	isSpreadElement,
	isSwitchCase,
	isUnaryExpression,
	isVariableDeclaration,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";
import { walkAst } from "$oxc-utilities/react-hook-utilities";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

const EXPONENT_PATTERN = /e/iu;
const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);
const ARITHMETIC_OPERATORS = new Set(["%", "*", "**", "+", "-"]);
const EXACT_ASSERTION_METHODS = new Set(["deepStrictEqual", "notDeepStrictEqual", "notStrictEqual", "strictEqual"]);
const EXACT_EXPECT_MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual"]);
const EXPECT_MODULES = new Set(["@jest/globals", "bun:test", "vitest"]);
const ASSERT_MODULES = new Set(["assert", "assert/strict", "node:assert", "node:assert/strict"]);

interface OrientedComparison {
	readonly above: boolean;
	readonly expression: ESTree.Expression;
	readonly threshold: ESTree.Expression;
}

type ComparableBinaryExpression = ESTree.BinaryExpression & { readonly left: ESTree.Expression };
type ImportedAssertionKind = "assert" | "expect" | "function";

function isExactDecimal(raw: string): boolean {
	const normalized = raw.replaceAll("_", "").toLowerCase();
	const exponentIndex = normalized.indexOf("e");
	const coefficient = exponentIndex === -1 ? normalized : normalized.slice(0, exponentIndex);
	const exponent = exponentIndex === -1 ? 0 : Number(normalized.slice(exponentIndex + 1));
	const decimalIndex = coefficient.indexOf(".");
	const fractionLength = decimalIndex === -1 ? 0 : coefficient.length - decimalIndex - 1;
	const digits = coefficient.replace(".", "");
	const scale = fractionLength - exponent;
	let numerator = BigInt(digits);
	if (numerator === 0n || scale <= 0) return true;
	let denominator = 10n ** BigInt(scale);
	while (numerator % 5n === 0n) {
		numerator /= 5n;
		denominator /= 5n;
	}
	return denominator % 5n !== 0n;
}

function numericLiteralValue(node: ESTree.Node): number | undefined {
	if (isNumericLiteral(node)) return node.value;
	if (!isUnaryExpression(node) || (node.operator !== "+" && node.operator !== "-")) return undefined;

	const value = isAnyLiteral(node.argument) ? node.argument.value : undefined;
	if (!Predicate.isNumber(value)) return undefined;

	return node.operator === "-" ? -value : value;
}

function getConstantNumericValue(node: ESTree.Node): number | undefined {
	const literalValue = numericLiteralValue(node);
	if (literalValue !== undefined) return literalValue;
	if (!isBinaryExpression(node) || isPrivateIdentifier(node.left)) return undefined;

	const left = getConstantNumericValue(node.left);
	const right = getConstantNumericValue(node.right);
	if (left === undefined || right === undefined) return undefined;
	if (node.operator === "+") return left + right;
	if (node.operator === "-") return left - right;
	if (node.operator === "*") return left * right;
	if (node.operator === "/") return right === 0 ? undefined : left / right;
	if (node.operator === "%") return right === 0 ? undefined : left % right;
	if (node.operator === "**") return left ** right;
	return undefined;
}

function divisionIsInexact(node: ESTree.BinaryExpression): boolean {
	const numerator = numericLiteralValue(node.left);
	const denominator = numericLiteralValue(node.right);
	if (
		numerator === undefined ||
		denominator === undefined ||
		denominator === 0 ||
		!Number.isSafeInteger(numerator) ||
		!Number.isSafeInteger(denominator)
	) {
		return false;
	}
	let oddDenominator = Math.abs(denominator);
	while (oddDenominator % 2 === 0) oddDenominator /= 2;
	return Math.abs(numerator) % oddDenominator !== 0;
}

function getConstInitializer(variable: Variable): ESTree.Expression | undefined {
	const [definition] = variable.defs;
	if (
		definition?.type !== "Variable" ||
		!isVariableDeclarator(definition.node) ||
		definition.node.init === null ||
		!isVariableDeclaration(definition.parent) ||
		definition.parent.kind !== "const"
	) {
		return undefined;
	}
	return definition.node.init;
}

function binaryIsFloating(
	node: ESTree.BinaryExpression,
	variables: ReadonlyMap<ESTree.Node, Variable>,
	visited: Set<Variable>,
): boolean {
	const value = getConstantNumericValue(node);
	if (value !== undefined && Number.isSafeInteger(value)) return false;
	if (node.operator === "/") {
		return (
			divisionIsInexact(node) ||
			isFloatingExpression(node.left, variables, visited) ||
			isFloatingExpression(node.right, variables, visited)
		);
	}
	return (
		ARITHMETIC_OPERATORS.has(node.operator) &&
		(isFloatingExpression(node.left, variables, visited) || isFloatingExpression(node.right, variables, visited))
	);
}

function resolveFloatingExpressionRoot(
	node: ESTree.Expression,
	variables: ReadonlyMap<ESTree.Node, Variable>,
	visited: Set<Variable>,
): ESTree.Expression | undefined {
	let current = node;
	while (true) {
		const unwrapped = unwrapExpression(current);
		if (unwrapped !== current) {
			current = unwrapped;
			continue;
		}
		if (!isIdentifierName(current)) return current;
		const variable = variables.get(current);
		if (variable === undefined || visited.has(variable)) return undefined;

		const initializer = getConstInitializer(variable);
		if (initializer === undefined) return undefined;

		visited.add(variable);
		current = initializer;
	}
}

function isFloatingExpression(
	node: ESTree.Expression,
	variables: ReadonlyMap<ESTree.Node, Variable>,
	visited: Set<Variable>,
): boolean {
	const current = resolveFloatingExpressionRoot(node, variables, visited);
	if (current === undefined) return false;
	if (isNumericLiteral(current)) {
		const raw = String(current.raw);
		return (raw.includes(".") || EXPONENT_PATTERN.test(raw)) && !isExactDecimal(raw);
	}

	if (isUnaryExpression(current)) {
		return (
			(current.operator === "+" || current.operator === "-") &&
			isFloatingExpression(current.argument, variables, visited)
		);
	}
	return isBinaryExpression(current) && isComparableBinary(current) && binaryIsFloating(current, variables, visited);
}

function collectVariables(sourceCode: SourceCode): Map<ESTree.Node, Variable> {
	const variables = new Map<ESTree.Node, Variable>();
	forEachScopeVariable(sourceCode, (variable): void => {
		for (const reference of variable.references) variables.set(reference.identifier, variable);
	});
	return variables;
}

function getImportedName(specifier: ESTree.ImportSpecifier): string {
	return isIdentifierName(specifier.imported) ? specifier.imported.name : specifier.imported.value;
}

function collectImportedSpecifier(
	assertions: Map<string, ImportedAssertionKind>,
	source: string,
	specifier: ESTree.ImportDeclarationSpecifier,
): void {
	const { name } = specifier.local;
	if (EXPECT_MODULES.has(source) && isImportSpecifier(specifier) && getImportedName(specifier) === "expect") {
		assertions.set(name, "expect");
	}

	if (!ASSERT_MODULES.has(source)) return;
	if (isImportDefaultSpecifier(specifier) || isImportNamespaceSpecifier(specifier)) assertions.set(name, "assert");
	else if (EXACT_ASSERTION_METHODS.has(getImportedName(specifier))) assertions.set(name, "function");
}

function collectImportedAssertions(program: ESTree.Program): Map<string, ImportedAssertionKind> {
	const assertions = new Map<string, ImportedAssertionKind>();
	for (const statement of program.body) {
		if (!isImportDeclaration(statement)) continue;

		const { value } = statement.source;
		for (const specifier of statement.specifiers) collectImportedSpecifier(assertions, value, specifier);
	}
	return assertions;
}

function getExpressionArgument(node: ESTree.CallExpression, index: number): ESTree.Expression | undefined {
	const argument = node.arguments[index];
	return isSpreadElement(argument) ? undefined : argument;
}

function getCallPairArguments(
	node: ESTree.CallExpression,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	const actual = getExpressionArgument(node, 0);
	const expected = getExpressionArgument(node, 1);
	if (actual === undefined || expected === undefined) return undefined;
	return [actual, expected];
}

function getFunctionAssertionOperands(
	node: ESTree.CallExpression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	if (!isIdentifierName(node.callee)) return undefined;
	if (imports.get(node.callee.name) !== "function") return undefined;
	return getCallPairArguments(node);
}

function getAssertMethodOperands(
	node: ESTree.CallExpression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	if (!isMemberExpression(node.callee)) return undefined;
	const method = getMemberPropertyName(node.callee);
	if (method === undefined) return undefined;
	if (!EXACT_ASSERTION_METHODS.has(method)) return undefined;
	if (!isIdentifierName(node.callee.object)) return undefined;
	if (imports.get(node.callee.object.name) !== "assert") return undefined;
	return getCallPairArguments(node);
}

function unwrapNotReceiver(receiver: ESTree.Expression): ESTree.Expression {
	if (isMemberExpression(receiver) && getMemberPropertyName(receiver) === "not") return receiver.object;
	return receiver;
}

function isExpectCallReceiver(
	receiver: ESTree.Expression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): receiver is ESTree.CallExpression {
	if (!isCallExpression(receiver)) return false;
	if (!isIdentifierName(receiver.callee)) return false;
	return imports.get(receiver.callee.name) === "expect";
}

function getExpectPairArguments(
	receiver: ESTree.CallExpression,
	node: ESTree.CallExpression,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	const actual = getExpressionArgument(receiver, 0);
	const expected = getExpressionArgument(node, 0);
	if (actual === undefined || expected === undefined) return undefined;
	return [actual, expected];
}

function getExpectAssertionOperands(
	node: ESTree.CallExpression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	if (!isMemberExpression(node.callee)) return undefined;
	const method = getMemberPropertyName(node.callee);
	if (method === undefined || !EXACT_EXPECT_MATCHERS.has(method)) return undefined;

	const receiver = unwrapNotReceiver(node.callee.object);
	return isExpectCallReceiver(receiver, imports) ? getExpectPairArguments(receiver, node) : undefined;
}

function assertionOperands(
	node: ESTree.CallExpression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	const functionOperands = getFunctionAssertionOperands(node, imports);
	if (functionOperands !== undefined) return functionOperands;

	const assertOperands = getAssertMethodOperands(node, imports);
	if (assertOperands !== undefined) return assertOperands;

	return getExpectAssertionOperands(node, imports);
}

function comparisonOrientations(node: ComparableBinaryExpression): readonly [OrientedComparison, OrientedComparison] {
	const above = node.operator === ">" || node.operator === ">=";
	return [
		{ above, expression: node.left, threshold: node.right },
		{ above: !above, expression: node.right, threshold: node.left },
	];
}

function isComparableBinary(node: ESTree.Expression): node is ComparableBinaryExpression {
	return isBinaryExpression(node) && !isPrivateIdentifier(node.left);
}

const WHITESPACE = /\s+/gu;

function nodesAreEquivalent(left: ESTree.Node, right: ESTree.Node, sourceCode: SourceCode): boolean {
	return (
		left.type === right.type &&
		sourceCode.getText(left).replaceAll(WHITESPACE, "") === sourceCode.getText(right).replaceAll(/\s+/gu, "")
	);
}

function isAndOperator(
	node: ESTree.LogicalExpression,
	left: ComparableBinaryExpression,
	right: ComparableBinaryExpression,
): boolean {
	return (
		node.operator === "&&" &&
		(left.operator === "<=" || left.operator === ">=") &&
		(right.operator === "<=" || right.operator === ">=")
	);
}

function isOrOperator(
	node: ESTree.LogicalExpression,
	left: ComparableBinaryExpression,
	right: ComparableBinaryExpression,
): boolean {
	return (
		node.operator === "||" &&
		(left.operator === "<" || left.operator === ">") &&
		(right.operator === "<" || right.operator === ">")
	);
}

function indirectComparisonOperands(
	node: ESTree.LogicalExpression,
	sourceCode: SourceCode,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	const { left, right } = node;
	if (!isComparableBinary(left) || !isComparableBinary(right)) return undefined;

	const accepted = isAndOperator(node, left, right) || isOrOperator(node, left, right);
	if (!accepted) return undefined;

	for (const leftComparison of comparisonOrientations(left)) {
		for (const rightComparison of comparisonOrientations(right)) {
			if (
				leftComparison.above !== rightComparison.above &&
				nodesAreEquivalent(leftComparison.expression, rightComparison.expression, sourceCode) &&
				nodesAreEquivalent(leftComparison.threshold, rightComparison.threshold, sourceCode)
			) {
				return [leftComparison.expression, leftComparison.threshold];
			}
		}
	}
	return undefined;
}

function isFloatingPair(
	operands: readonly [ESTree.Expression, ESTree.Expression] | undefined,
	isFloating: (expression: ESTree.Expression) => boolean,
): boolean {
	if (operands === undefined) return false;
	return isFloating(operands[0]) || isFloating(operands[1]);
}

function isFloatingEquality(node: ESTree.Node, isFloating: (expression: ESTree.Expression) => boolean): boolean {
	if (!isBinaryExpression(node) || !EQUALITY_OPERATORS.has(node.operator)) return false;
	if (!isComparableBinary(node)) return false;
	return isFloating(node.left) || isFloating(node.right);
}

function isFloatingIndirectComparison(
	node: ESTree.Node,
	sourceCode: SourceCode,
	isFloating: (expression: ESTree.Expression) => boolean,
): boolean {
	if (!isLogicalExpression(node)) return false;
	return isFloatingPair(indirectComparisonOperands(node, sourceCode), isFloating);
}

function isFloatingSwitchTest(node: ESTree.Node, isFloating: (expression: ESTree.Expression) => boolean): boolean {
	if (!isSwitchCase(node)) return false;
	if (node.test === null) return false;
	return isFloating(node.test);
}

function isFloatingAssertion(
	node: ESTree.Node,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
	isFloating: (expression: ESTree.Expression) => boolean,
): boolean {
	if (!isCallExpression(node)) return false;
	return isFloatingPair(assertionOperands(node, imports), isFloating);
}

function shouldReportFloatNode(
	node: ESTree.Node,
	sourceCode: SourceCode,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
	isFloating: (expression: ESTree.Expression) => boolean,
): boolean {
	return (
		isFloatingEquality(node, isFloating) ||
		isFloatingIndirectComparison(node, sourceCode, isFloating) ||
		isFloatingSwitchTest(node, isFloating) ||
		isFloatingAssertion(node, imports, isFloating)
	);
}

const noFloatingPointEquality = createRule("no-floating-point-equality", "general", {
	create(context): Visitor {
		return {
			Program(program): void {
				const variables = collectVariables(context.sourceCode);
				const imports = collectImportedAssertions(program);
				function isFloating(node: ESTree.Expression): boolean {
					return isFloatingExpression(node, variables, new Set());
				}
				walkAst(program, (node): void => {
					if (shouldReportFloatNode(node, context.sourceCode, imports, isFloating)) {
						context.report({ messageId: "exactFloatComparison", node });
					}
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow exact comparisons involving inexact floating-point values.",
		},
		messages: {
			exactFloatComparison: "Compare floating-point results within a tolerance instead of for exact equality.",
		},
		schema: [],
		type: "problem",
	},
});

export default noFloatingPointEquality;
