import {
	countExpectCalls,
	getTestCallback,
	isExpectAssertionsCall,
	isExpectHasAssertionsCall,
	isTestCaseCall,
} from "$oxc-utilities/jest-utilities";
import { isNumericLiteral } from "$oxc-utilities/oxc-utilities";
import { isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, Fix, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof preferExpectAssertions>;

interface RuleOptions {
	readonly additionalAssertionFunctions: ReadonlyArray<string>;
	readonly additionalExpectCallNames: ReadonlyArray<string>;
	readonly onlyFunctionsWithAsyncKeyword: boolean;
	readonly onlyFunctionsWithExpectInCallback: boolean;
	readonly onlyFunctionsWithExpectInLoop: boolean;
}

function parseStringArray(value: unknown): ReadonlyArray<string> {
	/* v8 ignore next -- @preserve rule schema restricts these options to a string array type before create() runs. */
	return Array.isArray(value) ? value.filter(isStringRaw) : [];
}

function parseOptions(rawOptions: unknown): RuleOptions {
	if (!isRecord(rawOptions)) {
		return {
			additionalAssertionFunctions: [],
			additionalExpectCallNames: [],
			onlyFunctionsWithAsyncKeyword: false,
			onlyFunctionsWithExpectInCallback: false,
			onlyFunctionsWithExpectInLoop: false,
		};
	}

	return {
		additionalAssertionFunctions: parseStringArray(rawOptions.additionalAssertionFunctions),
		additionalExpectCallNames: parseStringArray(rawOptions.additionalExpectCallNames),
		onlyFunctionsWithAsyncKeyword: rawOptions.onlyFunctionsWithAsyncKeyword === true,
		onlyFunctionsWithExpectInCallback: rawOptions.onlyFunctionsWithExpectInCallback === true,
		onlyFunctionsWithExpectInLoop: rawOptions.onlyFunctionsWithExpectInLoop === true,
	};
}

function getAdditionalExpectCallNames(options: RuleOptions): ReadonlyArray<string> {
	return [...new Set([...options.additionalExpectCallNames, ...options.additionalAssertionFunctions])];
}

function hasEnabledFilter(options: RuleOptions): boolean {
	return (
		options.onlyFunctionsWithAsyncKeyword ||
		options.onlyFunctionsWithExpectInCallback ||
		options.onlyFunctionsWithExpectInLoop
	);
}

function getCallbackBody(callback: CallbackFunction): ESTree.Node | undefined {
	/* v8 ignore next -- @preserve parser callback functions always expose a body. */
	return callback.body ?? undefined;
}

function getCallbackBlockBody(callback: CallbackFunction): ESTree.BlockStatement | undefined {
	const body = getCallbackBody(callback);
	return body?.type === "BlockStatement" ? body : undefined;
}

function shouldCheckTest(
	callback: CallbackFunction,
	options: RuleOptions,
	deterministic: number,
	indeterminate: number,
	hasExpectInCallback: boolean,
	hasExpectInLoop: boolean,
): boolean {
	if (deterministic + indeterminate === 0) return false;
	return (
		!hasEnabledFilter(options) ||
		(options.onlyFunctionsWithAsyncKeyword && callback.async) ||
		(options.onlyFunctionsWithExpectInCallback && hasExpectInCallback) ||
		(options.onlyFunctionsWithExpectInLoop && hasExpectInLoop)
	);
}

function getFirstStatementCall(callback: CallbackFunction): ESTree.CallExpression | undefined {
	const body = getCallbackBlockBody(callback);
	if (body === undefined) return undefined;

	const [firstStatement] = body.body;
	if (firstStatement?.type !== "ExpressionStatement" || firstStatement.expression.type !== "CallExpression") {
		return undefined;
	}
	return firstStatement.expression;
}

function reportMissingAssertions(
	context: RuleContext,
	callback: CallbackFunction,
	node: ESTree.CallExpression,
	count: number,
	hasIndeterminate: boolean,
): void {
	const body = getCallbackBlockBody(callback);
	if (body === undefined) {
		context.report({
			messageId: "haveExpectAssertions",
			node,
		});
		return;
	}

	const [firstStatement] = body.body;

	if (hasIndeterminate) {
		context.report({
			messageId: "haveExpectAssertions",
			node,
			suggest: [
				{
					fix(fixer): Fix {
						/* v8 ignore next -- positive indeterminate assertion count requires a non-empty block @preserve */
						if (firstStatement !== undefined) {
							return fixer.insertTextBefore(firstStatement, "expect.hasAssertions();\n");
						}
						/* v8 ignore next -- positive indeterminate assertion count requires a non-empty block @preserve */
						return fixer.insertTextAfterRange(
							[body.range[0], body.range[0] + 1],
							" expect.hasAssertions();",
						);
					},
					messageId: "suggestAddingHasAssertions",
				},
			],
		});
		return;
	}

	context.report({
		messageId: "haveExpectAssertions",
		node,
		suggest: [
			{
				data: { count: String(count) },
				fix(fixer): Fix {
					/* v8 ignore next -- positive deterministic assertion count requires a non-empty block @preserve */
					if (firstStatement !== undefined) {
						return fixer.insertTextBefore(firstStatement, `expect.assertions(${count});\n`);
					}
					/* v8 ignore next -- positive deterministic assertion count requires a non-empty block @preserve */
					return fixer.insertTextAfterRange(
						[body.range[0], body.range[0] + 1],
						` expect.assertions(${count});`,
					);
				},
				messageId: "suggestAddingAssertions",
			},
		],
	});
}

function validateAssertionCall(
	context: RuleContext,
	assertionCall: ESTree.CallExpression,
	deterministic: number,
	hasIndeterminate: boolean,
): void {
	if (isExpectHasAssertionsCall(assertionCall)) {
		if (assertionCall.arguments.length > 0) {
			context.report({
				messageId: "hasAssertionsTakesNoArguments",
				node: assertionCall,
			});
		}
		return;
	}

	/* v8 ignore next -- @preserve caller validates only assertion guard calls here. */
	if (!isExpectAssertionsCall(assertionCall)) return;
	if (assertionCall.arguments.length !== 1) {
		context.report({
			messageId: "assertionsRequiresOneArgument",
			node: assertionCall,
		});
		return;
	}

	const [firstArgument] = assertionCall.arguments;
	if (firstArgument === undefined || firstArgument.type === "SpreadElement" || !isNumericLiteral(firstArgument)) {
		context.report({
			messageId: "assertionsRequiresNumberArgument",
			node: assertionCall,
		});
		return;
	}

	if (!hasIndeterminate && deterministic > 0 && firstArgument.value !== deterministic) {
		context.report({
			data: { actual: String(deterministic), expected: String(firstArgument.value) },
			messageId: "wrongAssertionCount",
			node: assertionCall,
		});
	}
}

const preferExpectAssertions = defineRule({
	create(context): Visitor {
		const options = parseOptions(context.options[0]);

		return {
			CallExpression(node): void {
				if (!isTestCaseCall(node)) return;

				const callback = getTestCallback(node);
				/* v8 ignore next -- @preserve test-case calls without callbacks have no assertion behavior to check. */
				if (callback === undefined) return;

				const body = getCallbackBody(callback);
				/* v8 ignore next -- @preserve parser callback functions always expose a body. */
				if (body === undefined) return;

				const { deterministic, indeterminate, hasIndeterminate, hasExpectInCallback, hasExpectInLoop } =
					countExpectCalls(body, getAdditionalExpectCallNames(options));
				if (
					!shouldCheckTest(
						callback,
						options,
						deterministic,
						indeterminate,
						hasExpectInCallback,
						hasExpectInLoop,
					)
				) {
					return;
				}

				const assertionCall = getFirstStatementCall(callback);
				if (
					assertionCall !== undefined &&
					(isExpectAssertionsCall(assertionCall) || isExpectHasAssertionsCall(assertionCall))
				) {
					validateAssertionCall(context, assertionCall, deterministic, hasIndeterminate);

					if (
						isExpectHasAssertionsCall(assertionCall) &&
						assertionCall.arguments.length === 0 &&
						deterministic > 0 &&
						!hasIndeterminate
					) {
						/* v8 ignore next -- @preserve first assertion calls are already known to be inside a block body. */
						const blockBody = getCallbackBlockBody(callback);
						/* v8 ignore next -- @preserve first assertion calls are already known to have a first statement. */
						const [firstStatement] = blockBody?.body ?? [];
						/* v8 ignore next -- @preserve first assertion calls are already known to have a first statement. */
						if (firstStatement !== undefined) {
							context.report({
								data: { count: String(deterministic) },
								fix(fixer): Fix {
									return fixer.replaceText(firstStatement, `expect.assertions(${deterministic});`);
								},
								messageId: "preferAssertionsCount",
								node: assertionCall,
							});
						}
					}

					return;
				}

				reportMissingAssertions(context, callback, node, deterministic, hasIndeterminate);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Enforce expect assertion guards in tests and prefer expect.assertions(n) over expect.hasAssertions() when the count is known.",
			recommended: true,
		},
		fixable: "code",
		hasSuggestions: true,
		messages: {
			assertionsRequiresNumberArgument: "This argument should be a number",
			assertionsRequiresOneArgument: "`expect.assertions` expects a single argument of type number",
			hasAssertionsTakesNoArguments: "`expect.hasAssertions` expects no arguments",
			haveExpectAssertions:
				"Every test should have either `expect.assertions(<number of assertions>)` or `expect.hasAssertions()` as its first expression",
			preferAssertionsCount:
				"Use `expect.assertions({{count}})` instead of `expect.hasAssertions()` when the count is known",
			suggestAddingAssertions: "Add `expect.assertions({{count}})`",
			suggestAddingHasAssertions: "Add `expect.hasAssertions()`",
			wrongAssertionCount: "Expected {{expected}} assertions, but test has {{actual}} expect calls",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					additionalAssertionFunctions: {
						default: [],
						description: "Additional assertion function names counted as test assertions.",
						items: { type: "string" },
						type: "array",
					},
					additionalExpectCallNames: {
						default: [],
						description: "Additional expect-like call names counted when checking assertion counts.",
						items: { type: "string" },
						type: "array",
					},
					onlyFunctionsWithAsyncKeyword: {
						default: false,
						description: "Only require assertion guards for test callbacks marked async.",
						type: "boolean",
					},
					onlyFunctionsWithExpectInCallback: {
						default: false,
						description: "Only require assertion guards when expect is called inside a nested callback.",
						type: "boolean",
					},
					onlyFunctionsWithExpectInLoop: {
						default: false,
						description: "Only require assertion guards when expect is called inside a loop.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default preferExpectAssertions;
