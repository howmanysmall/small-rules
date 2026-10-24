import {
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
	isObjectExpression,
	isProperty,
	isStringLiteral,
	TAGGED_TEMPLATE_EXPRESSION,
} from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type NamedMember = ESTree.MemberExpression & { readonly property: ESTree.IdentifierName };

const TEST_FUNCTIONS = ["describe", "fit", "it", "test", "xit", "xtest"] as const;
const MODIFIERS = new Set(["concurrent", "failing", "fails", "only", "sequential", "shuffle", "skip", "todo"]);
const CURRIED_FUNCTIONS = new Set(["each", "for", "runIf", "skipIf"]);

function isNamedMember(node: ESTree.Node): node is NamedMember {
	return isMemberExpression(node) && !node.computed && isIdentifier(node.property);
}

/**
 * Finds the test function behind a curried call such as `test.each(table)`
 * or `` test.each`table` ``.
 *
 * @param node - The callee of a test call.
 * @returns The receiver of `each`, `for`, `runIf`, or `skipIf`, if the callee
 *   is such a call.
 */
function getCurriedReceiver(node: ESTree.Expression): ESTree.Expression | undefined {
	let table: ESTree.Expression;
	if (isCallExpression(node)) {
		table = node.callee;
	} else if (node.type === TAGGED_TEMPLATE_EXPRESSION) {
		table = node.tag;
	} else {
		return undefined;
	}

	return isNamedMember(table) && CURRIED_FUNCTIONS.has(table.property.name) ? table.object : undefined;
}

function isTimeoutProperty(property: ESTree.ObjectExpression["properties"][number]): property is ESTree.ObjectProperty {
	if (!isProperty(property) || property.computed) return false;

	const { key } = property;
	return isIdentifierNamed(key, "timeout") || (isStringLiteral(key) && key.value === "timeout");
}

function findTimeoutProperty(node: ESTree.ObjectExpression): ESTree.ObjectProperty | undefined {
	return node.properties.find(isTimeoutProperty);
}

function findTimeout(parameters: ReadonlyArray<ESTree.Argument>): ESTree.Node | undefined {
	const [, second, third] = parameters;
	if (isObjectExpression(second)) return findTimeoutProperty(second);

	// `it(name, run, TIMEOUT)` reads the same as `test(name, options, run)`, so
	// it passes.
	if (third === undefined || isCallbackFunction(third) || (isIdentifier(third) && !isCallbackFunction(second))) {
		return undefined;
	}

	return isObjectExpression(third) ? findTimeoutProperty(third) : third;
}

const noTestTimeout = createRule("no-test-timeout", "general", {
	create(context): Visitor {
		const [options] = context.options;
		const testFunctions = new Set<string>([...TEST_FUNCTIONS, ...(options?.additionalTestFunctions ?? [])]);

		function isTestCallee(callee: ESTree.Expression): boolean {
			let current = getCurriedReceiver(callee) ?? callee;
			while (isNamedMember(current) && MODIFIERS.has(current.property.name)) {
				current = current.object;
			}

			return isIdentifier(current) && testFunctions.has(current.name);
		}

		return {
			CallExpression(node): void {
				if (!isTestCallee(node.callee)) return;

				const timeout = findTimeout(node.arguments);
				if (timeout !== undefined) {
					context.report({ messageId: "noTestTimeout", node: timeout });
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: { description: "Disallow per-test timeouts in unit tests." },
		messages: {
			noTestTimeout:
				"Per-test timeouts are banned. A slow unit test is a design problem: mock or inject the file system, network, subprocesses, and timers, or remove the dependency, so the test runs fast. Do not raise the timeout or disable this rule.",
		},
		schema: [
			{
				additionalProperties: false,
				default: { additionalTestFunctions: [] },
				properties: {
					additionalTestFunctions: {
						default: [],
						description:
							"Names of test or suite functions to check besides `describe`, `fit`, `it`, `test`, `xit`, and `xtest`",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noTestTimeout;
