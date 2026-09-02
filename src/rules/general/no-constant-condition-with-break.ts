import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	ARRAY_EXPRESSION,
	ARROW_FUNCTION_EXPRESSION,
	ASSIGNMENT_EXPRESSION,
	AWAIT_EXPRESSION,
	BINARY_EXPRESSION,
	BLOCK_STATEMENT,
	BREAK_STATEMENT,
	CALL_EXPRESSION,
	CLASS_EXPRESSION,
	CONDITIONAL_EXPRESSION,
	DO_WHILE_STATEMENT,
	EXPRESSION_STATEMENT,
	FOR_IN_STATEMENT,
	FOR_OF_STATEMENT,
	FOR_STATEMENT,
	FUNCTION_EXPRESSION,
	getMemberPropertyName,
	IDENTIFIER,
	IF_STATEMENT,
	isAnyFunction,
	isBindingIdentifier,
	isLabeledStatement,
	isLoopNode,
	isMemberExpression,
	isProgram,
	isSpreadElement,
	isSwitchStatement,
	isVariableDeclaration,
	LITERAL,
	LOGICAL_EXPRESSION,
	MEMBER_EXPRESSION,
	NEW_EXPRESSION,
	OBJECT_EXPRESSION,
	RETURN_STATEMENT,
	SEQUENCE_EXPRESSION,
	SWITCH_STATEMENT,
	TAGGED_TEMPLATE_EXPRESSION,
	TEMPLATE_LITERAL,
	TRY_STATEMENT,
	UNARY_EXPRESSION,
	unwrapExpression,
	UPDATE_EXPRESSION,
	VARIABLE_DECLARATION,
	WHILE_STATEMENT,
	WITH_STATEMENT,
	YIELD_EXPRESSION,
} from "$oxc-utilities/oxc-utilities";
import { isNonEmptyString } from "$oxc-utilities/type-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";
import type { JsonValue } from "type-fest";

import type { LoopNode } from "$oxc-utilities/oxc-utilities";

interface NoConstantConditionWithBreakOptions {
	readonly loopExitCalls?: ReadonlyArray<string>;
}

interface ConstantValueResult {
	readonly constant: boolean;
	readonly value?: ConstantValue;
}

type ConstantValue = bigint | JsonValue | RegExp | undefined;

interface ConstantBooleanResult {
	readonly constant: boolean;
	readonly value?: boolean;
}

const NON_CONSTANT_VALUE: ConstantValueResult = { constant: false };
const NON_CONSTANT_BOOLEAN: ConstantBooleanResult = { constant: false };

function toConstantValue(value: ConstantValue): ConstantValueResult {
	return { constant: true, value };
}

function toConstantBoolean(value: boolean): ConstantBooleanResult {
	return { constant: true, value };
}

function normalizeLoopExitCalls(options: NoConstantConditionWithBreakOptions | undefined): ReadonlySet<string> {
	const loopExitCalls = new Set<string>();
	if (!options?.loopExitCalls) return loopExitCalls;

	for (const loopExitCall of options.loopExitCalls) {
		/* v8 ignore next -- @preserve rule schema rejects empty or non-string loopExitCalls entries. */
		if (isNonEmptyString(loopExitCall)) loopExitCalls.add(loopExitCall);
	}

	return loopExitCalls;
}

function getNodePath(node: ESTree.Expression): string | undefined {
	const unwrapped = unwrapExpression(node);

	if (isBindingIdentifier(unwrapped)) return unwrapped.name;
	if (!isMemberExpression(unwrapped)) return undefined;

	const objectPath = getNodePath(unwrapped.object);
	if (objectPath === undefined || objectPath.length === 0) return undefined;

	const propertyName = getMemberPropertyName(unwrapped);
	if (propertyName === undefined || propertyName.length === 0) return undefined;

	return `${objectPath}.${propertyName}`;
}

function isConfiguredLoopExitCall(callExpression: ESTree.CallExpression, loopExitCalls: ReadonlySet<string>): boolean {
	/* v8 ignore next -- @preserve expressionContainsConfiguredLoopExit returns before calls when no exits are configured. */
	if (loopExitCalls.size === 0) return false;

	const calleePath = getNodePath(callExpression.callee);
	if (calleePath === undefined || calleePath.length === 0) return false;

	return loopExitCalls.has(calleePath);
}

function addArrayElementsToPending(expression: ESTree.ArrayExpression, pending: Array<ESTree.Expression>): void {
	for (const element of expression.elements) {
		if (element !== null) pending.push(isSpreadElement(element) ? element.argument : element);
	}
}

function addCallArgumentsToPending(
	parameters: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
	pending: Array<ESTree.Expression>,
): void {
	for (const argument of parameters) pending.push(isSpreadElement(argument) ? argument.argument : argument);
}

function addExpressionChildrenToPending(expression: ESTree.Expression, pending: Array<ESTree.Expression>): void {
	switch (expression.type) {
		case ARRAY_EXPRESSION: {
			addArrayElementsToPending(expression, pending);
			break;
		}

		case ASSIGNMENT_EXPRESSION: {
			pending.push(expression.right);
			break;
		}

		case AWAIT_EXPRESSION:
		case UNARY_EXPRESSION:
		case UPDATE_EXPRESSION: {
			pending.push(expression.argument);
			break;
		}

		case BINARY_EXPRESSION: {
			if (expression.left.type !== "PrivateIdentifier") pending.push(expression.left);
			pending.push(expression.right);
			break;
		}

		case CALL_EXPRESSION:
		case NEW_EXPRESSION: {
			pending.push(expression.callee);
			addCallArgumentsToPending(expression.arguments, pending);
			break;
		}

		case CONDITIONAL_EXPRESSION: {
			pending.push(expression.test, expression.consequent, expression.alternate);
			break;
		}

		case LOGICAL_EXPRESSION: {
			pending.push(expression.left, expression.right);
			break;
		}

		case MEMBER_EXPRESSION: {
			pending.push(expression.object);
			if (expression.computed) pending.push(expression.property);
			break;
		}

		case SEQUENCE_EXPRESSION:
		case TEMPLATE_LITERAL: {
			for (const subExpression of expression.expressions) pending.push(subExpression);
			break;
		}

		case TAGGED_TEMPLATE_EXPRESSION: {
			pending.push(expression.tag);
			for (const quasi of expression.quasi.expressions) pending.push(quasi);
			break;
		}

		case YIELD_EXPRESSION: {
			if (expression.argument) pending.push(expression.argument);
			break;
		}

		default:
			break;
	}
}

function expressionContainsConfiguredLoopExit(
	expression: ESTree.Expression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopExitCalls.size === 0) return false;

	const pending = [expression];
	let index = 0;
	while (index < pending.length) {
		const current = pending[index++];
		/* v8 ignore next -- @preserve index is bounded by pending.length. */
		if (current === undefined) continue;

		const unwrapped = unwrapExpression(current);
		if (unwrapped.type === "CallExpression" && isConfiguredLoopExitCall(unwrapped, loopExitCalls)) return true;
		addExpressionChildrenToPending(unwrapped, pending);
	}

	return false;
}

function getConstantValue(expression: ESTree.Expression): ConstantValueResult {
	let unwrapped = unwrapExpression(expression);

	while (unwrapped.type === "SequenceExpression") {
		const lastExpression = unwrapped.expressions.at(-1);
		/* v8 ignore next -- @preserve parsers do not produce empty sequence expressions. */
		if (!lastExpression) return NON_CONSTANT_VALUE;
		unwrapped = unwrapExpression(lastExpression);
	}

	switch (unwrapped.type) {
		case ARRAY_EXPRESSION:
			return toConstantValue([]);

		case ARROW_FUNCTION_EXPRESSION:
		case CLASS_EXPRESSION:
		case FUNCTION_EXPRESSION:
			return toConstantValue(true);

		case IDENTIFIER: {
			if (unwrapped.name === "undefined") return toConstantValue(undefined);
			if (unwrapped.name === "NaN") return toConstantValue(Number.NaN);
			if (unwrapped.name === "Infinity") return toConstantValue(Number.POSITIVE_INFINITY);
			return NON_CONSTANT_VALUE;
		}

		case LITERAL:
			return toConstantValue(unwrapped.value);

		case LOGICAL_EXPRESSION:
			return getLogicalConstantValue(unwrapped);

		case OBJECT_EXPRESSION:
			return toConstantValue({});

		case TEMPLATE_LITERAL: {
			if (unwrapped.expressions.length > 0) return NON_CONSTANT_VALUE;
			/* v8 ignore next -- @preserve parsers keep at least one quasi for template literals. */
			if (unwrapped.quasis.length === 0) return toConstantValue("");
			/* v8 ignore next -- @preserve untagged template literal cooked values are strings in parser output. */
			return toConstantValue(unwrapped.quasis[0]?.value.cooked ?? "");
		}

		case UNARY_EXPRESSION:
			return getUnaryConstantValue(unwrapped);

		default:
			return NON_CONSTANT_VALUE;
	}
}

function getLogicalConstantValue(expression: ESTree.LogicalExpression): ConstantValueResult {
	const left = getConstantValue(expression.left);
	if (!left.constant) return NON_CONSTANT_VALUE;

	if (expression.operator === "&&") {
		if (left.value !== true) return toConstantValue(left.value);
		return getConstantValue(expression.right);
	}

	if (expression.operator === "||") {
		if (left.value === true) return toConstantValue(left.value);
		return getConstantValue(expression.right);
	}

	if (left.value !== undefined) return toConstantValue(left.value);
	return getConstantValue(expression.right);
}

function getUnaryConstantValue(expression: ESTree.UnaryExpression): ConstantValueResult {
	if (expression.operator === "typeof") return toConstantValue("string");
	if (expression.operator === "void") return toConstantValue(undefined);

	const argument = getConstantValue(expression.argument);
	if (!argument.constant) return NON_CONSTANT_VALUE;

	// oxlint-disable-next-line typescript/strict-boolean-expressions -- really dumb
	if (expression.operator === "!") return toConstantValue(!argument.value);
	if (expression.operator === "+" && Predicate.isNumber(argument.value)) return toConstantValue(argument.value);
	if (expression.operator === "-" && Predicate.isNumber(argument.value)) return toConstantValue(-argument.value);
	if (expression.operator === "~" && Predicate.isNumber(argument.value)) return toConstantValue(~argument.value);
	return NON_CONSTANT_VALUE;
}

function getConstantBoolean(expression: ESTree.Expression): ConstantBooleanResult {
	let unwrapped = unwrapExpression(expression);

	while (unwrapped.type === "SequenceExpression") {
		const lastExpression = unwrapped.expressions.at(-1);
		/* v8 ignore next -- @preserve parsers do not produce empty sequence expressions. */
		if (!lastExpression) return NON_CONSTANT_BOOLEAN;
		unwrapped = unwrapExpression(lastExpression);
	}

	if (unwrapped.type === "ConditionalExpression") {
		return getConditionalConstantBoolean(unwrapped);
	}

	if (unwrapped.type === "LogicalExpression") {
		return getLogicalConstantBoolean(unwrapped);
	}

	const value = getConstantValue(unwrapped);
	if (!value.constant) return NON_CONSTANT_BOOLEAN;
	return toConstantBoolean(Boolean(value.value));
}

function getConditionalConstantBoolean(expression: ESTree.ConditionalExpression): ConstantBooleanResult {
	const test = getConstantBoolean(expression.test);
	if (test.constant) return getConstantBoolean(test.value === true ? expression.consequent : expression.alternate);

	const consequent = getConstantBoolean(expression.consequent);
	const alternate = getConstantBoolean(expression.alternate);
	if (consequent.constant && alternate.constant && consequent.value === alternate.value) return consequent;
	return NON_CONSTANT_BOOLEAN;
}

function getLogicalConstantBoolean(expression: ESTree.LogicalExpression): ConstantBooleanResult {
	const left = getConstantBoolean(expression.left);
	if (!left.constant) return NON_CONSTANT_BOOLEAN;

	if (expression.operator === "&&") {
		// oxlint-disable-next-line typescript/strict-boolean-expressions -- really dumb
		if (!left.value) return toConstantBoolean(false);
		return getConstantBoolean(expression.right);
	}

	if (expression.operator === "||") {
		if (left.value === true) return toConstantBoolean(true);
		return getConstantBoolean(expression.right);
	}

	const leftValue = getConstantValue(expression.left);
	if (!leftValue.constant) return NON_CONSTANT_BOOLEAN;
	if (leftValue.value !== undefined) return toConstantBoolean(Boolean(leftValue.value));
	return getConstantBoolean(expression.right);
}

function findLabeledStatementBody(labelName: string, startingNode: ESTree.Node): ESTree.Statement | undefined {
	let current: ESTree.Node | null = startingNode;

	// oxlint-disable-next-line typescript/no-unnecessary-condition -- conflicting rules
	while (current !== null) {
		if (isLabeledStatement(current) && current.label.name === labelName) return current.body;
		/* v8 ignore next -- @preserve valid break labels must resolve before Program is reached. */
		if (isProgram(current)) return undefined;
		current = current.parent;
	}

	/* v8 ignore next -- @preserve parent traversal reaches Program before null in parser-produced ASTs. */
	return undefined;
}

function breaksTargetLoop(statement: ESTree.BreakStatement, loopNode: LoopNode): boolean {
	if (statement.label) {
		const target = findLabeledStatementBody(statement.label.name, statement.parent);
		return target === loopNode;
	}

	let current: ESTree.Node | null = statement.parent;

	// oxlint-disable-next-line typescript/no-unnecessary-condition -- conflicting rules
	while (current !== null) {
		if (isProgram(current) || isAnyFunction(current) || isSwitchStatement(current)) return false;
		if (isLoopNode(current)) return current === loopNode;
		current = current.parent;
	}

	/* v8 ignore next -- @preserve parent traversal reaches Program before null in parser-produced ASTs. */
	return false;
}

function forStatementInitContainsConfiguredLoopExit(
	initialization: ESTree.ForStatementInit | null,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (!initialization) return false;

	if (isVariableDeclaration(initialization)) {
		return initialization.declarations.some((declaration) =>
			declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
		);
	}

	return expressionContainsConfiguredLoopExit(initialization, loopExitCalls);
}

function loopHeaderContainsConfiguredLoopExit(loopNode: LoopNode, loopExitCalls: ReadonlySet<string>): boolean {
	/* v8 ignore next -- @preserve caller loop-node narrowing restricts this switch to handled loop types. */
	switch (loopNode.type) {
		case DO_WHILE_STATEMENT:
		case WHILE_STATEMENT:
			return expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls);

		/* v8 ignore start -- @preserve constant-condition visitors never pass for-in or for-of nodes here. */
		case FOR_IN_STATEMENT:
		case FOR_OF_STATEMENT:
			return expressionContainsConfiguredLoopExit(loopNode.right, loopExitCalls);
		/* v8 ignore stop -- @preserve */

		case FOR_STATEMENT: {
			return (
				forStatementInitContainsConfiguredLoopExit(loopNode.init, loopExitCalls) ||
				(loopNode.test !== null && expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls)) ||
				(loopNode.update !== null && expressionContainsConfiguredLoopExit(loopNode.update, loopExitCalls))
			);
		}

		/* v8 ignore start -- @preserve LoopNode is restricted to the handled loop statement types. */
		default:
			return false;
		/* v8 ignore stop -- @preserve */
	}
}

function statementContainsLoopExit(
	statement: ESTree.Statement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	let currentStatement = statement;
	while (isLabeledStatement(currentStatement)) currentStatement = currentStatement.body;

	switch (currentStatement.type) {
		case BLOCK_STATEMENT: {
			return currentStatement.body.some((bodyStatement) =>
				statementContainsLoopExit(bodyStatement, loopNode, loopExitCalls),
			);
		}

		case BREAK_STATEMENT:
			return breaksTargetLoop(currentStatement, loopNode);

		case DO_WHILE_STATEMENT:
		case WHILE_STATEMENT:
			return loopStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case EXPRESSION_STATEMENT:
			return expressionContainsConfiguredLoopExit(currentStatement.expression, loopExitCalls);

		case FOR_IN_STATEMENT:
		case FOR_OF_STATEMENT:
			return forEachStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case FOR_STATEMENT:
			return forStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case IF_STATEMENT:
			return ifStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case RETURN_STATEMENT:
			return true;

		case SWITCH_STATEMENT: {
			return currentStatement.cases.some((switchCase) =>
				switchCase.consequent.some((consequent) =>
					statementContainsLoopExit(consequent, loopNode, loopExitCalls),
				),
			);
		}

		case TRY_STATEMENT:
			return tryStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case VARIABLE_DECLARATION: {
			return currentStatement.declarations.some((declaration) =>
				declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
			);
		}

		case WITH_STATEMENT:
			return withStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		default:
			return false;
	}
}

function loopStatementContainsLoopExit(
	statement: ESTree.DoWhileStatement | ESTree.WhileStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) return true;
	return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
}

function forEachStatementContainsLoopExit(
	statement: ESTree.ForInStatement | ESTree.ForOfStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(statement.right, loopExitCalls)) return true;
	return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
}

function forStatementContainsLoopExit(
	statement: ESTree.ForStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return (
		forStatementInitContainsConfiguredLoopExit(statement.init, loopExitCalls) ||
		(statement.test !== null && expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) ||
		(statement.update !== null && expressionContainsConfiguredLoopExit(statement.update, loopExitCalls)) ||
		statementContainsLoopExit(statement.body, loopNode, loopExitCalls)
	);
}

function ifStatementContainsLoopExit(
	statement: ESTree.IfStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (statementContainsLoopExit(statement.consequent, loopNode, loopExitCalls)) return true;
	return statement.alternate ? statementContainsLoopExit(statement.alternate, loopNode, loopExitCalls) : false;
}

function tryStatementContainsLoopExit(
	statement: ESTree.TryStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return (
		statementContainsLoopExit(statement.block, loopNode, loopExitCalls) ||
		(statement.handler !== null && statementContainsLoopExit(statement.handler.body, loopNode, loopExitCalls)) ||
		(statement.finalizer !== null && statementContainsLoopExit(statement.finalizer, loopNode, loopExitCalls))
	);
}

function withStatementContainsLoopExit(
	statement: ESTree.WithStatement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(statement.object, loopExitCalls)) return true;
	return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
}

function shouldReportLoop(
	testResult: ConstantBooleanResult,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (!testResult.constant) return false;
	// oxlint-disable-next-line typescript/strict-boolean-expressions -- really dumb
	if (!testResult.value) return true;
	if (loopHeaderContainsConfiguredLoopExit(loopNode, loopExitCalls)) return false;
	return !statementContainsLoopExit(loopNode.body, loopNode, loopExitCalls);
}

const noConstantConditionWithBreak = createRule("no-constant-condition-with-break", "general", {
	create(context): Visitor {
		// oxlint-disable-next-line typescript/no-unnecessary-condition -- WHAT ARE YOU TALKING ABOUT
		const rawOptions = context.options?.[0];
		const loopExitCalls = normalizeLoopExitCalls(Predicate.isObject(rawOptions) ? rawOptions : undefined);

		function reportConstantCondition(testExpression: ESTree.Expression): void {
			const testResult = getConstantBoolean(testExpression);
			if (!testResult.constant) return;

			context.report({
				messageId: "unexpected",
				node: testExpression,
			});
		}

		function reportLoopIfConstant(loopNode: LoopNode, testExpression: ESTree.Expression): void {
			const testResult = getConstantBoolean(testExpression);
			if (!shouldReportLoop(testResult, loopNode, loopExitCalls)) return;

			context.report({
				messageId: "unexpected",
				node: testExpression,
			});
		}

		return {
			ConditionalExpression(node): void {
				reportConstantCondition(node.test);
			},
			DoWhileStatement(node): void {
				reportLoopIfConstant(node, node.test);
			},
			ForStatement(node): void {
				if (node.test) reportLoopIfConstant(node, node.test);
			},
			IfStatement(node): void {
				reportConstantCondition(node.test);
			},
			WhileStatement(node): void {
				reportLoopIfConstant(node, node.test);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow constant conditions, but allow constant loops that include loop exits such as break, return, or configured calls.",
		},
		messages: {
			unexpected: "Unexpected constant condition.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					loopExitCalls: {
						description: "Call expressions that count as intentional loop exits inside constant loops.",
						items: {
							minLength: 1,
							type: "string",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noConstantConditionWithBreak;
