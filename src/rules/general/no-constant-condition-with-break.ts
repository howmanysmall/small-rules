import { getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isAnyFunction } from "$oxc-utilities/oxc-utilities";
import { isNonEmptyString, isNumberRaw, isRecord } from "$oxc-utilities/type-utilities";

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

type LoopNode =
	| ESTree.DoWhileStatement
	| ESTree.ForInStatement
	| ESTree.ForOfStatement
	| ESTree.ForStatement
	| ESTree.WhileStatement;

const NON_CONSTANT_VALUE: ConstantValueResult = { constant: false };
const NON_CONSTANT_BOOLEAN: ConstantBooleanResult = { constant: false };

function toConstantValue(value: unknown): ConstantValueResult {
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

	if (unwrapped.type === "Identifier") return unwrapped.name;
	if (unwrapped.type !== "MemberExpression") return undefined;

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
		if (element !== null) pending.push(element.type === "SpreadElement" ? element.argument : element);
	}
}

function addCallArgumentsToPending(
	arguments_: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
	pending: Array<ESTree.Expression>,
): void {
	for (const argument of arguments_) {
		pending.push(argument.type === "SpreadElement" ? argument.argument : argument);
	}
}

function addExpressionChildrenToPending(expression: ESTree.Expression, pending: Array<ESTree.Expression>): void {
	switch (expression.type) {
		case "ArrayExpression": {
			addArrayElementsToPending(expression, pending);
			break;
		}

		case "AssignmentExpression": {
			pending.push(expression.right);
			break;
		}

		case "AwaitExpression":
		case "UnaryExpression":
		case "UpdateExpression": {
			pending.push(expression.argument);
			break;
		}

		case "BinaryExpression": {
			if (expression.left.type !== "PrivateIdentifier") pending.push(expression.left);
			pending.push(expression.right);
			break;
		}

		case "CallExpression":
		case "NewExpression": {
			pending.push(expression.callee);
			addCallArgumentsToPending(expression.arguments, pending);
			break;
		}

		case "ConditionalExpression": {
			pending.push(expression.test, expression.consequent, expression.alternate);
			break;
		}

		case "LogicalExpression": {
			pending.push(expression.left, expression.right);
			break;
		}

		case "MemberExpression": {
			pending.push(expression.object);
			if (expression.computed) pending.push(expression.property);
			break;
		}

		case "SequenceExpression":
		case "TemplateLiteral": {
			pending.push(...expression.expressions);
			break;
		}

		case "TaggedTemplateExpression": {
			pending.push(expression.tag, ...expression.quasi.expressions);
			break;
		}

		case "YieldExpression": {
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
		case "ArrayExpression":
			return toConstantValue([]);

		case "ArrowFunctionExpression":
		case "ClassExpression":
		case "FunctionExpression":
			return toConstantValue(true);

		case "Identifier": {
			if (unwrapped.name === "undefined") return toConstantValue(undefined);
			if (unwrapped.name === "NaN") return toConstantValue(Number.NaN);
			if (unwrapped.name === "Infinity") return toConstantValue(Number.POSITIVE_INFINITY);
			return NON_CONSTANT_VALUE;
		}

		case "Literal":
			return toConstantValue(unwrapped.value);

		case "LogicalExpression":
			return getLogicalConstantValue(unwrapped);

		case "ObjectExpression":
			return toConstantValue({});

		case "TemplateLiteral": {
			if (unwrapped.expressions.length > 0) return NON_CONSTANT_VALUE;
			/* v8 ignore next -- @preserve parsers keep at least one quasi for template literals. */
			if (unwrapped.quasis.length === 0) return toConstantValue("");
			/* v8 ignore next -- @preserve untagged template literal cooked values are strings in parser output. */
			return toConstantValue(unwrapped.quasis[0]?.value.cooked ?? "");
		}

		case "UnaryExpression":
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
	if (expression.operator === "+" && isNumberRaw(argument.value)) return toConstantValue(argument.value);
	if (expression.operator === "-" && isNumberRaw(argument.value)) return toConstantValue(-argument.value);
	if (expression.operator === "~" && isNumberRaw(argument.value)) return toConstantValue(~argument.value);
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

const LOOP_TYPES = new Set(["DoWhileStatement", "ForInStatement", "ForOfStatement", "ForStatement", "WhileStatement"]);
function isLoopNode(node: ESTree.Node): node is LoopNode {
	return LOOP_TYPES.has(node.type);
}

function findLabeledStatementBody(labelName: string, startingNode: ESTree.Node): ESTree.Statement | undefined {
	let current: ESTree.Node | null = startingNode;

	// oxlint-disable-next-line typescript/no-unnecessary-condition -- conflicting rules
	while (current !== null) {
		if (current.type === "LabeledStatement" && current.label.name === labelName) return current.body;
		/* v8 ignore next -- @preserve valid break labels must resolve before Program is reached. */
		if (current.type === "Program") return undefined;
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
		if (current.type === "Program" || isAnyFunction(current) || current.type === "SwitchStatement") {
			return false;
		}
		if (isLoopNode(current)) return current === loopNode;
		current = current.parent;
	}

	/* v8 ignore next -- @preserve parent traversal reaches Program before null in parser-produced ASTs. */
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
	/* v8 ignore next -- @preserve caller loop-node narrowing restricts this switch to handled loop types. */
	switch (loopNode.type) {
		case "DoWhileStatement":
		case "WhileStatement":
			return expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls);

		/* v8 ignore start -- @preserve constant-condition visitors never pass for-in or for-of nodes here. */
		case "ForInStatement":
		case "ForOfStatement":
			return expressionContainsConfiguredLoopExit(loopNode.right, loopExitCalls);
		/* v8 ignore stop -- @preserve */

		case "ForStatement": {
			if (forStatementInitContainsConfiguredLoopExit(loopNode.init, loopExitCalls)) return true;
			if (loopNode.test && expressionContainsConfiguredLoopExit(loopNode.test, loopExitCalls)) return true;
			if (loopNode.update && expressionContainsConfiguredLoopExit(loopNode.update, loopExitCalls)) return true;
			return false;
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
	while (currentStatement.type === "LabeledStatement") currentStatement = currentStatement.body;

	switch (currentStatement.type) {
		case "BlockStatement": {
			return currentStatement.body.some((bodyStatement) =>
				statementContainsLoopExit(bodyStatement, loopNode, loopExitCalls),
			);
		}

		case "BreakStatement":
			return breaksTargetLoop(currentStatement, loopNode);

		case "DoWhileStatement":
		case "WhileStatement":
			return loopStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case "ExpressionStatement":
			return expressionContainsConfiguredLoopExit(currentStatement.expression, loopExitCalls);

		case "ForInStatement":
		case "ForOfStatement":
			return forEachStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case "ForStatement":
			return forStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case "IfStatement":
			return ifStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case "ReturnStatement":
			return true;

		case "SwitchStatement": {
			return currentStatement.cases.some((switchCase) =>
				switchCase.consequent.some((consequent) =>
					statementContainsLoopExit(consequent, loopNode, loopExitCalls),
				),
			);
		}

		case "TryStatement":
			return tryStatementContainsLoopExit(currentStatement, loopNode, loopExitCalls);

		case "VariableDeclaration": {
			return currentStatement.declarations.some((declaration) =>
				declaration.init ? expressionContainsConfiguredLoopExit(declaration.init, loopExitCalls) : false,
			);
		}

		case "WithStatement":
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

const noConstantConditionWithBreak = createRule("no-constant-condition-with-break", "general", {
	create(context): Visitor {
		// oxlint-disable-next-line typescript/no-unnecessary-condition -- safety!
		const rawOptions = context.options?.[0];
		const loopExitCalls = normalizeLoopExitCalls(isRecord(rawOptions) ? rawOptions : undefined);

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
