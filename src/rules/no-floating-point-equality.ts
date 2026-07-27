import { forEachScopeVariable, getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { walkAst } from "$oxc-utilities/react-hook-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

const EXPONENT_PATTERN = /e/iu;
const EQUALITY_OPERATORS = new Set(["!=", "!==", "==", "==="]);
const ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "%", "**"]);
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
	if (node.type === "Literal" && typeof node.value === "number") return node.value;
	if (node.type !== "UnaryExpression" || (node.operator !== "+" && node.operator !== "-")) return undefined;
	const value = node.argument.type === "Literal" ? node.argument.value : undefined;
	if (typeof value !== "number") return undefined;
	return node.operator === "-" ? -value : value;
}

function constantNumericValue(node: ESTree.Node): number | undefined {
	const literalValue = numericLiteralValue(node);
	if (literalValue !== undefined) return literalValue;
	if (node.type !== "BinaryExpression" || node.left.type === "PrivateIdentifier") return undefined;
	const left = constantNumericValue(node.left);
	const right = constantNumericValue(node.right);
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
		!Number.isSafeInteger(numerator) ||
		!Number.isSafeInteger(denominator) ||
		denominator === 0
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
		definition.node.type !== "VariableDeclarator" ||
		definition.node.init === null ||
		definition.parent?.type !== "VariableDeclaration" ||
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
	const value = constantNumericValue(node);
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

function isFloatingExpression(
	node: ESTree.Expression,
	variables: ReadonlyMap<ESTree.Node, Variable>,
	visited: Set<Variable>,
): boolean {
	const unwrapped = unwrapExpression(node);
	if (unwrapped !== node) return isFloatingExpression(unwrapped, variables, visited);
	if (node.type === "Literal" && typeof node.value === "number") {
		const raw = String(node.raw);
		return (raw.includes(".") || EXPONENT_PATTERN.test(raw)) && !isExactDecimal(raw);
	}
	if (node.type === "UnaryExpression") {
		return (
			(node.operator === "+" || node.operator === "-") && isFloatingExpression(node.argument, variables, visited)
		);
	}
	if (node.type === "BinaryExpression") {
		if (!isComparableBinary(node)) return false;
		return binaryIsFloating(node, variables, visited);
	}
	if (node.type !== "Identifier") return false;
	const variable = variables.get(node);
	if (variable === undefined || visited.has(variable)) return false;
	const initializer = getConstInitializer(variable);
	if (initializer === undefined) return false;
	visited.add(variable);
	return isFloatingExpression(initializer, variables, visited);
}

function collectVariables(sourceCode: SourceCode): Map<ESTree.Node, Variable> {
	const variables = new Map<ESTree.Node, Variable>();
	forEachScopeVariable(sourceCode, (variable): void => {
		for (const reference of variable.references) variables.set(reference.identifier, variable);
	});
	return variables;
}

function importedName(specifier: ESTree.ImportSpecifier): string {
	return specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
}

function collectImportedSpecifier(
	assertions: Map<string, ImportedAssertionKind>,
	source: string,
	specifier: ESTree.ImportDeclaration["specifiers"][number],
): void {
	const { name } = specifier.local;
	if (EXPECT_MODULES.has(source) && specifier.type === "ImportSpecifier" && importedName(specifier) === "expect") {
		assertions.set(name, "expect");
	}
	if (!ASSERT_MODULES.has(source)) return;
	if (specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier") {
		assertions.set(name, "assert");
	} else if (EXACT_ASSERTION_METHODS.has(importedName(specifier))) {
		assertions.set(name, "function");
	}
}

function collectImportedAssertions(program: ESTree.Program): Map<string, ImportedAssertionKind> {
	const assertions = new Map<string, ImportedAssertionKind>();
	for (const statement of program.body) {
		if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") continue;
		const source = statement.source.value;
		for (const specifier of statement.specifiers) {
			collectImportedSpecifier(assertions, source, specifier);
		}
	}
	return assertions;
}

function expressionArgument(node: ESTree.CallExpression, index: number): ESTree.Expression | undefined {
	const argument = node.arguments[index];
	return argument === undefined || argument.type === "SpreadElement" ? undefined : argument;
}

function assertionOperands(
	node: ESTree.CallExpression,
	imports: ReadonlyMap<string, ImportedAssertionKind>,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	if (node.callee.type === "Identifier" && imports.get(node.callee.name) === "function") {
		const actual = expressionArgument(node, 0);
		const expected = expressionArgument(node, 1);
		return actual === undefined || expected === undefined ? undefined : [actual, expected];
	}
	if (node.callee.type !== "MemberExpression") return undefined;
	const method = getMemberPropertyName(node.callee);
	if (
		method !== undefined &&
		EXACT_ASSERTION_METHODS.has(method) &&
		node.callee.object.type === "Identifier" &&
		imports.get(node.callee.object.name) === "assert"
	) {
		const actual = expressionArgument(node, 0);
		const expected = expressionArgument(node, 1);
		return actual === undefined || expected === undefined ? undefined : [actual, expected];
	}
	if (method === undefined || !EXACT_EXPECT_MATCHERS.has(method)) return undefined;
	let receiver = node.callee.object;
	if (receiver.type === "MemberExpression" && getMemberPropertyName(receiver) === "not") receiver = receiver.object;
	if (
		receiver.type !== "CallExpression" ||
		receiver.callee.type !== "Identifier" ||
		imports.get(receiver.callee.name) !== "expect"
	) {
		return undefined;
	}
	const actual = expressionArgument(receiver, 0);
	const expected = expressionArgument(node, 0);
	return actual === undefined || expected === undefined ? undefined : [actual, expected];
}

function comparisonOrientations(node: ComparableBinaryExpression): readonly [OrientedComparison, OrientedComparison] {
	const above = node.operator === ">" || node.operator === ">=";
	return [
		{ above, expression: node.left, threshold: node.right },
		{ above: !above, expression: node.right, threshold: node.left },
	];
}

function isComparableBinary(node: ESTree.Expression): node is ComparableBinaryExpression {
	return node.type === "BinaryExpression" && node.left.type !== "PrivateIdentifier";
}

function nodesAreEquivalent(left: ESTree.Node, right: ESTree.Node, sourceCode: SourceCode): boolean {
	return (
		left.type === right.type &&
		sourceCode.getText(left).replaceAll(/\s+/gu, "") === sourceCode.getText(right).replaceAll(/\s+/gu, "")
	);
}

function indirectComparisonOperands(
	node: ESTree.LogicalExpression,
	sourceCode: SourceCode,
): readonly [ESTree.Expression, ESTree.Expression] | undefined {
	if (!(isComparableBinary(node.left) && isComparableBinary(node.right))) return undefined;
	const accepted =
		(node.operator === "&&" &&
			(node.left.operator === "<=" || node.left.operator === ">=") &&
			(node.right.operator === "<=" || node.right.operator === ">=")) ||
		(node.operator === "||" &&
			(node.left.operator === "<" || node.left.operator === ">") &&
			(node.right.operator === "<" || node.right.operator === ">"));
	if (!accepted) return undefined;
	for (const left of comparisonOrientations(node.left)) {
		for (const right of comparisonOrientations(node.right)) {
			if (
				left.above !== right.above &&
				nodesAreEquivalent(left.expression, right.expression, sourceCode) &&
				nodesAreEquivalent(left.threshold, right.threshold, sourceCode)
			) {
				return [left.expression, left.threshold];
			}
		}
	}
	return undefined;
}

const noFloatingPointEquality = defineRule({
	create(context): Visitor {
		return {
			Program(program): void {
				const variables = collectVariables(context.sourceCode);
				const imports = collectImportedAssertions(program);
				function isFloating(node: ESTree.Expression): boolean {
					return isFloatingExpression(node, variables, new Set());
				}
				walkAst(program, (node): void => {
					let report = false;
					if (node.type === "BinaryExpression" && EQUALITY_OPERATORS.has(node.operator)) {
						report =
							node.left.type !== "PrivateIdentifier" && (isFloating(node.left) || isFloating(node.right));
					} else if (node.type === "LogicalExpression") {
						const operands = indirectComparisonOperands(node, context.sourceCode);
						report = operands !== undefined && (isFloating(operands[0]) || isFloating(operands[1]));
					} else if (node.type === "SwitchCase" && node.test !== null) report = isFloating(node.test);
					else if (node.type === "CallExpression") {
						const operands = assertionOperands(node, imports);
						report = operands !== undefined && (isFloating(operands[0]) || isFloating(operands[1]));
					}
					if (report) context.report({ messageId: "exactFloatComparison", node });
				});
			},
		};
	},
	meta: {
		docs: { description: "Disallow exact comparisons involving inexact floating-point values." },
		messages: {
			exactFloatComparison: "Compare floating-point results within a tolerance instead of for exact equality.",
		},
		schema: [],
		type: "problem",
	},
});

export default noFloatingPointEquality;
