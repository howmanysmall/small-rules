// oxlint-disable unicorn/no-null -- assertion constants include the null primitive.
import { getMemberPropertyName, getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, InferContextFromRule, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ConstantPrimitive = bigint | boolean | null | number | string | undefined;
type PredicateKind = "defined" | "falsy" | "null" | "truthy" | "undefined";

interface ResolvedConstant {
	readonly value: ConstantPrimitive;
}

type Context = InferContextFromRule<typeof noTrivialAssertions>;

function isFalsyConstant(value: ConstantPrimitive): boolean {
	return value === false || value === 0 || value === "" || value === null || value === undefined || value === 0n;
}

const FRESH_REFERENCE_TYPES = new Set([
	"ArrayExpression",
	"ArrowFunctionExpression",
	"ClassExpression",
	"FunctionExpression",
	"NewExpression",
	"ObjectExpression",
]);

// Identity-only matchers: freshly-created values never pass `toBe`.
// `toStrictEqual` is deep equality and must not use the fresh-identity path.
const IDENTITY_MATCHERS = new Set(["toBe"]);
const DEEP_MATCHERS = new Set(["toEqual", "toStrictEqual"]);
const PREDICATE_MATCHERS = new Map<string, PredicateKind>([
	["toBeDefined", "defined"],
	["toBeFalsy", "falsy"],
	["toBeNull", "null"],
	["toBeTruthy", "truthy"],
	["toBeUndefined", "undefined"],
]);

const ASSERT_STRICT_METHODS = new Set(["deepStrictEqual", "notDeepStrictEqual", "notStrictEqual", "strictEqual"]);
const ASSERT_LOOSE_METHODS = new Set(["deepEqual", "equal", "notDeepEqual", "notEqual"]);

function isFreshReferenceExpression(node: ESTree.Node): boolean {
	return (node.type === "Literal" && "regex" in node) || FRESH_REFERENCE_TYPES.has(node.type);
}

function constantFromLiteral(node: ESTree.Node): ResolvedConstant | undefined {
	if (node.type !== "Literal") return undefined;
	if (node.value === null) return { value: null };
	if (typeof node.value === "string" || typeof node.value === "number" || typeof node.value === "boolean") {
		return { value: node.value };
	}
	if (typeof node.value === "bigint") return { value: node.value };
	/* v8 ignore next -- remaining Literal values are non-primitive (e.g. regex already handled as fresh). @preserve */
	return undefined;
}

function unwrapNode(node: ESTree.Node): ESTree.Node {
	let current = node;
	while (
		current.type === "ChainExpression" ||
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSInstantiationExpression" ||
		current.type === "TSNonNullExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion"
	) {
		current = current.expression;
	}
	return current;
}

function resolveUnaryConstant(
	sourceCode: SourceCode,
	expression: ESTree.UnaryExpression,
	seen: Set<ESTree.Node>,
): ResolvedConstant | undefined {
	if (expression.operator === "void") return { value: undefined };
	if (expression.operator === "typeof") {
		const argument = resolveConstantPrimitive(sourceCode, expression.argument, seen);
		return argument === undefined ? undefined : { value: typeof argument.value };
	}
	const argument = resolveConstantPrimitive(sourceCode, expression.argument, seen);
	if (argument === undefined) return undefined;
	if (expression.operator === "!") return { value: isFalsyConstant(argument.value) };
	if (typeof argument.value !== "number") return undefined;
	if (expression.operator === "+") return { value: argument.value };
	if (expression.operator === "-") return { value: -argument.value };
	return undefined;
}

function resolveIdentifierConstant(
	sourceCode: SourceCode,
	expression: ESTree.Node & { readonly name: string },
	seen: Set<ESTree.Node>,
): ResolvedConstant | undefined {
	if (expression.name === "undefined") return { value: undefined };
	const scope = sourceCode.getScope(expression);
	const variable = getVariableByName(scope, expression.name);
	const [definition] = variable?.defs ?? [];
	if (
		definition?.type !== "Variable" ||
		definition.node.type !== "VariableDeclarator" ||
		definition.node.init === null ||
		definition.parent?.type !== "VariableDeclaration" ||
		definition.parent.kind !== "const"
	) {
		return undefined;
	}
	return resolveConstantPrimitive(sourceCode, definition.node.init, seen);
}

function resolveConstantPrimitive(
	sourceCode: SourceCode,
	node: ESTree.Node,
	seen: Set<ESTree.Node>,
): ResolvedConstant | undefined {
	const expression = unwrapNode(node);
	if (seen.has(expression)) return undefined;
	seen.add(expression);

	const literal = constantFromLiteral(expression);
	if (literal !== undefined) return literal;
	if (expression.type === "UnaryExpression") return resolveUnaryConstant(sourceCode, expression, seen);
	if (expression.type === "Identifier") {
		return resolveIdentifierConstant(sourceCode, expression, seen);
	}
	return undefined;
}

function predicateHolds(predicate: PredicateKind, value: ConstantPrimitive): boolean {
	if (predicate === "truthy") return !isFalsyConstant(value);
	if (predicate === "falsy") return isFalsyConstant(value);
	if (predicate === "defined") return value !== undefined;
	if (predicate === "undefined") return value === undefined;
	return value === null;
}

function freshReferencePredicateHolds(predicate: PredicateKind): boolean {
	return predicate === "truthy" || predicate === "defined";
}

function constantsEqual(_strict: boolean, left: ConstantPrimitive, right: ConstantPrimitive): boolean {
	// Resolved constants are primitive-only; Object.is matches both strict and practical loose cases we cover.
	return Object.is(left, right);
}

function isExpectCall(node: ESTree.CallExpression): boolean {
	return node.callee.type === "Identifier" && node.callee.name === "expect";
}

function getExpectReceiver(node: ESTree.CallExpression): ESTree.CallExpression | undefined {
	if (node.callee.type !== "MemberExpression") return undefined;
	let receiver = node.callee.object;
	if (receiver.type === "MemberExpression" && getMemberPropertyName(receiver) === "not") {
		receiver = receiver.object;
	}
	if (receiver.type !== "CallExpression" || !isExpectCall(receiver)) return undefined;
	return receiver;
}

function isNegatedMatcher(node: ESTree.CallExpression): boolean {
	/* v8 ignore next -- callers only pass MemberExpression matcher callees. @preserve */
	if (node.callee.type !== "MemberExpression") return false;
	const { object } = node.callee;
	return object.type === "MemberExpression" && getMemberPropertyName(object) === "not";
}

function firstExpressionArgument(node: ESTree.CallExpression, index: number): ESTree.Node | undefined {
	const argument = node.arguments[index];
	if (argument === undefined || argument.type === "SpreadElement") return undefined;
	return unwrapNode(argument);
}

function reportPredicateAssertion(
	context: Context,
	actual: ESTree.Node,
	predicate: PredicateKind,
	negated: boolean,
): void {
	const constant = resolveConstantPrimitive(context.sourceCode, actual, new Set());
	if (constant !== undefined && predicateHolds(predicate, constant.value) !== negated) {
		context.report({ messageId: "issue", node: actual });
		return;
	}
	if (isFreshReferenceExpression(actual) && freshReferencePredicateHolds(predicate) !== negated) {
		context.report({ messageId: "freshPredicate", node: actual });
	}
}

function reportComparisonAssertion(
	context: Context,
	actual: ESTree.Node,
	expected: ESTree.Node,
	strict: boolean,
	negated: boolean,
	freshMatcher: string,
): void {
	if (strict && (isFreshReferenceExpression(actual) || isFreshReferenceExpression(expected))) {
		context.report({
			data: { matcher: freshMatcher },
			messageId: "freshIdentity",
			node: isFreshReferenceExpression(actual) ? actual : expected,
		});
		return;
	}
	const actualConstant = resolveConstantPrimitive(context.sourceCode, actual, new Set());
	const expectedConstant = resolveConstantPrimitive(context.sourceCode, expected, new Set());
	if (actualConstant === undefined || expectedConstant === undefined) return;
	const equal = constantsEqual(strict, actualConstant.value, expectedConstant.value);
	if (equal !== negated) context.report({ messageId: "issue", node: actual });
}

function reportTrivialExpect(context: Context, node: ESTree.CallExpression): void {
	const receiver = getExpectReceiver(node);
	/* v8 ignore next -- getExpectReceiver only succeeds for MemberExpression matchers. @preserve */
	if (receiver === undefined || node.callee.type !== "MemberExpression") return;
	const matcher = getMemberPropertyName(node.callee);
	/* v8 ignore next -- MemberExpression matchers always expose a property name here. @preserve */
	if (matcher === undefined) return;
	const actual = firstExpressionArgument(receiver, 0);
	if (actual === undefined) return;
	const negated = isNegatedMatcher(node);

	const predicate = PREDICATE_MATCHERS.get(matcher);
	if (predicate !== undefined) {
		reportPredicateAssertion(context, actual, predicate, negated);
		return;
	}

	const isIdentity = IDENTITY_MATCHERS.has(matcher);
	if (!(isIdentity || DEEP_MATCHERS.has(matcher))) return;
	const expected = firstExpressionArgument(node, 0);
	if (expected === undefined) return;
	// Only identity matchers get the fresh-reference hint; deep matchers only constant-fold.
	reportComparisonAssertion(context, actual, expected, isIdentity, negated, negated ? "not.toEqual" : "toEqual");
}

function reportTrivialAssert(context: Context, node: ESTree.CallExpression): void {
	if (node.callee.type !== "MemberExpression" || node.callee.object.type !== "Identifier") return;
	if (node.callee.object.name !== "assert") return;
	const method = getMemberPropertyName(node.callee);
	/* v8 ignore next -- assert.* MemberExpressions expose a property name. @preserve */
	if (method === undefined) return;

	const left = firstExpressionArgument(node, 0);
	if (left === undefined) return;

	if (method === "ok" || method === "notOk") {
		const constant = resolveConstantPrimitive(context.sourceCode, left, new Set());
		const expectsTruthy = method === "ok";
		if (constant !== undefined && Boolean(constant.value) === expectsTruthy) {
			context.report({ messageId: "issue", node: left });
		}
		return;
	}

	const right = firstExpressionArgument(node, 1);
	if (right === undefined) return;
	const isStrict = ASSERT_STRICT_METHODS.has(method);
	if (!(isStrict || ASSERT_LOOSE_METHODS.has(method))) return;
	const negated = method.startsWith("not");
	reportComparisonAssertion(
		context,
		left,
		right,
		isStrict,
		negated,
		negated ? "notDeepStrictEqual" : "deepStrictEqual",
	);
}

const noTrivialAssertions = createRule("no-trivial-assertions", "general", {
	create(context): Visitor {
		return {
			CallExpression(node): void {
				if (getExpectReceiver(node) !== undefined) {
					reportTrivialExpect(context, node);
					return;
				}
				reportTrivialAssert(context, node);
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow assertions that always succeed or compare against freshly created values.",
			recommended: true,
		},
		messages: {
			freshIdentity: "Use `{{matcher}}` instead; freshly-created values are never identical to other values.",
			freshPredicate:
				"Replace this assertion; the value is freshly created here, so the result is independent of the code under test.",
			issue: "Replace this assertion; it always succeeds.",
		},
		schema: [],
		type: "problem",
	},
});

export default noTrivialAssertions;
