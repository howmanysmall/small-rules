import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, InferContextFromRule, SourceCode, Visitor } from "oxlint-plugin-utilities";

type QueryType = "get" | "has";
type Context = InferContextFromRule<typeof preferSingleWorldQuery>;

interface WorldQueryCall {
	readonly componentNode: ESTree.Expression;
	readonly entityNode: ESTree.Expression;
	readonly node: ESTree.CallExpression;
	readonly queryType: QueryType;
	readonly variableDeclaration: ESTree.VariableDeclaration;
	readonly variableDeclarator: ESTree.VariableDeclarator;
	readonly variableName: string;
	readonly worldNode: ESTree.Expression;
}

function isLengthOfTwo<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue, TValue] {
	return array.length === 2;
}

function isStaticMemberExpression(node: ESTree.Expression): node is ESTree.StaticMemberExpression {
	return node.type === "MemberExpression" && !node.computed;
}

function isWorldQueryCall(node: ESTree.Node, queryType: QueryType): node is ESTree.CallExpression {
	if (node.type !== "CallExpression") return false;

	const { callee } = node;
	if (!isStaticMemberExpression(callee) || callee.property.name !== queryType || !isLengthOfTwo(node.arguments)) {
		return false;
	}

	const [entity, component] = node.arguments;
	return entity.type !== "SpreadElement" && component.type !== "SpreadElement";
}

function extractWorldQueryCall(node: ESTree.VariableDeclaration, queryType: QueryType): undefined | WorldQueryCall {
	if (node.declarations.length !== 1) return undefined;

	const [declarator] = node.declarations;
	if (declarator === undefined) return undefined;

	const { id, init } = declarator;
	if (id.type !== "Identifier" || init === null || !isWorldQueryCall(init, queryType)) return undefined;

	const { callee } = init;
	if (!isStaticMemberExpression(callee)) return undefined;

	const [entityNode, componentNode] = init.arguments;
	if (
		entityNode === undefined ||
		componentNode === undefined ||
		entityNode.type === "SpreadElement" ||
		componentNode.type === "SpreadElement"
	) {
		return undefined;
	}

	return {
		componentNode,
		entityNode,
		node: init,
		queryType,
		variableDeclaration: node,
		variableDeclarator: declarator,
		variableName: id.name,
		worldNode: callee.object,
	};
}

const VALID_PARENT_TYPES = new Set<string>([
	"ConditionalExpression",
	"DoWhileStatement",
	"ForStatement",
	"IfStatement",
	"WhileStatement",
]);

function isNodeWithParent(value: unknown): value is { readonly parent: unknown } {
	return isRecord(value) && "parent" in value;
}

function getNodeType(value: unknown): string | undefined {
	return isRecord(value) && typeof value.type === "string" ? value.type : undefined;
}

function getOperator(value: unknown): string | undefined {
	return isRecord(value) && typeof value.operator === "string" ? value.operator : undefined;
}

function isLogicalAndExpression(value: unknown): boolean {
	return getNodeType(value) === "LogicalExpression" && getOperator(value) === "&&";
}

function isIdentifierReference(value: unknown): value is ESTree.IdentifierReference {
	return isRecord(value) && value.type === "Identifier" && typeof value.name === "string";
}

function isIdentifierDirectlyInAndExpression(identifier: ESTree.IdentifierReference): boolean {
	const { parent } = identifier;
	if (isLogicalAndExpression(parent)) return true;

	const parentType = getNodeType(parent);
	if (parentType === undefined || !VALID_PARENT_TYPES.has(parentType)) return false;

	let current: unknown = identifier;
	while (current !== undefined && current !== parent) {
		if (!isNodeWithParent(current)) break;
		const currentParent = current.parent;
		if (isLogicalAndExpression(currentParent)) return true;
		current = currentParent;
	}

	return false;
}

function isReadReferenceInAndExpression(reference: ScopeVariable["references"][number]): boolean {
	if (reference.isWrite()) return false;
	const { identifier } = reference;
	if (!isIdentifierReference(identifier)) return false;
	return isIdentifierDirectlyInAndExpression(identifier);
}

function checkVariableUsedInAndExpression(
	variableName: string,
	variableDeclaration: ESTree.VariableDeclaration,
	sourceCode: SourceCode,
): boolean {
	const scope = sourceCode.getScope(variableDeclaration);
	const variable = getVariableByName(scope, variableName);
	return variable?.references.some(isReadReferenceInAndExpression) ?? false;
}

function areAllVariablesUsedInAndExpressions(calls: ReadonlyArray<WorldQueryCall>, sourceCode: SourceCode): boolean {
	return calls.every((call) =>
		checkVariableUsedInAndExpression(call.variableName, call.variableDeclaration, sourceCode),
	);
}

const ONLY_WHITESPACE_SEMICOLON = /^[\s;]*$/u;

function callsAreConsecutive(
	previousCall: undefined | WorldQueryCall,
	currentCall: WorldQueryCall,
	sourceCode: SourceCode,
): boolean {
	if (previousCall === undefined) return true;

	const previousWorld = sourceCode.getText(previousCall.worldNode);
	const currentWorld = sourceCode.getText(currentCall.worldNode);
	if (previousWorld !== currentWorld) return false;

	const previousEntity = sourceCode.getText(previousCall.entityNode);
	const currentEntity = sourceCode.getText(currentCall.entityNode);
	if (previousEntity !== currentEntity || previousCall.queryType !== currentCall.queryType) return false;

	const [, previousEnd] = previousCall.variableDeclaration.range;
	const [currentStart] = currentCall.variableDeclaration.range;
	const textBetween = sourceCode.text.slice(previousEnd, currentStart);
	return ONLY_WHITESPACE_SEMICOLON.test(textBetween);
}

function processGetCalls(calls: ReadonlyArray<WorldQueryCall>, context: Context): void {
	if (calls.length < 2) return;

	const [firstCall] = calls;
	if (firstCall === undefined) return;

	const { sourceCode } = context;
	const worldText = sourceCode.getText(firstCall.worldNode);
	const entityText = sourceCode.getText(firstCall.entityNode);

	const variableNames = calls.map((call) => call.variableName);
	const componentTexts = calls.map((call) => sourceCode.getText(call.componentNode));

	const destructuring = variableNames.length === 1 ? variableNames[0] : `[${variableNames.join(", ")}]`;
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const ${destructuring} = ${worldText}.get(${entityText}, ${componentArguments});`;

	reportCombinedQuery(calls, context, fixedCode, "preferSingleGet", firstCall);
}

function reportCombinedQuery(
	calls: ReadonlyArray<WorldQueryCall>,
	context: Context,
	fixedCode: string,
	messageId: "preferSingleGet" | "preferSingleHas",
	firstCall: WorldQueryCall,
): void {
	const firstDeclaration = calls.at(0)?.variableDeclaration;
	const lastDeclaration = calls.at(-1)?.variableDeclaration;
	if (firstDeclaration === undefined || lastDeclaration === undefined) return;
	context.report({
		data: { fixedCode },
		fix(fixer) {
			const [rangeStart] = firstDeclaration.range;
			const [, rangeEnd] = lastDeclaration.range;
			return fixer.replaceTextRange([rangeStart, rangeEnd], fixedCode);
		},
		messageId,
		node: firstCall.node,
	});
}

function processHasCalls(calls: ReadonlyArray<WorldQueryCall>, context: Context): void {
	if (calls.length < 2) return;

	const { sourceCode } = context;
	if (!areAllVariablesUsedInAndExpressions(calls, sourceCode)) return;

	const [firstCall] = calls;
	if (firstCall === undefined) return;

	const worldText = sourceCode.getText(firstCall.worldNode);
	const entityText = sourceCode.getText(firstCall.entityNode);
	const componentTexts = calls.map((call) => sourceCode.getText(call.componentNode));
	const componentArguments = componentTexts.join(", ");
	const fixedCode = `const hasAll = ${worldText}.has(${entityText}, ${componentArguments});`;
	reportCombinedQuery(calls, context, fixedCode, "preferSingleHas", firstCall);
}

const preferSingleWorldQuery = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		let currentGetBuffer = new Array<WorldQueryCall>();
		let currentHasBuffer = new Array<WorldQueryCall>();

		function flushGetBuffer(): void {
			if (currentGetBuffer.length >= 2) processGetCalls(currentGetBuffer, context);
			currentGetBuffer = [];
		}

		function flushHasBuffer(): void {
			if (currentHasBuffer.length >= 2) processHasCalls(currentHasBuffer, context);
			currentHasBuffer = [];
		}

		function flushAllBuffers(): void {
			flushGetBuffer();
			flushHasBuffer();
		}

		return {
			":statement:not(VariableDeclaration[kind='const'])": flushAllBuffers,
			"Program:exit": flushAllBuffers,
			"VariableDeclaration[kind='const']"(node: ESTree.VariableDeclaration): void {
				const getCall = extractWorldQueryCall(node, "get");
				if (getCall !== undefined) {
					const lastCall = currentGetBuffer.at(-1);
					if (lastCall !== undefined && !callsAreConsecutive(lastCall, getCall, sourceCode)) flushGetBuffer();
					currentGetBuffer.push(getCall);

					flushHasBuffer();
					return;
				}

				const hasCall = extractWorldQueryCall(node, "has");
				if (hasCall !== undefined) {
					const lastCall = currentHasBuffer.at(-1);
					if (lastCall !== undefined && !callsAreConsecutive(lastCall, hasCall, sourceCode)) flushHasBuffer();
					currentHasBuffer.push(hasCall);

					flushGetBuffer();
					return;
				}

				flushAllBuffers();
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Enforce combining multiple world.get() or world.has() calls into a single call for better Jecs performance.",
		},
		fixable: "code",
		messages: {
			preferSingleGet:
				"Multiple world.get() calls on the same entity should be combined into a single call for better performance. Suggested fix: {{fixedCode}}",
			preferSingleHas:
				"Multiple world.has() calls on the same entity should be combined into a single call for better performance. Suggested fix: {{fixedCode}}",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferSingleWorldQuery;
