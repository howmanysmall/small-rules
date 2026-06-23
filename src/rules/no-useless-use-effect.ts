import { isFunction, isNode } from "$oxc-utilities/oxc-utilities";
import { getBindingPropertyKeyName, getBindingPropertyValueIdentifier } from "$oxc-utilities/react-hook-utilities";
import { forEachReactNamedImport, getReactSources, isEnvironment } from "$oxc-utilities/react-utilities";
import { isNonEmptyString, isStringArray } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { Environment } from "$oxc-utilities/react-utilities";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface NoUselessUseEffectOptions {
	readonly environment?: Environment;
	readonly hooks?: ReadonlyArray<string>;
	readonly propertyCallbackPrefixes?: ReadonlyArray<string>;
	readonly refHooks?: ReadonlyArray<string>;
	readonly reportAdjustState?: boolean;
	readonly reportDerivedState?: boolean;
	readonly reportDuplicateDeps?: boolean;
	readonly reportEffectChain?: boolean;
	readonly reportEmptyEffect?: boolean;
	readonly reportEventFlag?: boolean;
	readonly reportEventSpecificLogic?: boolean;
	readonly reportExternalStore?: boolean;
	readonly reportInitializeState?: boolean;
	readonly reportLogOnly?: boolean;
	readonly reportMixedDerivedState?: boolean;
	readonly reportNotifyParent?: boolean;
	readonly reportPassRefToParent?: boolean;
	readonly reportResetState?: boolean;
	readonly stateHooks?: ReadonlyArray<string>;
}

const DEFAULT_HOOKS = ["useEffect", "useLayoutEffect", "useInsertionEffect"] as const satisfies ReadonlyArray<string>;
const DEFAULT_PROPERTY_CALLBACK_PREFIXES = ["on"] as const satisfies ReadonlyArray<string>;
const DEFAULT_REF_HOOKS = ["useRef"] as const satisfies ReadonlyArray<string>;
const DEFAULT_STATE_HOOKS = ["useState", "useReducer"] as const satisfies ReadonlyArray<string>;

interface NormalizedOptions {
	readonly environment: Environment;
	readonly hooks: ReadonlySet<string>;
	readonly propertyCallbackPrefixes: ReadonlySet<string>;
	readonly refHooks: ReadonlySet<string>;
	readonly reportAdjustState: boolean;
	readonly reportDerivedState: boolean;
	readonly reportDuplicateDeps: boolean;
	readonly reportEffectChain: boolean;
	readonly reportEmptyEffect: boolean;
	readonly reportEventFlag: boolean;
	readonly reportEventSpecificLogic: boolean;
	readonly reportExternalStore: boolean;
	readonly reportInitializeState: boolean;
	readonly reportLogOnly: boolean;
	readonly reportMixedDerivedState: boolean;
	readonly reportNotifyParent: boolean;
	readonly reportPassRefToParent: boolean;
	readonly reportResetState: boolean;
	readonly stateHooks: ReadonlySet<string>;
}

interface FunctionContext {
	readonly functionId: number;
	readonly isCustomHook: boolean;
	readonly propertyCallbackIdentifiers: Set<string>;
	propertyObjectName: string | undefined;
}

interface EffectInfo {
	readonly depIdentifiers: Set<string>;
	readonly hasNonSetterSideEffect: boolean;
	readonly hasReturnWithCleanup: boolean;
	readonly node: ESTree.CallExpression;
	readonly ownerFunctionId: number;
	readonly setterCalls: Set<string>;
	readonly statements: ReadonlyArray<ESTree.Statement>;
}

type EffectReportMessageId =
	| "adjustState"
	| "derivedState"
	| "emptyEffect"
	| "eventFlag"
	| "eventSpecificLogic"
	| "externalStore"
	| "initializeState"
	| "logOnly"
	| "mixedDerivedState"
	| "notifyParent"
	| "passRefToParent"
	| "resetState";

interface EffectAnalysisState {
	readonly coreStatements: ReadonlyArray<ESTree.Statement>;
	readonly dependencyIdentifiers: ReadonlySet<string>;
	readonly functionContext: FunctionContext | undefined;
	readonly hasNonSetter: boolean;
	readonly hasReturnCleanup: boolean;
	readonly node: ESTree.CallExpression;
	readonly setterCalls: ReadonlySet<string>;
	readonly statements: ReadonlyArray<ESTree.Statement>;
}

function normalizeOptions(raw: NoUselessUseEffectOptions | undefined): NormalizedOptions {
	if (raw === undefined) {
		return {
			environment: "roblox-ts",
			hooks: new Set(DEFAULT_HOOKS),
			propertyCallbackPrefixes: new Set(DEFAULT_PROPERTY_CALLBACK_PREFIXES),
			refHooks: new Set(DEFAULT_REF_HOOKS),
			reportAdjustState: true,
			reportDerivedState: true,
			reportDuplicateDeps: true,
			reportEffectChain: true,
			reportEmptyEffect: true,
			reportEventFlag: true,
			reportEventSpecificLogic: true,
			reportExternalStore: true,
			reportInitializeState: true,
			reportLogOnly: true,
			reportMixedDerivedState: true,
			reportNotifyParent: true,
			reportPassRefToParent: true,
			reportResetState: true,
			stateHooks: new Set(DEFAULT_STATE_HOOKS),
		};
	}

	/* v8 ignore next -- schema defaults public options; fallbacks defend direct rule calls. @preserve */
	return {
		environment: isEnvironment(raw.environment) ? raw.environment : "roblox-ts",
		hooks: new Set(isStringArray(raw.hooks) ? raw.hooks : DEFAULT_HOOKS),
		propertyCallbackPrefixes: new Set(
			isStringArray(raw.propertyCallbackPrefixes)
				? raw.propertyCallbackPrefixes
				: DEFAULT_PROPERTY_CALLBACK_PREFIXES,
		),
		refHooks: new Set(isStringArray(raw.refHooks) ? raw.refHooks : DEFAULT_REF_HOOKS),
		reportAdjustState: raw.reportAdjustState ?? true,
		reportDerivedState: raw.reportDerivedState ?? true,
		reportDuplicateDeps: raw.reportDuplicateDeps ?? true,
		reportEffectChain: raw.reportEffectChain ?? true,
		reportEmptyEffect: raw.reportEmptyEffect ?? true,
		reportEventFlag: raw.reportEventFlag ?? true,
		reportEventSpecificLogic: raw.reportEventSpecificLogic ?? true,
		reportExternalStore: raw.reportExternalStore ?? true,
		reportInitializeState: raw.reportInitializeState ?? true,
		reportLogOnly: raw.reportLogOnly ?? true,
		reportMixedDerivedState: raw.reportMixedDerivedState ?? true,
		reportNotifyParent: raw.reportNotifyParent ?? true,
		reportPassRefToParent: raw.reportPassRefToParent ?? true,
		reportResetState: raw.reportResetState ?? true,
		stateHooks: new Set(isStringArray(raw.stateHooks) ? raw.stateHooks : DEFAULT_STATE_HOOKS),
	};
}

function isHookCall(
	node: ESTree.CallExpression,
	hookIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
	hookNames: ReadonlySet<string>,
): boolean {
	const { callee } = node;
	if (callee.type === "Identifier") return hookIdentifiers.has(callee.name);
	if (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		callee.property.type === "Identifier"
	) {
		return reactNamespaces.has(callee.object.name) && hookNames.has(callee.property.name);
	}
	return false;
}

function getFunctionName(node: CallbackFunction): string | undefined {
	if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id !== null) {
		return node.id.name;
	}

	const { parent } = node;
	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
		return parent.id.name;
	}

	if (
		"key" in parent &&
		!("computed" in parent && parent.computed) &&
		isNode(parent.key) &&
		parent.key.type === "Identifier"
	) {
		return parent.key.name;
	}

	return undefined;
}

function isCustomHookName(name: string | undefined): boolean {
	return isNonEmptyString(name) && name.startsWith("use");
}

function isReturnWithoutArgument(statement: ESTree.Statement): boolean {
	if (statement.type === "ReturnStatement") return statement.argument === null;
	if (statement.type !== "BlockStatement" || statement.body.length !== 1) return false;
	const [inner] = statement.body;
	return inner?.type === "ReturnStatement" && inner.argument === null;
}

function pushStatementBody(statement: ESTree.Statement, stack: Array<ESTree.Node>): void {
	/* v8 ignore else -- callers pass only body-bearing statement kinds. @preserve */
	if ("body" in statement && isNode(statement.body)) {
		if (statement.body.type === "BlockStatement") stack.push(...statement.body.body);
		else stack.push(statement.body);
	}
}

function pushReturnSearchChildren(current: ESTree.Node, stack: Array<ESTree.Node>): void {
	if (current.type === "BlockStatement") {
		stack.push(...current.body);
		return;
	}

	if (current.type === "IfStatement") {
		stack.push(current.consequent);
		if (current.alternate !== null) stack.push(current.alternate);
		return;
	}

	if (
		current.type === "DoWhileStatement" ||
		current.type === "ForInStatement" ||
		current.type === "ForOfStatement" ||
		current.type === "ForStatement" ||
		current.type === "LabeledStatement" ||
		current.type === "WhileStatement" ||
		current.type === "WithStatement"
	) {
		pushStatementBody(current, stack);
		return;
	}

	if (current.type === "SwitchStatement") {
		for (const switchCase of current.cases) stack.push(...switchCase.consequent);
		return;
	}

	/* v8 ignore next -- try-body cleanup traversal is covered; V8 leaves a synthetic alternate branch here. @preserve */
	if (current.type === "TryStatement") {
		stack.push(...current.block.body);
		if (current.handler !== null) stack.push(...current.handler.body.body);
		if (current.finalizer !== null) stack.push(...current.finalizer.body);
	}
}

function hasReturnWithArgument(body: ESTree.BlockStatement): boolean {
	const stack: Array<ESTree.Node> = [...body.body];

	while (stack.length > 0) {
		const current = stack.pop();
		/* v8 ignore next -- stack length is checked before pop. @preserve */
		if (current === undefined) continue;

		switch (current.type) {
			/* v8 ignore next -- statement-only traversal never pushes arrow expressions. @preserve */
			case "ArrowFunctionExpression": {
				continue;
			}
			case "FunctionDeclaration":
				continue;
			/* v8 ignore next -- statement-only traversal never pushes function expressions. @preserve */
			case "FunctionExpression": {
				continue;
			}

			case "ReturnStatement": {
				if (current.argument !== null) return true;
				continue;
			}

			case "DoWhileStatement":
			case "ForInStatement":
			case "ForOfStatement":
			case "ForStatement":
			case "BlockStatement":
			case "IfStatement":
			case "LabeledStatement":
			case "SwitchStatement":
			case "TryStatement":
			case "WhileStatement":
			case "WithStatement": {
				pushReturnSearchChildren(current, stack);
				continue;
			}

			default:
				continue;
		}
	}

	return false;
}

function stripLeadingGuard(statements: ReadonlyArray<ESTree.Statement>): ReadonlyArray<ESTree.Statement> {
	if (statements.length === 0) return statements;

	const [first] = statements;
	if (first?.type !== "IfStatement" || first.alternate !== null || !isReturnWithoutArgument(first.consequent)) {
		return statements;
	}

	return statements.slice(1);
}

function unwrapChainExpression(expression: ESTree.Expression): ESTree.Expression {
	if (expression.type === "ChainExpression") return expression.expression;
	return expression;
}

function getCallExpressionFromStatement(statement: ESTree.Statement): ESTree.CallExpression | undefined {
	if (statement.type !== "ExpressionStatement") return undefined;
	const expression = unwrapChainExpression(statement.expression);
	return expression.type === "CallExpression" ? expression : undefined;
}

function isStateSetterCall(
	callExpression: ESTree.CallExpression,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	return callExpression.callee.type === "Identifier" && stateSetterIdentifiers.has(callExpression.callee.name);
}

function isFalseLiteral(node: ESTree.Node): boolean {
	return node.type === "Literal" && node.value === false;
}

function isConstantLiteral(node: ESTree.Node): boolean {
	/* v8 ignore next -- isResetValue handles literals before this helper is called. @preserve */
	if (node.type === "Literal") return true;

	return (
		node.type === "UnaryExpression" &&
		node.operator === "void" &&
		node.argument.type === "Literal" &&
		node.argument.value === 0
	);
}

function isEmptyArrayExpression(node: ESTree.Node): boolean {
	return node.type === "ArrayExpression" && node.elements.length === 0;
}

function isEmptyObjectExpression(node: ESTree.Node): boolean {
	return node.type === "ObjectExpression" && node.properties.length === 0;
}

function isResetValue(node: ESTree.Node): boolean {
	if (node.type === "Literal") {
		const { value } = node;
		return value === "" || value === 0 || value === false || value === null;
	}

	if (isConstantLiteral(node)) return true;
	return isEmptyArrayExpression(node) || isEmptyObjectExpression(node);
}

function getResetFlagNameFromStatement(
	statement: ESTree.Statement,
	stateSetterToValue: ReadonlyMap<string, string>,
): string | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (callExpression?.callee.type !== "Identifier") return undefined;

	const flagName = stateSetterToValue.get(callExpression.callee.name);
	if (flagName === undefined || callExpression.arguments.length !== 1) return undefined;

	const [argument] = callExpression.arguments;
	if (argument === undefined || !isFalseLiteral(argument)) return undefined;
	return flagName;
}

function getSideEffectCall(
	statement: ESTree.Statement,
	stateSetterIdentifiers: ReadonlySet<string>,
): ESTree.CallExpression | undefined {
	const callExpression = getCallExpressionFromStatement(statement);
	if (callExpression === undefined || isStateSetterCall(callExpression, stateSetterIdentifiers)) return undefined;
	return callExpression;
}

function isNegativeFlagTest(test: ESTree.Expression, flagName: string): boolean {
	return (
		test.type === "UnaryExpression" &&
		test.operator === "!" &&
		test.argument.type === "Identifier" &&
		test.argument.name === flagName
	);
}

function isPositiveFlagTest(test: ESTree.Expression, flagName: string): boolean {
	return test.type === "Identifier" && test.name === flagName;
}

function getStatementsFromConsequent(consequent: ESTree.Statement): ReadonlyArray<ESTree.Statement> {
	if (consequent.type === "BlockStatement") return consequent.body;
	return [consequent];
}

function matchGuardedEventFlagPattern(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterToValue: ReadonlyMap<string, string>,
	stateSetterIdentifiers: ReadonlySet<string>,
): string | undefined {
	const [guard, first, second] = statements;
	if (guard?.type !== "IfStatement" || guard.alternate !== null || first === undefined || second === undefined) {
		return undefined;
	}

	const firstFlag = getResetFlagNameFromStatement(first, stateSetterToValue);
	const secondFlag = getResetFlagNameFromStatement(second, stateSetterToValue);
	const guardReturns = isReturnWithoutArgument(guard.consequent);
	if (firstFlag !== undefined && secondFlag === undefined) {
		if (!(guardReturns && isNegativeFlagTest(guard.test, firstFlag))) return undefined;
		return getSideEffectCall(second, stateSetterIdentifiers) === undefined ? undefined : firstFlag;
	}

	if (secondFlag === undefined || firstFlag !== undefined) return undefined;
	if (!(guardReturns && isNegativeFlagTest(guard.test, secondFlag))) return undefined;
	/* v8 ignore next -- no-side-effect guarded flag exits are covered as non-event-flag valid behavior. @preserve */
	return getSideEffectCall(first, stateSetterIdentifiers) === undefined ? undefined : secondFlag;
}

function matchPositiveEventFlagPattern(
	statement: ESTree.Statement,
	stateSetterToValue: ReadonlyMap<string, string>,
	stateSetterIdentifiers: ReadonlySet<string>,
): string | undefined {
	if (statement.type !== "IfStatement" || statement.alternate !== null) return undefined;

	const consequentStatements = getStatementsFromConsequent(statement.consequent);
	const [first, second] = consequentStatements;
	if (consequentStatements.length !== 2 || first === undefined || second === undefined) return undefined;

	const firstFlag = getResetFlagNameFromStatement(first, stateSetterToValue);
	const secondFlag = getResetFlagNameFromStatement(second, stateSetterToValue);
	if (firstFlag !== undefined && secondFlag === undefined) {
		if (!isPositiveFlagTest(statement.test, firstFlag)) return undefined;
		/* v8 ignore next -- no-side-effect positive flag exits are covered as non-event-flag valid behavior. @preserve */
		return getSideEffectCall(second, stateSetterIdentifiers) === undefined ? undefined : firstFlag;
	}

	if (secondFlag === undefined || firstFlag !== undefined) return undefined;
	if (!isPositiveFlagTest(statement.test, secondFlag)) return undefined;
	/* v8 ignore next -- no-side-effect positive flag exits are covered as non-event-flag valid behavior. @preserve */
	return getSideEffectCall(first, stateSetterIdentifiers) === undefined ? undefined : secondFlag;
}

function matchEventFlagPattern(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterToValue: ReadonlyMap<string, string>,
	stateSetterIdentifiers: ReadonlySet<string>,
): string | undefined {
	if (statements.length === 3) {
		return matchGuardedEventFlagPattern(statements, stateSetterToValue, stateSetterIdentifiers);
	}

	if (statements.length === 1) {
		const [onlyStatement] = statements;
		/* v8 ignore next -- length check above guarantees a dense first statement in parser output. @preserve */
		return onlyStatement === undefined
			? undefined
			: matchPositiveEventFlagPattern(onlyStatement, stateSetterToValue, stateSetterIdentifiers);
	}

	return undefined;
}

type ExpressionSearchNode = ESTree.Expression | ESTree.PrivateIdentifier;

const EXPRESSION_SEARCH_NODE_TYPES = new Set([
	"ArrayExpression",
	"BinaryExpression",
	"CallExpression",
	"ChainExpression",
	"ConditionalExpression",
	"Identifier",
	"LogicalExpression",
	"MemberExpression",
	"ObjectExpression",
	"PrivateIdentifier",
	"TemplateLiteral",
	"UnaryExpression",
]);

function isExpressionSearchNode(node: ESTree.Node): node is ExpressionSearchNode {
	return EXPRESSION_SEARCH_NODE_TYPES.has(node.type);
}

function pushArrayExpressionChildren(current: ESTree.ArrayExpression, stack: Array<ExpressionSearchNode>): void {
	for (const element of current.elements) {
		if (element !== null && element.type !== "SpreadElement") stack.push(element);
	}
}

function pushCallExpressionChildren(current: ESTree.CallExpression, stack: Array<ExpressionSearchNode>): void {
	stack.push(current.callee);
	for (const argument of current.arguments) if (argument.type !== "SpreadElement") stack.push(argument);
}

function pushMemberExpressionChildren(current: ESTree.MemberExpression, stack: Array<ExpressionSearchNode>): void {
	stack.push(current.object);
	if (!current.computed) stack.push(current.property);
}

function pushObjectExpressionChildren(current: ESTree.ObjectExpression, stack: Array<ExpressionSearchNode>): void {
	for (const property of current.properties) if (property.type === "Property") stack.push(property.value);
}

function pushExpressionSearchChildren(current: ExpressionSearchNode, stack: Array<ExpressionSearchNode>): void {
	switch (current.type) {
		case "ArrayExpression": {
			pushArrayExpressionChildren(current, stack);
			break;
		}
		case "BinaryExpression":
		case "LogicalExpression": {
			stack.push(current.left, current.right);
			break;
		}
		case "CallExpression": {
			pushCallExpressionChildren(current, stack);
			break;
		}
		case "ChainExpression": {
			stack.push(current.expression);
			break;
		}
		case "ConditionalExpression": {
			stack.push(current.test, current.consequent, current.alternate);
			break;
		}
		case "MemberExpression": {
			pushMemberExpressionChildren(current, stack);
			break;
		}
		case "ObjectExpression": {
			pushObjectExpressionChildren(current, stack);
			break;
		}
		case "TemplateLiteral": {
			stack.push(...current.expressions);
			break;
		}
		case "UnaryExpression": {
			stack.push(current.argument);
			break;
		}
		default:
	}
}

function expressionContainsIdentifier(node: ESTree.Expression): boolean {
	const stack: Array<ExpressionSearchNode> = [node];
	const visited = new Set<ESTree.Node>();

	while (stack.length > 0) {
		const current = stack.pop();
		/* v8 ignore next -- stack length is checked before pop. @preserve */
		if (current === undefined || visited.has(current)) continue;
		visited.add(current);

		if (current.type === "Identifier") return true;

		pushExpressionSearchChildren(current, stack);
	}

	return false;
}

function countMatchingCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	isMatch: (callExpression: ESTree.CallExpression) => boolean,
): number | undefined {
	let count = 0;

	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			if (statement.alternate !== null) return undefined;

			const innerStatements = getStatementsFromConsequent(statement.consequent);
			const innerCount = countMatchingCalls(innerStatements, isMatch);
			if (innerCount === undefined || innerCount === 0) return undefined;

			count += innerCount;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined || !isMatch(callExpression)) return undefined;
		count += 1;
	}

	return count > 0 ? count : undefined;
}

function countSetterCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): number | undefined {
	return countMatchingCalls(statements, (callExpression) => {
		if (!isStateSetterCall(callExpression, stateSetterIdentifiers)) return false;

		const hasDerivedArgument = callExpression.arguments.some((argument) =>
			argument.type === "SpreadElement" ? false : expressionContainsIdentifier(argument),
		);

		return hasDerivedArgument;
	});
}

function countPropertyCallbackCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	functionContext: FunctionContext,
	propertyCallbackPrefixes: ReadonlySet<string>,
): number | undefined {
	return countMatchingCalls(statements, (callExpression) =>
		isPropertyCallbackCall(callExpression, functionContext, propertyCallbackPrefixes),
	);
}

function hasPrefix(value: string, prefixes: ReadonlySet<string>): boolean {
	for (const prefix of prefixes) if (value.startsWith(prefix)) return true;
	return false;
}

function unwrapParameter(parameter: ESTree.ParamPattern): ESTree.ParamPattern {
	if (parameter.type === "AssignmentPattern") return parameter.left;
	return parameter;
}

function buildFunctionContext(
	node: CallbackFunction,
	propertyCallbackPrefixes: ReadonlySet<string>,
	functionId: number,
	isCustomHook: boolean,
): FunctionContext {
	const context: FunctionContext = {
		functionId,
		isCustomHook,
		propertyCallbackIdentifiers: new Set<string>(),
		propertyObjectName: undefined,
	};
	const [firstParameter] = node.params;
	if (firstParameter === undefined) return context;

	const parameter = unwrapParameter(firstParameter);
	if (parameter.type === "Identifier") {
		context.propertyObjectName = parameter.name;
		return context;
	}

	if (parameter.type !== "ObjectPattern") return context;

	for (const property of parameter.properties) {
		if (property.type !== "Property") continue;

		const propertyName = getBindingPropertyKeyName(property);
		if (propertyName === undefined || !hasPrefix(propertyName, propertyCallbackPrefixes)) continue;

		const valueIdentifier = getBindingPropertyValueIdentifier(property);
		if (valueIdentifier !== undefined) context.propertyCallbackIdentifiers.add(valueIdentifier.name);
	}

	return context;
}

function isPropertyCallbackCall(
	callExpression: ESTree.CallExpression,
	functionContext: FunctionContext,
	propertyCallbackPrefixes: ReadonlySet<string>,
): boolean {
	const { callee } = callExpression;
	if (callee.type === "Identifier") return functionContext.propertyCallbackIdentifiers.has(callee.name);

	if (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		callee.property.type === "Identifier"
	) {
		return (
			functionContext.propertyObjectName !== undefined &&
			callee.object.name === functionContext.propertyObjectName &&
			hasPrefix(callee.property.name, propertyCallbackPrefixes)
		);
	}

	return false;
}

function hasDependencyIdentifier(callExpression: ESTree.CallExpression, name: string): boolean {
	const [, dependencyArgument] = callExpression.arguments;
	if (dependencyArgument?.type !== "ArrayExpression") return false;

	for (const element of dependencyArgument.elements) {
		if (element?.type === "Identifier" && element.name === name) return true;
	}

	return false;
}

function getDependencyIdentifiers(callExpression: ESTree.CallExpression): Set<string> {
	const identifiers = new Set<string>();
	const [, dependencyArgument] = callExpression.arguments;
	if (dependencyArgument?.type !== "ArrayExpression") return identifiers;

	for (const element of dependencyArgument.elements) {
		if (element?.type === "Identifier") identifiers.add(element.name);
	}

	return identifiers;
}

function isEmptyDependencyArray(callExpression: ESTree.CallExpression): boolean {
	const [, dependencyArgument] = callExpression.arguments;
	if (dependencyArgument === undefined) return true;
	if (dependencyArgument.type !== "ArrayExpression") return false;
	return dependencyArgument.elements.length === 0;
}

function hasOnlyNestedStatementsMatching(
	statements: ReadonlyArray<ESTree.Statement>,
	matches: (statement: ESTree.Statement) => boolean,
): boolean {
	if (statements.length === 0) return false;

	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			if (statement.alternate !== null) return false;
			if (!hasOnlyNestedStatementsMatching(getStatementsFromConsequent(statement.consequent), matches)) {
				return false;
			}
			continue;
		}

		if (!matches(statement)) return false;
	}

	return true;
}

function collectSetterCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): Set<string> {
	const setters = new Set<string>();

	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			for (const setter of collectSetterCalls(innerStatements, stateSetterIdentifiers)) setters.add(setter);
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (
			callExpression !== undefined &&
			isStateSetterCall(callExpression, stateSetterIdentifiers) &&
			callExpression.callee.type === "Identifier"
		) {
			setters.add(callExpression.callee.name);
		}
	}

	return setters;
}

function isAllowedPropertyCallbackCall(
	callExpression: ESTree.CallExpression,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	const { callee } = callExpression;
	if (callee.type === "Identifier") return propertyCallbackIdentifiers.has(callee.name);
	return (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		callee.property.type === "Identifier" &&
		propertyCallbackIdentifiers.has(callee.object.name)
	);
}

function hasNonSetterSideEffect(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (hasNonSetterSideEffect(innerStatements, stateSetterIdentifiers, propertyCallbackIdentifiers)) {
				return true;
			}
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined) continue;

		if (isStateSetterCall(callExpression, stateSetterIdentifiers)) continue;
		if (isAllowedPropertyCallbackCall(callExpression, propertyCallbackIdentifiers)) continue;

		return true;
	}

	return false;
}

function hasOnlySetterCallsWithArgument(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	isArgumentMatch: (argument: ESTree.Node) => boolean,
): boolean {
	return hasOnlyNestedStatementsMatching(statements, (statement) => {
		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined || !isStateSetterCall(callExpression, stateSetterIdentifiers)) return false;
		if (callExpression.arguments.length !== 1) return false;

		const [argument] = callExpression.arguments;
		return argument !== undefined && isArgumentMatch(argument);
	});
}

function isConstantValue(node: ESTree.Node): boolean {
	return (
		(node.type === "Literal" && typeof node.value !== "object") ||
		isEmptyArrayExpression(node) ||
		isEmptyObjectExpression(node)
	);
}

function hasOnlyResetValueSetterCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	return hasOnlySetterCallsWithArgument(statements, stateSetterIdentifiers, isResetValue);
}

function hasOnlyConstantSetterCalls(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	return hasOnlySetterCallsWithArgument(statements, stateSetterIdentifiers, isConstantValue);
}

function hasOnlyLogCalls(statements: ReadonlyArray<ESTree.Statement>): boolean {
	return hasOnlyNestedStatementsMatching(statements, (statement) => {
		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined) return false;

		if (
			callExpression.callee.type === "MemberExpression" &&
			!callExpression.callee.computed &&
			callExpression.callee.object.type === "Identifier" &&
			callExpression.callee.object.name === "console" &&
			callExpression.callee.property.type === "Identifier"
		) {
			return true;
		}

		return false;
	});
}

const SUBSCRIBE_METHODS = new Set(["addEventListener", "addListener", "on", "subscribe"]);

function hasExternalStorePattern(statements: ReadonlyArray<ESTree.Statement>): boolean {
	return statements.some((statement) => {
		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined) return false;

		if (
			callExpression.callee.type === "MemberExpression" &&
			!callExpression.callee.computed &&
			callExpression.callee.property.type === "Identifier"
		) {
			return SUBSCRIBE_METHODS.has(callExpression.callee.property.name);
		}

		return false;
	});
}

function isRefCurrentArgument(argument: ESTree.Node, referenceIdentifiers: ReadonlySet<string>): boolean {
	return (
		argument.type === "MemberExpression" &&
		!argument.computed &&
		argument.object.type === "Identifier" &&
		argument.property.type === "Identifier" &&
		argument.property.name === "current" &&
		referenceIdentifiers.has(argument.object.name)
	);
}

function passesRefCurrentToCallback(
	callExpression: ESTree.CallExpression,
	referenceIdentifiers: ReadonlySet<string>,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	return (
		callExpression.callee.type === "Identifier" &&
		propertyCallbackIdentifiers.has(callExpression.callee.name) &&
		callExpression.arguments.some((argument) => isRefCurrentArgument(argument, referenceIdentifiers))
	);
}

function hasRefPassedToParent(
	statements: ReadonlyArray<ESTree.Statement>,
	referenceIdentifiers: ReadonlySet<string>,
	propertyCallbackIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			const innerStatements = getStatementsFromConsequent(statement.consequent);
			if (hasRefPassedToParent(innerStatements, referenceIdentifiers, propertyCallbackIdentifiers)) return true;
			continue;
		}

		const callExpression = getCallExpressionFromStatement(statement);
		if (callExpression === undefined) continue;

		if (passesRefCurrentToCallback(callExpression, referenceIdentifiers, propertyCallbackIdentifiers)) return true;
	}

	return false;
}

function collectIdentifiers(node: ESTree.Node): Set<string> {
	const identifiers = new Set<string>();
	const visited = new Set<ESTree.Node>();
	/* v8 ignore next -- callers pass expression nodes from conditions and dependencies. @preserve */
	const stack: Array<ExpressionSearchNode> = isExpressionSearchNode(node) ? [node] : [];

	while (stack.length > 0) {
		const current = stack.pop();
		/* v8 ignore next -- stack length is checked before pop. @preserve */
		if (current === undefined || visited.has(current)) continue;
		visited.add(current);

		if (current.type === "Identifier") {
			identifiers.add(current.name);
			continue;
		}

		if (isExpressionSearchNode(current)) pushExpressionSearchChildren(current, stack);
	}

	return identifiers;
}

function getAlternateStatements(statement: ESTree.IfStatement): ReadonlyArray<ESTree.Statement> {
	if (statement.alternate === null) return [];
	return statement.alternate.type === "BlockStatement" ? statement.alternate.body : [statement.alternate];
}

function hasPropertyDependencyInCondition(
	statement: ESTree.IfStatement,
	stateValueIdentifiers: ReadonlySet<string>,
	depIdentifiers: ReadonlySet<string>,
): boolean {
	const conditionIdentifiers = collectIdentifiers(statement.test);
	return [...conditionIdentifiers].some((id) => depIdentifiers.has(id) && !stateValueIdentifiers.has(id));
}

function hasSetterCallStatement(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
): boolean {
	return statements.some((statement) => {
		const call = getCallExpressionFromStatement(statement);
		return call !== undefined && isStateSetterCall(call, stateSetterIdentifiers);
	});
}

function hasConditionalSetterBasedOnProperty(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	stateValueIdentifiers: ReadonlySet<string>,
	depIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			if (
				hasPropertyDependencyInCondition(statement, stateValueIdentifiers, depIdentifiers) &&
				hasSetterCallStatement(getStatementsFromConsequent(statement.consequent), stateSetterIdentifiers)
			) {
				return true;
			}

			if (
				hasConditionalSetterBasedOnProperty(
					getAlternateStatements(statement),
					stateSetterIdentifiers,
					stateValueIdentifiers,
					depIdentifiers,
				)
			) {
				return true;
			}
		}
	}

	return false;
}

const EVENT_SIDE_EFFECT_PREFIXES = new Set([
	"alert",
	"confirm",
	"display",
	"hide",
	"log",
	"navigate",
	"notify",
	"post",
	"prompt",
	"redirect",
	"report",
	"send",
	"show",
	"submit",
	"track",
]);

function hasEventPrefix(name: string): boolean {
	const lowerName = name.toLowerCase();
	for (const prefix of EVENT_SIDE_EFFECT_PREFIXES) if (lowerName.startsWith(prefix)) return true;
	return false;
}

function isEventSideEffectCall(statement: ESTree.Statement, stateSetterIdentifiers: ReadonlySet<string>): boolean {
	const call = getCallExpressionFromStatement(statement);
	if (call === undefined || isStateSetterCall(call, stateSetterIdentifiers)) return false;

	if (call.callee.type === "Identifier") return hasEventPrefix(call.callee.name);
	if (call.callee.type !== "MemberExpression" || call.callee.computed) return false;
	if (call.callee.property.type !== "Identifier") return false;
	return hasEventPrefix(call.callee.property.name);
}

function hasStateInCondition(statement: ESTree.IfStatement, stateValueIdentifiers: ReadonlySet<string>): boolean {
	const conditionIdentifiers = collectIdentifiers(statement.test);
	return [...conditionIdentifiers].some((id) => stateValueIdentifiers.has(id));
}

function hasEventSpecificLogic(
	statements: ReadonlyArray<ESTree.Statement>,
	stateSetterIdentifiers: ReadonlySet<string>,
	stateValueIdentifiers: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			if (
				hasStateInCondition(statement, stateValueIdentifiers) &&
				getStatementsFromConsequent(statement.consequent).some((stmt) =>
					isEventSideEffectCall(stmt, stateSetterIdentifiers),
				)
			) {
				return true;
			}

			if (
				statement.alternate !== null &&
				hasEventSpecificLogic(getAlternateStatements(statement), stateSetterIdentifiers, stateValueIdentifiers)
			) {
				return true;
			}
		}
	}

	return false;
}

function areDependenciesIdentical(ids1: ReadonlySet<string>, ids2: ReadonlySet<string>): boolean {
	if (ids1.size !== ids2.size) return false;
	for (const id of ids1) if (!ids2.has(id)) return false;
	return true;
}

function getOwnerStateKey(ownerFunctionId: number, stateValue: string): string {
	return `${ownerFunctionId}:${stateValue}`;
}

function getFunctionBody(node: CallbackFunction): ESTree.BlockStatement | undefined {
	if (node.body?.type === "BlockStatement") return node.body;
	return undefined;
}

function isBlockBodyArrow(
	node: ESTree.ArrowFunctionExpression,
): node is ESTree.ArrowFunctionExpression & { body: ESTree.BlockStatement } {
	return node.body.type === "BlockStatement";
}

function isBlockBodyFunction(node: ESTree.Function): node is ESTree.Function & { body: ESTree.FunctionBody } {
	return node.body !== null;
}

const KNOWN_EXTERNAL_PATTERNS = new Set([
	"addEventListener",
	"addListener",
	"alert",
	"analytics",
	"cancelAnimationFrame",
	"clearInterval",
	"clearTimeout",
	"confirm",
	"debug",
	"delete",
	"error",
	"fetch",
	"get",
	"info",
	"log",
	"navigate",
	"navigateTo",
	"notify",
	"observe",
	"patch",
	"post",
	"prompt",
	"put",
	"redirect",
	"removeEventListener",
	"removeListener",
	"report",
	"requestAnimationFrame",
	"send",
	"setInterval",
	"setTimeout",
	"showNotification",
	"submit",
	"subscribe",
	"track",
	"unobserve",
	"unsubscribe",
	"warn",
]);

const MEMBER_METHOD_PREFIXES = ["fetch", "send", "post", "track"] as const;

const MEMBER_METHOD_EXACT = new Set([
	"addEventListener",
	"addListener",
	"cancelAnimationFrame",
	"catch",
	"clearInterval",
	"clearTimeout",
	"finally",
	"observe",
	"removeEventListener",
	"removeListener",
	"requestAnimationFrame",
	"setInterval",
	"setTimeout",
	"subscribe",
	"then",
	"unobserve",
	"unsubscribe",
]);

const CALLER_NAME_PREFIXES = [
	"log",
	"fetch",
	"send",
	"track",
	"report",
	"show",
	"navigate",
	"submit",
	"post",
	"notify",
] as const;

function hasCallerNamePrefix(name: string): boolean {
	for (const prefix of CALLER_NAME_PREFIXES) if (name.startsWith(prefix)) return true;
	return false;
}

function isConsoleSideEffect(callee: ESTree.MemberExpression): boolean {
	return (
		callee.object.type === "Identifier" &&
		callee.object.name === "console" &&
		callee.property.type === "Identifier" &&
		(callee.property.name === "log" ||
			callee.property.name === "warn" ||
			callee.property.name === "error" ||
			callee.property.name === "info" ||
			callee.property.name === "debug")
	);
}

function hasMemberSideEffectMethod(method: string): boolean {
	for (const prefix of MEMBER_METHOD_PREFIXES) if (method.startsWith(prefix)) return true;
	return MEMBER_METHOD_EXACT.has(method);
}

function isRealExternalCall(
	call: ESTree.CallExpression,
	setterIds: ReadonlySet<string>,
	callbackIds: ReadonlySet<string>,
): boolean {
	const { callee } = call;
	if (isStateSetterCall(call, setterIds)) return false;
	if (callee.type === "Identifier") {
		if (callbackIds.has(callee.name)) return false;
		return KNOWN_EXTERNAL_PATTERNS.has(callee.name) || hasCallerNamePrefix(callee.name);
	}

	if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
	if (callee.object.type === "Identifier" && callbackIds.has(callee.object.name)) return false;
	return isConsoleSideEffect(callee) || hasMemberSideEffectMethod(callee.property.name);
}

function hasRealExternalSideEffect(
	statements: ReadonlyArray<ESTree.Statement>,
	setterIds: ReadonlySet<string>,
	callbackIds: ReadonlySet<string>,
): boolean {
	for (const statement of statements) {
		if (statement.type === "IfStatement") {
			const inner = getStatementsFromConsequent(statement.consequent);
			if (hasRealExternalSideEffect(inner, setterIds, callbackIds)) return true;
			continue;
		}

		const call = getCallExpressionFromStatement(statement);
		if (call === undefined) continue;
		if (isRealExternalCall(call, setterIds, callbackIds)) return true;
	}

	return false;
}

const PROGRAM_FUNCTION_ID = 0;

const noUselessUseEffect = defineRule({
	create(context) {
		const options = normalizeOptions(context.options[0]);
		const reactSources = getReactSources(options.environment);

		const reactNamespaces = new Set<string>();
		const effectIdentifiers = new Set<string>();
		const stateHookIdentifiers = new Set<string>();
		const stateSetterIdentifiers = new Set<string>();
		const stateValueIdentifiers = new Set<string>();
		const stateSetterToValue = new Map<string, string>();
		const refHookIdentifiers = new Set<string>();
		const refIdentifiers = new Set<string>();
		const functionContextStack = new Array<FunctionContext>();
		let nextFunctionId = 1;

		const namedFunctions = new Map<string, CallbackFunction>();

		const componentEffects = new Array<EffectInfo>();

		function isEffectCall(node: ESTree.CallExpression): boolean {
			return isHookCall(node, effectIdentifiers, reactNamespaces, options.hooks);
		}

		function isStateHookCall(node: ESTree.CallExpression): boolean {
			return isHookCall(node, stateHookIdentifiers, reactNamespaces, options.stateHooks);
		}

		function isReferenceHookCall(node: ESTree.CallExpression): boolean {
			return isHookCall(node, refHookIdentifiers, reactNamespaces, options.refHooks);
		}

		function recordStateSetter(node: ESTree.VariableDeclarator): void {
			if (
				node.init?.type !== "CallExpression" ||
				!isStateHookCall(node.init) ||
				node.id.type !== "ArrayPattern"
			) {
				return;
			}

			const { elements } = node.id;
			if (elements.length < 2) return;

			const [, setterElement] = elements;
			if (setterElement === null || setterElement === undefined || setterElement.type !== "Identifier") return;
			stateSetterIdentifiers.add(setterElement.name);

			const [stateElement] = elements;
			if (stateElement?.type === "Identifier") {
				stateValueIdentifiers.add(stateElement.name);
				stateSetterToValue.set(setterElement.name, stateElement.name);
			}
		}

		function recordRef(node: ESTree.VariableDeclarator): void {
			if (
				node.init?.type !== "CallExpression" ||
				!isReferenceHookCall(node.init) ||
				node.id.type !== "Identifier"
			) {
				return;
			}
			refIdentifiers.add(node.id.name);
		}

		function recordNamedFunction(node: ESTree.VariableDeclarator): void {
			if (node.id.type !== "Identifier" || node.init === null) return;

			if (node.init.type === "FunctionExpression" || node.init.type === "ArrowFunctionExpression") {
				namedFunctions.set(node.id.name, node.init);
			}
		}

		function enterFunction(node: CallbackFunction): void {
			const functionId = nextFunctionId;
			nextFunctionId += 1;
			const functionName = getFunctionName(node);
			functionContextStack.push(
				buildFunctionContext(
					node,
					options.propertyCallbackPrefixes,
					functionId,
					isCustomHookName(functionName),
				),
			);

			if (node.type === "FunctionDeclaration" && node.id !== null) {
				namedFunctions.set(node.id.name, node);
			}
		}

		function exitFunction(): void {
			functionContextStack.pop();
		}

		function hasMixedDerivedStateWithoutRealSideEffect(state: EffectAnalysisState): boolean {
			if (
				!(
					options.reportMixedDerivedState &&
					state.setterCalls.size > 0 &&
					state.hasNonSetter &&
					!state.hasReturnCleanup
				)
			) {
				return false;
			}

			return !hasRealExternalSideEffect(
				state.statements,
				stateSetterIdentifiers,
				/* v8 ignore next -- analyzed effects are always inside a tracked function context. @preserve */
				state.functionContext?.propertyCallbackIdentifiers ?? new Set<string>(),
			);
		}

		function getEffectReportMessage(state: EffectAnalysisState): EffectReportMessageId | undefined {
			const {
				coreStatements,
				dependencyIdentifiers,
				functionContext,
				hasNonSetter,
				hasReturnCleanup,
				node,
				statements,
			} = state;
			const flagName = options.reportEventFlag
				? matchEventFlagPattern(statements, stateSetterToValue, stateSetterIdentifiers)
				: undefined;
			const hasPropertyDependency = [...dependencyIdentifiers].some(
				(id) => !(stateValueIdentifiers.has(id) || stateSetterIdentifiers.has(id)),
			);

			const checks: ReadonlyArray<readonly [boolean, EffectReportMessageId]> = [
				[
					options.reportEmptyEffect &&
						(statements.length === 0 ||
							(statements[0] !== undefined && isReturnWithoutArgument(statements[0]))),
					"emptyEffect",
				],
				[
					options.reportInitializeState &&
						isEmptyDependencyArray(node) &&
						hasOnlyConstantSetterCalls(statements, stateSetterIdentifiers),
					"initializeState",
				],
				[
					options.reportResetState &&
						hasOnlyResetValueSetterCalls(statements, stateSetterIdentifiers) &&
						hasPropertyDependency,
					"resetState",
				],
				[flagName !== undefined && hasDependencyIdentifier(node, flagName), "eventFlag"],
				[
					options.reportEventSpecificLogic &&
						hasEventSpecificLogic(statements, stateSetterIdentifiers, stateValueIdentifiers),
					"eventSpecificLogic",
				],
				[
					options.reportAdjustState &&
						hasConditionalSetterBasedOnProperty(
							statements,
							stateSetterIdentifiers,
							stateValueIdentifiers,
							dependencyIdentifiers,
						) &&
						!hasNonSetter,
					"adjustState",
				],
				[
					options.reportDerivedState &&
						countSetterCalls(coreStatements, stateSetterIdentifiers) !== undefined,
					"derivedState",
				],
				[hasMixedDerivedStateWithoutRealSideEffect(state), "mixedDerivedState"],
				[
					options.reportPassRefToParent &&
						functionContext !== undefined &&
						hasRefPassedToParent(statements, refIdentifiers, functionContext.propertyCallbackIdentifiers),
					"passRefToParent",
				],
				[
					options.reportNotifyParent &&
						functionContext !== undefined &&
						!functionContext.isCustomHook &&
						countPropertyCallbackCalls(
							coreStatements,
							functionContext,
							options.propertyCallbackPrefixes,
						) !== undefined,
					"notifyParent",
				],
				[
					options.reportExternalStore && hasExternalStorePattern(statements) && hasReturnCleanup,
					"externalStore",
				],
				[options.reportLogOnly && hasOnlyLogCalls(statements), "logOnly"],
			];

			return checks.find(([shouldReport]) => shouldReport)?.[1];
		}

		function analyzeEffect(
			node: ESTree.CallExpression,
			statements: ReadonlyArray<ESTree.Statement>,
			body: ESTree.BlockStatement | undefined,
		): void {
			const functionContext = functionContextStack.at(-1);
			const coreStatements = stripLeadingGuard(statements);
			const dependencyIdentifiers = getDependencyIdentifiers(node);

			const setterCalls = collectSetterCalls(statements, stateSetterIdentifiers);
			const hasNonSetter = hasNonSetterSideEffect(
				statements,
				stateSetterIdentifiers,
				/* v8 ignore next -- analyzed effects are always inside a tracked function context. @preserve */
				functionContext?.propertyCallbackIdentifiers ?? new Set<string>(),
			);
			const hasReturnCleanup = body !== undefined && hasReturnWithArgument(body);

			componentEffects.push({
				depIdentifiers: dependencyIdentifiers,
				hasNonSetterSideEffect: hasNonSetter,
				hasReturnWithCleanup: hasReturnCleanup,
				node,
				/* v8 ignore next -- analyzed effects are always inside a tracked function context. @preserve */
				ownerFunctionId: functionContext?.functionId ?? PROGRAM_FUNCTION_ID,
				setterCalls,
				statements,
			});

			const messageId = getEffectReportMessage({
				coreStatements,
				dependencyIdentifiers,
				functionContext,
				hasNonSetter,
				hasReturnCleanup,
				node,
				setterCalls,
				statements,
			});
			if (messageId !== undefined) context.report({ messageId, node });
		}

		function analyzeEffectChains(): void {
			if (!options.reportEffectChain) return;

			const stateSetByEffect = buildStateSetByEffect();

			for (const effect of componentEffects) {
				if (effect.hasNonSetterSideEffect || effect.hasReturnWithCleanup) continue;

				for (const dependency of effect.depIdentifiers) {
					const ownerStateKey = getOwnerStateKey(effect.ownerFunctionId, dependency);
					const setterEffectIndices = stateSetByEffect.get(ownerStateKey);
					if (setterEffectIndices !== undefined && areSetterEffectsPure(setterEffectIndices)) {
						context.report({ messageId: "effectChain", node: effect.node });
						return;
					}
				}
			}
		}

		function buildStateSetByEffect(): Map<string, Set<number>> {
			const stateSetByEffect = new Map<string, Set<number>>();
			for (const [index, effect] of componentEffects.entries()) {
				for (const setter of effect.setterCalls) {
					const stateValue = stateSetterToValue.get(setter);
					if (stateValue === undefined) continue;

					const ownerStateKey = getOwnerStateKey(effect.ownerFunctionId, stateValue);
					let setters = stateSetByEffect.get(ownerStateKey);
					if (setters === undefined) {
						setters = new Set<number>();
						stateSetByEffect.set(ownerStateKey, setters);
					}
					setters.add(index);
				}
			}
			return stateSetByEffect;
		}

		function areSetterEffectsPure(indices: ReadonlySet<number>): boolean {
			/* v8 ignore next -- callers only pass sets collected from at least one effect. @preserve */
			if (indices.size === 0) return false;
			return [...indices].every((index) => {
				const setterEffect = componentEffects[index];
				return (
					setterEffect !== undefined &&
					!setterEffect.hasNonSetterSideEffect &&
					!setterEffect.hasReturnWithCleanup
				);
			});
		}

		function analyzeDuplicateDeps(): void {
			if (!options.reportDuplicateDeps || componentEffects.length < 2) return;

			const reported = new Set<number>();

			for (let index = 0; index < componentEffects.length; index += 1) {
				if (reported.has(index)) continue;
				const duplicates = getDuplicateEffectIndices(index, reported);

				if (duplicates.length < 2) continue;
				reportDuplicateEffects(duplicates, reported);
			}
		}

		function getDuplicateEffectIndices(index: number, reported: ReadonlySet<number>): ReadonlyArray<number> {
			const effect = componentEffects[index];
			/* v8 ignore next -- index is produced by iterating componentEffects.entries(). @preserve */
			if (effect === undefined || effect.depIdentifiers.size === 0) return [];

			const duplicates = [index];
			for (let jndex = index + 1; jndex < componentEffects.length; jndex += 1) {
				const candidate = componentEffects[jndex];
				if (reported.has(jndex)) continue;
				/* v8 ignore next -- componentEffects is a dense array in this rule. @preserve */
				if (candidate === undefined) continue;
				if (candidate.ownerFunctionId !== effect.ownerFunctionId) continue;
				if (areDependenciesIdentical(effect.depIdentifiers, candidate.depIdentifiers)) duplicates.push(jndex);
			}
			return duplicates;
		}

		function reportDuplicateEffects(duplicates: ReadonlyArray<number>, reported: Set<number>): void {
			for (const jndex of duplicates) {
				reported.add(jndex);
				const effect = componentEffects[jndex];
				/* v8 ignore next -- duplicate indices are collected from existing effects. @preserve */
				if (effect !== undefined) context.report({ messageId: "duplicateDeps", node: effect.node });
			}
		}

		function analyzeNamedEffectCallback(node: ESTree.CallExpression, callbackName: string): void {
			const namedFunction = namedFunctions.get(callbackName);
			if (namedFunction === undefined || namedFunction.async) return;

			const body = getFunctionBody(namedFunction);
			if (body === undefined) return;

			const statements = body.body.filter((statement) => statement.type !== "EmptyStatement");
			analyzeEffect(node, statements, body);
		}

		function analyzeInlineEffectCallback(node: ESTree.CallExpression, callback: CallbackFunction): void {
			if (callback.async) return;

			if (callback.type === "ArrowFunctionExpression") {
				if (!isBlockBodyArrow(callback)) return;
				const statements = callback.body.body.filter((statement) => statement.type !== "EmptyStatement");
				analyzeEffect(node, statements, callback.body);
				return;
			}

			/* v8 ignore next -- parser-produced function callbacks have block bodies. @preserve */
			if (!isBlockBodyFunction(callback)) return;
			const statements = callback.body.body.filter((statement) => statement.type !== "EmptyStatement");
			analyzeEffect(node, statements, callback.body);
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			CallExpression(node): void {
				if (!isEffectCall(node)) return;

				const [callback] = node.arguments;
				if (callback === undefined) return;

				if (callback.type === "Identifier") {
					analyzeNamedEffectCallback(node, callback.name);
					return;
				}

				if (!isFunction(callback)) return;
				analyzeInlineEffectCallback(node, callback);
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
			ImportDeclaration(node): void {
				forEachReactNamedImport(node, reactSources, reactNamespaces, (importedName, localName) => {
					if (options.hooks.has(importedName)) effectIdentifiers.add(localName);
					if (options.stateHooks.has(importedName)) stateHookIdentifiers.add(localName);
					if (options.refHooks.has(importedName)) refHookIdentifiers.add(localName);
				});
			},
			"Program:exit"(): void {
				analyzeEffectChains();
				analyzeDuplicateDeps();
			},
			VariableDeclarator(node): void {
				recordStateSetter(node);
				recordRef(node);
				recordNamedFunction(node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow empty effects, duplicate dependencies, effect chains, log-only effects, derived state, external-store state sync, state initialization, reset effects, parent notifications, parent ref callbacks, and event side effects routed through state.",
		},
		messages: {
			adjustState:
				"This effect adjusts state when a prop changes. Adjust the state directly during rendering or restructure to avoid this need.",
			derivedState:
				"This effect only derives state from properties or state. Compute the value during rendering instead of useEffect.",
			duplicateDeps:
				"Multiple effects have identical dependency arrays. Combine them into a single effect for better performance.",
			effectChain:
				"This effect is part of a chain of effects that only derive state from other effects. Consolidate the logic into event handlers or compute during rendering.",
			emptyEffect: "This effect has an empty body and should be removed.",
			eventFlag:
				"This effect only reacts to a state flag. Call the side effect directly in the event handler instead of toggling state.",
			eventSpecificLogic:
				"This effect runs event-specific logic based on state. Move this logic to the event handler that triggers the state change.",
			externalStore:
				"This effect subscribes to an external store and syncs to state. Use `useSyncExternalStore` instead.",
			initializeState:
				"This effect initializes state with a constant value. Pass the value as the useState initializer instead.",
			logOnly:
				"This effect only contains console.log calls. Remove it (debug leftover) or move the logging to an event handler.",
			mixedDerivedState:
				"This effect contains state setter calls that derive values from props or state mixed with other operations. Extract the setter calls and compute values during rendering.",
			notifyParent:
				"This effect only notifies a parent via a property callback. Call the callback in the event handler instead of useEffect.",
			passRefToParent:
				"This effect passes a ref to a parent callback. Use `forwardRef` or `useImperativeHandle` instead.",
			resetState:
				"This effect resets state when a prop changes. Pass a `key` prop to the component instead to reset all state automatically.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					hooks: {
						default: [...DEFAULT_HOOKS],
						description: "Effect hook names checked for avoidable effect patterns.",
						items: { type: "string" },
						type: "array",
					},
					propertyCallbackPrefixes: {
						default: [...DEFAULT_PROPERTY_CALLBACK_PREFIXES],
						description: "Property name prefixes treated as event callback props.",
						items: { type: "string" },
						type: "array",
					},
					refHooks: {
						default: [...DEFAULT_REF_HOOKS],
						description: "Ref hook names that return mutable ref objects.",
						items: { type: "string" },
						type: "array",
					},
					reportAdjustState: {
						default: true,
						description: "Report effects that only adjust state after render.",
						type: "boolean",
					},
					reportDerivedState: {
						default: true,
						description: "Report effects that copy derived values into state.",
						type: "boolean",
					},
					reportDuplicateDeps: {
						default: true,
						description: "Report duplicate entries in effect dependency arrays.",
						type: "boolean",
					},
					reportEffectChain: {
						default: true,
						description: "Report effects that only trigger another effect through state.",
						type: "boolean",
					},
					reportEmptyEffect: {
						default: true,
						description: "Report effects whose callback body is empty.",
						type: "boolean",
					},
					reportEventFlag: {
						default: true,
						description: "Report effects that react to event flags stored in state.",
						type: "boolean",
					},
					reportEventSpecificLogic: {
						default: true,
						description: "Report effects that move event-specific logic out of the event callback.",
						type: "boolean",
					},
					reportExternalStore: {
						default: true,
						description: "Report effects that mirror external store values into local state.",
						type: "boolean",
					},
					reportInitializeState: {
						default: true,
						description: "Report effects that only initialize state after mount.",
						type: "boolean",
					},
					reportLogOnly: {
						default: true,
						description: "Report effects that only log values.",
						type: "boolean",
					},
					reportMixedDerivedState: {
						default: true,
						description: "Report effects that mix derived-state updates with other work.",
						type: "boolean",
					},
					reportNotifyParent: {
						default: true,
						description: "Report effects that only notify a parent through a callback prop.",
						type: "boolean",
					},
					reportPassRefToParent: {
						default: true,
						description: "Report effects that only pass a ref value to a parent callback.",
						type: "boolean",
					},
					reportResetState: {
						default: true,
						description: "Report effects that reset local state when inputs change.",
						type: "boolean",
					},
					stateHooks: {
						default: [...DEFAULT_STATE_HOOKS],
						description: "State hook names that return [value, setter] pairs.",
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

export default noUselessUseEffect;
