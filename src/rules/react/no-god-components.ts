import { isReactComponentHigherOrderCall } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	isAnyFunction,
	isAnyLiteral,
	isAssignmentExpression,
	isAssignmentPattern,
	isCallbackFunction,
	isCallExpression,
	isComponentName,
	isExportDefaultDeclaration,
	isFunctionDeclarationRaw,
	isFunctionExpression,
	isIdentifierName,
	isJsxElement,
	isJsxFragment,
	isMethodDefinition,
	isObjectPattern,
	isProperty,
	isTsLiteralType,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { getHookName, walkAst } from "$oxc-utilities/react-hook-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const FUNCTION_BOUNDARY_TYPES = new Set<string>([ARROW_FUNCTION_EXPRESSION, FUNCTION_DECLARATION, FUNCTION_EXPRESSION]);

const MAX_DESTRUCTURED_PROPERTIES_OPTION = "maxDestructuredProps";

function getComponentNameFromFunction(node: ESTree.Node): string | undefined {
	if (isFunctionDeclarationRaw(node) && node.id !== null && isComponentName(node.id.name)) return node.id.name;

	if (isCallbackFunction(node)) {
		const { parent } = node;
		if (isVariableDeclarator(parent) && isIdentifierName(parent.id) && isComponentName(parent.id.name)) {
			return parent.id.name;
		}

		if (isProperty(parent) && isIdentifierName(parent.key) && isComponentName(parent.key.name)) {
			return parent.key.name;
		}

		if (isMethodDefinition(parent) && isIdentifierName(parent.key) && isComponentName(parent.key.name)) {
			return parent.key.name;
		}
	}

	return undefined;
}

function getComponentNameFromCallParent(callExpression: ESTree.CallExpression): string | undefined {
	const { parent } = callExpression;
	if (isVariableDeclarator(parent) && isIdentifierName(parent.id) && isComponentName(parent.id.name)) {
		return parent.id.name;
	}

	if (isAssignmentExpression(parent) && isIdentifierName(parent.left) && isComponentName(parent.left.name)) {
		return parent.left.name;
	}

	let nameFromExportDefault: string | undefined;
	if (isExportDefaultDeclaration(parent) && callExpression.arguments.length > 0) {
		const [firstArgument] = callExpression.arguments;
		/* v8 ignore next -- @preserve React wrapper export defaults use named function expressions in this path. */
		if (isFunctionExpression(firstArgument) && firstArgument.id && isComponentName(firstArgument.id.name)) {
			nameFromExportDefault = firstArgument.id.name;
		}
	}

	return nameFromExportDefault;
}

function countDestructuredProperties(node: ESTree.Node): number | undefined {
	/* v8 ignore next -- callers only pass function-like component nodes. @preserve */
	if (!isAnyFunction(node)) return undefined;

	const [firstParameter] = node.params;
	if (!firstParameter) return undefined;

	let pattern: ESTree.ObjectPattern | undefined;
	if (isObjectPattern(firstParameter)) pattern = firstParameter;
	if (isAssignmentPattern(firstParameter) && isObjectPattern(firstParameter.left)) {
		pattern = firstParameter.left;
	}

	if (!pattern) return undefined;

	let count = 0;
	for (const property of pattern.properties) if (isProperty(property)) count += 1;
	return count;
}

function isTypeOnlyNullLiteral(_: ESTree.Node, parent?: ESTree.Node): boolean {
	return isTsLiteralType(parent);
}

interface BodyAnalysis {
	readonly maxJsxDepth: number;
	readonly nullLiterals: Array<ESTree.Node>;
	readonly stateHookCount: number;
}

function shouldSkipNestedFunction(current: ESTree.Node, root: ESTree.Node): boolean {
	return current !== root && FUNCTION_BOUNDARY_TYPES.has(current.type);
}

function isJsxNode(current: ESTree.Node): boolean {
	return isJsxElement(current) || isJsxFragment(current);
}

function isCountedStateHook(current: ESTree.Node, stateHooks: ReadonlySet<string>): boolean {
	if (!isCallExpression(current)) return false;
	const hookName = getHookName(current);
	return hookName !== undefined && hookName.length > 0 && stateHooks.has(hookName);
}

function isReportableNullLiteral(current: ESTree.Node): boolean {
	return isAnyLiteral(current) && current.value === null && !isTypeOnlyNullLiteral(current, current.parent);
}

function analyzeComponentBody(node: ESTree.Node, stateHooks: ReadonlySet<string>): BodyAnalysis {
	/* v8 ignore next -- callers only analyze function-like component nodes. @preserve */
	if (!isAnyFunction(node)) return { maxJsxDepth: 0, nullLiterals: [], stateHookCount: 0 };

	/* v8 ignore next 3 -- @preserve implemented function nodes in this visitor have parser bodies. */
	if (node.body === null) return { maxJsxDepth: 0, nullLiterals: [], stateHookCount: 0 };

	let maxJsxDepth = 0;
	let stateHookCount = 0;
	const nullLiterals = new Array<ESTree.Node>();
	let currentJsxDepth = 0;

	walkAst(node.body, (current) => {
		if (shouldSkipNestedFunction(current, node)) return;

		if (isJsxNode(current)) {
			currentJsxDepth += 1;
			/* v8 ignore next -- @preserve first JSX node in a component always raises the maximum depth. */
			if (currentJsxDepth > maxJsxDepth) maxJsxDepth = currentJsxDepth;
			return;
		}

		if (isCountedStateHook(current, stateHooks)) stateHookCount += 1;

		if (isReportableNullLiteral(current)) nullLiterals.push(current);
	});

	return { maxJsxDepth, nullLiterals, stateHookCount };
}

interface RawNoGodComponentsOptions {
	readonly enforceTargetLines?: boolean | undefined;
	readonly ignoreComponents?: ReadonlyArray<string> | undefined;
	readonly [MAX_DESTRUCTURED_PROPERTIES_OPTION]?: number | undefined;
	readonly maxLines?: number | undefined;
	readonly maxStateHooks?: number | undefined;
	readonly maxTsxNesting?: number | undefined;
	readonly stateHooks?: ReadonlyArray<string> | undefined;
	readonly targetLines?: number | undefined;
}

interface NoGodComponentsOptions {
	readonly enforceTargetLines?: boolean;
	readonly ignoreComponents?: ReadonlyArray<string>;
	readonly maxDestructuredProperties?: number;
	readonly maxLines?: number;
	readonly maxStateHooks?: number;
	readonly maxTsxNesting?: number;
	readonly stateHooks?: ReadonlyArray<string>;
	readonly targetLines?: number;
}

type NoGodComponentsRuleOptions = RawNoGodComponentsOptions | undefined;

function parseOptions(options: NoGodComponentsRuleOptions): Required<NoGodComponentsOptions> {
	const defaults: Required<NoGodComponentsOptions> = {
		enforceTargetLines: true,
		ignoreComponents: new Array<string>(),
		maxDestructuredProperties: 5,
		maxLines: 200,
		maxStateHooks: 5,
		maxTsxNesting: 3,
		stateHooks: ["useState", "useReducer", "useBinding"],
		targetLines: 120,
	};

	const configured: NoGodComponentsRuleOptions = options ?? {};
	return {
		enforceTargetLines: configured.enforceTargetLines ?? defaults.enforceTargetLines,
		ignoreComponents: configured.ignoreComponents ?? defaults.ignoreComponents,
		maxDestructuredProperties: configured[MAX_DESTRUCTURED_PROPERTIES_OPTION] ?? defaults.maxDestructuredProperties,
		maxLines: configured.maxLines ?? defaults.maxLines,
		maxStateHooks: configured.maxStateHooks ?? defaults.maxStateHooks,
		maxTsxNesting: configured.maxTsxNesting ?? defaults.maxTsxNesting,
		stateHooks: configured.stateHooks ?? defaults.stateHooks,
		targetLines: configured.targetLines ?? defaults.targetLines,
	};
}

const TOO_MANY_PROPERTIES_MESSAGE_ID = "tooManyProps";

const noGodComponents = createRule("no-god-components", "react", {
	create(context): Visitor {
		const options = parseOptions(context.options[0]);
		const ignoreSet = new Set(options.ignoreComponents);
		const stateHooks = new Set(options.stateHooks);
		const checked = new WeakSet<ESTree.Node>();

		function isSkippedComponent(name: string, node: ESTree.Node): boolean {
			return ignoreSet.has(name) || checked.has(node);
		}

		function reportLineLength(node: ESTree.Node, name: string, lines: number): void {
			if (lines > options.maxLines) {
				context.report({
					data: {
						name,
						lines: String(lines),
						max: String(options.maxLines),
						target: String(options.targetLines),
					},
					messageId: "exceedsMaxLines",
					node,
				});
				return;
			}
			if (options.enforceTargetLines && lines > options.targetLines) {
				context.report({
					data: {
						name,
						lines: String(lines),
						max: String(options.maxLines),
						target: String(options.targetLines),
					},
					messageId: "exceedsTargetLines",
					node,
				});
			}
		}

		function reportDestructuredProperties(node: ESTree.Node, name: string): void {
			const propertiesCount = countDestructuredProperties(node);
			if (propertiesCount !== undefined && propertiesCount > options.maxDestructuredProperties) {
				context.report({
					data: { name, count: String(propertiesCount), max: String(options.maxDestructuredProperties) },
					messageId: TOO_MANY_PROPERTIES_MESSAGE_ID,
					node,
				});
			}
		}

		function reportBodyAnalysis(node: ESTree.Node, name: string, analysis: BodyAnalysis): void {
			if (analysis.maxJsxDepth > options.maxTsxNesting) {
				context.report({
					data: { name, depth: String(analysis.maxJsxDepth), max: String(options.maxTsxNesting) },
					messageId: "tsxNestingTooDeep",
					node,
				});
			}

			if (analysis.stateHookCount > options.maxStateHooks) {
				context.report({
					data: {
						name,
						count: String(analysis.stateHookCount),
						hooks: options.stateHooks.join(", "),
						max: String(options.maxStateHooks),
					},
					messageId: "tooManyStateHooks",
					node,
				});
			}

			for (const literal of analysis.nullLiterals) {
				context.report({
					messageId: "nullLiteral",
					node: literal,
				});
			}
		}

		function checkComponent(node: ESTree.Node, name: string): void {
			if (isSkippedComponent(name, node)) return;
			checked.add(node);

			const location = node.loc;
			const lines = location.end.line - location.start.line + 1;
			reportLineLength(node, name, lines);

			reportDestructuredProperties(node, name);

			const analysis = analyzeComponentBody(node, stateHooks);
			reportBodyAnalysis(node, name, analysis);
		}

		function maybeCheckFunction(node: ESTree.Node): void {
			const name = getComponentNameFromFunction(node);
			if (name === undefined || name.length === 0) return;
			checkComponent(node, name);
		}

		return {
			ArrowFunctionExpression: maybeCheckFunction,
			CallExpression(node): void {
				if (!isReactComponentHigherOrderCall(node)) return;

				const [firstArgument] = node.arguments;
				if (!isCallbackFunction(firstArgument)) return;

				const nameFromParent = getComponentNameFromCallParent(node);
				const nameFromArgument = getComponentNameFromFunction(firstArgument);
				const name = nameFromParent ?? nameFromArgument;
				if (name === undefined || name.length === 0) return;
				checkComponent(firstArgument, name);
			},
			FunctionDeclaration(node): void {
				/* v8 ignore next -- this handler is only registered for FunctionDeclaration nodes. @preserve */
				if (isFunctionDeclarationRaw(node)) maybeCheckFunction(node);
			},
			FunctionExpression(node): void {
				/* v8 ignore next -- this handler is only registered for FunctionExpression nodes. @preserve */
				if (isFunctionExpression(node)) maybeCheckFunction(node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Enforce React component size and complexity limits inspired by the 'Refactor God Component' checklist.",
			recommended: false,
		},
		messages: {
			exceedsMaxLines:
				"Component '{{name}}' is {{lines}} lines; max allowed is {{max}}. Split into smaller components/hooks.",
			exceedsTargetLines:
				"Component '{{name}}' is {{lines}} lines; target is {{target}} (max {{max}}). Consider extracting hooks/components.",
			nullLiteral: "Avoid `null` in components; use `undefined` instead.",
			[TOO_MANY_PROPERTIES_MESSAGE_ID]:
				"Component '{{name}}' destructures {{count}} props; max allowed is {{max}}. Group props or split the component.",
			tooManyStateHooks:
				"Component '{{name}}' has {{count}} state hooks ({{hooks}}); max allowed is {{max}}. Extract cohesive state into a custom hook.",
			tsxNestingTooDeep:
				"Component '{{name}}' has TSX nesting depth {{depth}}; max allowed is {{max}}. Extract child components.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					enforceTargetLines: {
						default: true,
						description: "Whether to report when exceeding targetLines (soft limit).",
						type: "boolean",
					},
					ignoreComponents: {
						default: [],
						description: "Component names to ignore.",
						items: { type: "string" },
						type: "array",
					},
					[MAX_DESTRUCTURED_PROPERTIES_OPTION]: {
						default: 5,
						description: "Maximum number of destructured props in a component parameter.",
						type: "number",
					},
					maxLines: {
						default: 200,
						description: "Hard maximum lines for a component.",
						type: "number",
					},
					maxStateHooks: {
						default: 5,
						description: "Maximum number of stateful hook calls in a component.",
						type: "number",
					},
					maxTsxNesting: {
						default: 3,
						description: "Maximum JSX/TSX nesting depth in a component.",
						type: "number",
					},
					stateHooks: {
						default: ["useState", "useReducer", "useBinding"],
						description: "Hook names to count toward state complexity.",
						items: { type: "string" },
						type: "array",
					},
					targetLines: {
						default: 120,
						description: "Soft target lines for a component.",
						type: "number",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noGodComponents;
