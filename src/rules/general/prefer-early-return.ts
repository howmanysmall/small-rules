import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import { isBlockStatement, isExpressionStatement, isIfStatement } from "$oxc-utilities/oxc-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

const DEFAULT_MAXIMUM_STATEMENTS = 1;

type RuleOptions = InferContextFromRule<typeof preferEarlyReturn>["options"][0];

function getMaximumStatements(value: RuleOptions): number {
	if (!Predicate.isObject(value) || !Predicate.isNumber(value.maximumStatements)) return DEFAULT_MAXIMUM_STATEMENTS;
	return value.maximumStatements;
}

function isLonelyIfStatement(statement: ESTree.Statement): statement is ESTree.IfStatement {
	return isIfStatement(statement) && statement.alternate === null;
}

function isOffendingConsequent(consequent: ESTree.Statement, maximumStatements: number): boolean {
	return (
		(isExpressionStatement(consequent) && maximumStatements === 0) ||
		(isBlockStatement(consequent) && consequent.body.length > maximumStatements)
	);
}

function canSimplifyConditionalBody(body: ESTree.BlockStatement, maximumStatements: number): boolean {
	if (body.body.length !== 1) return false;

	const [statement] = body.body;
	if (statement === undefined || !isLonelyIfStatement(statement)) return false;

	return isOffendingConsequent(statement.consequent, maximumStatements);
}

const preferEarlyReturn = createRule("prefer-early-return", "general", {
	create(context): Visitor {
		const maximumStatements = getMaximumStatements(context.options[0]);

		function checkFunctionBody(body: ESTree.BlockStatement): void {
			if (!canSimplifyConditionalBody(body, maximumStatements)) return;
			context.report({
				messageId: "preferEarlyReturn",
				node: body,
			});
		}

		function onFunction(node: ESTree.Function): void {
			/* v8 ignore next -- @preserve implemented function declarations have parser bodies. */
			if (node.body !== null) checkFunctionBody(node.body);
		}

		return {
			ArrowFunctionExpression(node): void {
				if (isBlockStatement(node.body)) checkFunctionBody(node.body);
			},
			FunctionDeclaration: onFunction,
			FunctionExpression: onFunction,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer early returns over full-body conditional wrapping.",
			recommended: true,
		},
		messages: {
			preferEarlyReturn:
				"Function body is wrapped in a single conditional without an else branch. This increases nesting depth and cognitive load. Invert the condition and return early: if (!condition) return; then place the main logic at the top level.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					maximumStatements: {
						default: 1,
						description: "Maximum allowed statement count inside the guarded branch before reporting.",
						minimum: 0,
						type: "number",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default preferEarlyReturn;
