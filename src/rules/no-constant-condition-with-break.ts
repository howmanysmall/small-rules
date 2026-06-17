import { getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isNonEmptyString, isNumberRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface NoConstantConditionWithBreakOptions {
	readonly loopExitCalls?: ReadonlyArray<string>;
}

interface ConstantValueResult {
	readonly constant: boolean;
	readonly value?: unknown;
}

interface ConstantBooleanResult {
	readonly constant: boolean;
	readonly value?: boolean;
}

function toConstantValue(value: unknown): ConstantValueResult {
	return { constant: true, value };
}

function toNonConstantValue(): ConstantValueResult {
	return { constant: false };
}

function toConstantBoolean(value: boolean): ConstantBooleanResult {
	return { constant: true, value };
}

function toNonConstantBoolean(): ConstantBooleanResult {
	return { constant: false };
}

function normalizeLoopExitCalls(options: NoConstantConditionWithBreakOptions | undefined): ReadonlySet<string> {
	const loopExitCalls = new Set<string>();
	if (!options?.loopExitCalls) return loopExitCalls;

	for (const loopExitCall of options.loopExitCalls) {
		if (isNonEmptyString(loopExitCall)) loopExitCalls.add(loopExitCall);
	}

	return loopExitCalls;
}

function getNodePath(node: ESTree.Expression): string | undefined {
	const unwrapped = unwrapExpression(node);

	if (unwrapped.type === "Identifier") return unwrapped.name;
	if (unwrapped.type !== "MemberExpression") return undefined;

	const objectPath = getNodePath(unwrapped.object);
	if (objectPath === undefined || objectPath.length === 0) return undefined;

	const propertyName = getMemberPropertyName(unwrapped);
	if (propertyName === undefined || propertyName.length === 0) return undefined;

	return `${objectPath}.${propertyName}`;
}

function isConfiguredLoopExitCall(callExpression: ESTree.CallExpression, loopExitCalls: ReadonlySet<string>): boolean {
	if (loopExitCalls.size === 0) return false;

	const calleePath = getNodePath(callExpression.callee);
	if (calleePath === undefined || calleePath.length === 0) return false;

	return loopExitCalls.has(calleePath);
}

function expressionOrSpreadContainsConfiguredLoopExit(
	node: ESTree.Expression | ESTree.SpreadElement,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return expressionContainsConfiguredLoopExit(node.type === "SpreadElement" ? node.argument : node, loopExitCalls);
}

function expressionContainsConfiguredLoopExit(
	expression: ESTree.Expression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (loopExitCalls.size === 0) return false;
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case "ArrayExpression":
			return arrayExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "ArrowFunctionExpression":
		case "ClassExpression":
		case "FunctionExpression":
			return false;

		case "AssignmentExpression":
			return expressionContainsConfiguredLoopExit(unwrapped.right, loopExitCalls);

		case "AwaitExpression":
			return expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls);

		case "BinaryExpression":
			return binaryExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "CallExpression":
			return callExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "ConditionalExpression":
			return conditionalContainsLoopExit(unwrapped, loopExitCalls);

		case "LogicalExpression":
			return logicalExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "MemberExpression":
			return memberExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "NewExpression":
			return newExpressionContainsConfiguredLoopExit(unwrapped, loopExitCalls);

		case "SequenceExpression":
			return unwrapped.expressions.some((part) => expressionContainsConfiguredLoopExit(part, loopExitCalls));

		case "TaggedTemplateExpression":
			return taggedTemplateContainsLoopExit(unwrapped, loopExitCalls);

		case "TemplateLiteral":
			return unwrapped.expressions.some((part) => expressionContainsConfiguredLoopExit(part, loopExitCalls));

		case "UnaryExpression":
		case "UpdateExpression":
			return expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls);

		case "YieldExpression":
			return unwrapped.argument ? expressionContainsConfiguredLoopExit(unwrapped.argument, loopExitCalls) : false;

		default:
			return false;
	}
}

function arrayExpressionContainsConfiguredLoopExit(
	expression: ESTree.ArrayExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	for (const element of expression.elements) {
		if (element === null) continue;
		if (expressionOrSpreadContainsConfiguredLoopExit(element, loopExitCalls)) return true;
	}

	return false;
}

function binaryExpressionContainsConfiguredLoopExit(
	expression: ESTree.BinaryExpression | ESTree.PrivateInExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	const { left } = expression;
	if (left.type !== "PrivateIdentifier" && expressionContainsConfiguredLoopExit(left, loopExitCalls)) return true;
	return expressionContainsConfiguredLoopExit(expression.right, loopExitCalls);
}

function callExpressionContainsConfiguredLoopExit(
	expression: ESTree.CallExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (isConfiguredLoopExitCall(expression, loopExitCalls)) return true;
	if (expressionContainsConfiguredLoopExit(expression.callee, loopExitCalls)) return true;
	return expression.arguments.some((argument) =>
		expressionOrSpreadContainsConfiguredLoopExit(argument, loopExitCalls),
	);
}

function conditionalContainsLoopExit(
	expression: ESTree.ConditionalExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return (
		expressionContainsConfiguredLoopExit(expression.test, loopExitCalls) ||
		expressionContainsConfiguredLoopExit(expression.consequent, loopExitCalls) ||
		expressionContainsConfiguredLoopExit(expression.alternate, loopExitCalls)
	);
}

function logicalExpressionContainsConfiguredLoopExit(
	expression: ESTree.LogicalExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	return (
		expressionContainsConfiguredLoopExit(expression.left, loopExitCalls) ||
		expressionContainsConfiguredLoopExit(expression.right, loopExitCalls)
	);
}

function memberExpressionContainsConfiguredLoopExit(
	expression: ESTree.MemberExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(expression.object, loopExitCalls)) return true;
	return expression.computed && expressionContainsConfiguredLoopExit(expression.property, loopExitCalls);
}

function newExpressionContainsConfiguredLoopExit(
	expression: ESTree.NewExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(expression.callee, loopExitCalls)) return true;
	return expression.arguments.some((argument) =>
		expressionOrSpreadContainsConfiguredLoopExit(argument, loopExitCalls),
	);
}

function taggedTemplateContainsLoopExit(
	expression: ESTree.TaggedTemplateExpression,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (expressionContainsConfiguredLoopExit(expression.tag, loopExitCalls)) return true;
	return expression.quasi.expressions.some((part) => expressionContainsConfiguredLoopExit(part, loopExitCalls));
}

function getConstantValue(expression: ESTree.Expression): ConstantValueResult {
	const unwrapped = unwrapExpression(expression);

	switch (unwrapped.type) {
		case "ArrayExpression":
			return toConstantValue(new Array<unknown>());

		case "ArrowFunctionExpression":
		case "ClassExpression":
		case "FunctionExpression":
			return toConstantValue(true);

		case "Identifier": {
			if (unwrapped.name === "undefined") return toConstantValue(undefined);
			if (unwrapped.name === "NaN") return toConstantValue(Number.NaN);
			if (unwrapped.name === "Infinity") return toConstantValue(Number.POSITIVE_INFINITY);
			return toNonConstantValue();
		}

		case "Literal":
			return toConstantValue(unwrapped.value);

		case "LogicalExpression":
			return getLogicalConstantValue(unwrapped);

		case "ObjectExpression":
			return toConstantValue({});

		case "SequenceExpression": {
			const lastExpression = unwrapped.expressions.at(-1);
			if (!lastExpression) return toNonConstantValue();
			return getConstantValue(lastExpression);
		}

		case "TemplateLiteral": {
			if (unwrapped.expressions.length > 0) return toNonConstantValue();
			if (unwrapped.quasis.length === 0) return toConstantValue("");
			return toConstantValue(unwrapped.quasis[0]?.value.cooked ?? "");
		}

		case "UnaryExpression":
			return getUnaryConstantValue(unwrapped);

		default:
			return toNonConstantValue();
	}
}

function getLogicalConstantValue(expression: ESTree.LogicalExpression): ConstantValueResult {
	const left = getConstantValue(expression.left);
	if (!left.constant) return toNonConstantValue();

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
	if (!argument.constant) return toNonConstantValue();

	// oxlint-disable-next-line typescript/strict-boolean-expressions -- really dumb
	if (expression.operator === "!") return toConstantValue(!argument.value);
	if (expression.operator === "+" && isNumberRaw(argument.value)) return toConstantValue(argument.value);
	if (expression.operator === "-" && isNumberRaw(argument.value)) return toConstantValue(-argument.value);
	if (expression.operator === "~" && isNumberRaw(argument.value)) return toConstantValue(~argument.value);
	return toNonConstantValue();
}

function getConstantBoolean(expression: ESTree.Expression): ConstantBooleanResult {
	const unwrapped = unwrapExpression(expression);

	if (unwrapped.type === "ConditionalExpression") {
		return getConditionalConstantBoolean(unwrapped);
	}

	if (unwrapped.type === "LogicalExpression") {
		return getLogicalConstantBoolean(unwrapped);
	}

	if (unwrapped.type === "SequenceExpression") {
		const lastExpression = unwrapped.expressions.at(-1);
		if (!lastExpression) return toNonConstantBoolean();
		return getConstantBoolean(lastExpression);
	}

	const value = getConstantValue(unwrapped);
	if (!value.constant) return toNonConstantBoolean();
	return toConstantBoolean(Boolean(value.value));
}

function getConditionalConstantBoolean(expression: ESTree.ConditionalExpression): ConstantBooleanResult {
	const test = getConstantBoolean(expression.test);
	if (test.constant) return getConstantBoolean(test.value === true ? expression.consequent : expression.alternate);

	const consequent = getConstantBoolean(expression.consequent);
	const alternate = getConstantBoolean(expression.alternate);
	if (consequent.constant && alternate.constant && consequent.value === alternate.value) return consequent;
	return toNonConstantBoolean();
}

function getLogicalConstantBoolean(expression: ESTree.LogicalExpression): ConstantBooleanResult {
	const left = getConstantBoolean(expression.left);
	if (!left.constant) return toNonConstantBoolean();

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
	if (!leftValue.constant) return toNonConstantBoolean();
	if (leftValue.value !== undefined) return toConstantBoolean(Boolean(leftValue.value));
	return getConstantBoolean(expression.right);
}

type LoopNode =
	| ESTree.DoWhileStatement
	| ESTree.ForInStatement
	| ESTree.ForOfStatement
	| ESTree.ForStatement
	| ESTree.WhileStatement;

const LOOP_TYPES = new Set(["DoWhileStatement", "ForInStatement", "ForOfStatement", "ForStatement", "WhileStatement"]);
function isLoopNode(node: ESTree.Node): node is LoopNode {
	return LOOP_TYPES.has(node.type);
}

const FUNCTION_BOUNDARY_TYPES = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);
function isFunctionBoundary(node: ESTree.Node): boolean {
	return FUNCTION_BOUNDARY_TYPES.has(node.type);
}

function findLabeledStatementBody(labelName: string, startingNode: ESTree.Node): ESTree.Statement | undefined {
	let current: ESTree.Node | null = startingNode;

	while (current !== null) {
		if (current.type === "LabeledStatement" && current.label.name === labelName) return current.body;
		if (current.type === "Program") return undefined;
		current = current.parent;
	}

	return undefined;
}

function breaksTargetLoop(statement: ESTree.BreakStatement, loopNode: LoopNode): boolean {
	if (statement.label) {
		const target = findLabeledStatementBody(statement.label.name, statement.parent);
		return target === loopNode;
	}

	let current: ESTree.Node | null = statement.parent;

	while (current !== null) {
		if (current.type === "Program" || isFunctionBoundary(current) || current.type === "SwitchStatement") {
			return false;
		}
		if (isLoopNode(current)) return current === loopNode;
		current = current.parent;
	}

	return false;
}

function forStatementInitContainsConfiguredLoopExit(
	initialization: ESTree.ForStatement["init"],
	loopExitCalls: ReadonlySet<string>,
): boolean {
	if (!initialization) return false;

	if (initialization.type === "VariableDeclaration") {
		return initialization.declarations.some((declaration) =>
			declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
		);
	}

	return expressionContainsConfiguredLoopExit(initialization, loopExitCalls);
}

function loopHeaderContainsConfiguredLoopExit(loopNode: LoopNode, loopExitCalls: ReadonlySet<string>): boolean {
	switch (loopNode.type) {
		case "DoWhileStatement":
		case "WhileStatement":
			return expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls);

		case "ForInStatement":
		case "ForOfStatement":
			return expressionContainsConfiguredLoopExit(loopNode.right, loopExitCalls);

		case "ForStatement": {
			if (forStatementInitContainsConfiguredLoopExit(loopNode.init, loopExitCalls)) return true;
			if (loopNode.test && expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls)) return true;
			if (loopNode.update && expressionContainsConfiguredLoopExit(loopNode.update, loopExitCalls)) return true;
			return false;
		}

		default:
			return false;
	}
}

function statementContainsLoopExit(
	statement: ESTree.Statement,
	loopNode: LoopNode,
	loopExitCalls: ReadonlySet<string>,
): boolean {
	switch (statement.type) {
		case "BlockStatement": {
			return statement.body.some((bodyStatement) =>
				statementContainsLoopExit(bodyStatement, loopNode, loopExitCalls),
			);
		}

		case "BreakStatement":
			return breaksTargetLoop(statement, loopNode);

		case "DoWhileStatement":
		case "WhileStatement":
			return loopStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case "ExpressionStatement":
			return expressionContainsConfiguredLoopExit(statement.expression, loopExitCalls);

		case "ForInStatement":
		case "ForOfStatement":
			return forEachStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case "ForStatement":
			return forStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case "IfStatement":
			return ifStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case "LabeledStatement":
			return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);

		case "ReturnStatement":
			return true;

		case "SwitchStatement": {
			return statement.cases.some((switchCase) =>
				switchCase.consequent.some((consequent) =>
					statementContainsLoopExit(consequent, loopNode, loopExitCalls),
				),
			);
		}

		case "TryStatement":
			return tryStatementContainsLoopExit(statement, loopNode, loopExitCalls);

		case "VariableDeclaration": {
			return statement.declarations.some((declaration) =>
				declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
			);
		}

		case "WithStatement":
			return withStatementContainsLoopExit(statement, loopNode, loopExitCalls);

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
	if (forStatementInitContainsConfiguredLoopExit(statement.init, loopExitCalls)) return true;
	if (statement.test && expressionContainsConfiguredLoopExit(statement.test, loopExitCalls)) return true;
	if (statement.update && expressionContainsConfiguredLoopExit(statement.update, loopExitCalls)) return true;
	return statementContainsLoopExit(statement.body, loopNode, loopExitCalls);
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
	if (statementContainsLoopExit(statement.block, loopNode, loopExitCalls)) return true;
	if (statement.handler && statementContainsLoopExit(statement.handler.body, loopNode, loopExitCalls)) return true;
	if (statement.finalizer && statementContainsLoopExit(statement.finalizer, loopNode, loopExitCalls)) return true;
	return false;
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

const noConstantConditionWithBreak = defineRule({
	create(context): Visitor {
		const rawOptions = context.options?.[0];
		const loopExitCalls = normalizeLoopExitCalls(
			typeof rawOptions === "object" && rawOptions !== null
				? (rawOptions as NoConstantConditionWithBreakOptions)
				: undefined,
		);

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
