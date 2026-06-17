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
import type { Context, ESTree, Fix, Visitor } from "oxlint-plugin-utilities";

type RuleMessageId =
	| "assertionsRequiresNumberArgument"
	| "assertionsRequiresOneArgument"
	| "hasAssertionsTakesNoArguments"
	| "haveExpectAssertions"
	| "preferAssertionsCount"
	| "suggestAddingAssertions"
	| "suggestAddingHasAssertions"
	| "wrongAssertionCount";

interface RuleOptions {
	readonly additionalAssertionFunctions: ReadonlyArray<string>;
	readonly additionalExpectCallNames: ReadonlyArray<string>;
	readonly onlyFunctionsWithAsyncKeyword: boolean;
	readonly onlyFunctionsWithExpectInCallback: boolean;
	readonly onlyFunctionsWithExpectInLoop: boolean;
}

type RuleContext = Context<readonly [Partial<RuleOptions>?], RuleMessageId>;

function parseStringArray(value: unknown): ReadonlyArray<string> {
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
						if (firstStatement !== undefined) {
							return fixer.insertTextBefore(firstStatement, "expect.hasAssertions();\n");
						}
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
					if (firstStatement !== undefined) {
						return fixer.insertTextBefore(firstStatement, `expect.assertions(${count});\n`);
					}
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
				if (callback === undefined) return;

				const body = getCallbackBody(callback);
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
						const blockBody = getCallbackBlockBody(callback);
						const [firstStatement] = blockBody?.body ?? [];
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
