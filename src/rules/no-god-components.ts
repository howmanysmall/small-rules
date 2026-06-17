// oxlint-disable small-rules/prevent-abbreviations -- this would be a breaking change.
import { isReactComponentHigherOrderCall } from "$oxc-utilities/component-utilities";
import { isComponentName, isFunction } from "$oxc-utilities/oxc-utilities";
import { getHookName, walkAst } from "$oxc-utilities/react-hook-utilities";
import { isNumberRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const FUNCTION_BOUNDARY_TYPES = new Set<string>([
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
]);

function getComponentNameFromFunction(node: ESTree.Node): string | undefined {
	if (node.type === "FunctionDeclaration" && node.id !== null && isComponentName(node.id.name)) {
		return node.id.name;
	}

	if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
		const { parent } = node;
		if (
			parent.type === "VariableDeclarator" &&
			parent.id.type === "Identifier" &&
			isComponentName(parent.id.name)
		) {
			return parent.id.name;
		}

		if (parent.type === "Property" && parent.key.type === "Identifier" && isComponentName(parent.key.name)) {
			return parent.key.name;
		}

		if (
			parent.type === "MethodDefinition" &&
			parent.key.type === "Identifier" &&
			isComponentName(parent.key.name)
		) {
			return parent.key.name;
		}
	}

	return undefined;
}

function getComponentNameFromCallParent(callExpression: ESTree.CallExpression): string | undefined {
	const { parent } = callExpression;
	if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier" && isComponentName(parent.id.name)) {
		return parent.id.name;
	}

	if (
		parent.type === "AssignmentExpression" &&
		parent.left.type === "Identifier" &&
		isComponentName(parent.left.name)
	) {
		return parent.left.name;
	}

	let nameFromExportDefault: string | undefined;
	if (parent.type === "ExportDefaultDeclaration" && callExpression.arguments.length > 0) {
		const [firstArgument] = callExpression.arguments;
		if (
			firstArgument?.type === "FunctionExpression" &&
			firstArgument.id &&
			isComponentName(firstArgument.id.name)
		) {
			nameFromExportDefault = firstArgument.id.name;
		}
	}

	return nameFromExportDefault;
}

function countDestructuredProperties(node: ESTree.Node): number | undefined {
	if (!isFunction(node)) return undefined;

	const [firstParameter] = node.params;
	if (!firstParameter) return undefined;

	let pattern: ESTree.ObjectPattern | undefined;
	if (firstParameter.type === "ObjectPattern") pattern = firstParameter;
	if (firstParameter.type === "AssignmentPattern" && firstParameter.left.type === "ObjectPattern") {
		pattern = firstParameter.left;
	}

	if (!pattern) return undefined;

	let count = 0;
	for (const property of pattern.properties) if (property.type === "Property") count += 1;
	return count;
}

function isTypeOnlyNullLiteral(_: ESTree.Node, parent?: ESTree.Node): boolean {
	return parent?.type === "TSLiteralType";
}

interface BodyAnalysis {
	readonly maxJsxDepth: number;
	readonly nullLiterals: Array<ESTree.Node>;
	readonly stateHookCount: number;
}

function analyzeComponentBody(node: ESTree.Node, stateHooks: ReadonlySet<string>): BodyAnalysis {
	if (!isFunction(node)) return { maxJsxDepth: 0, nullLiterals: new Array<ESTree.Node>(), stateHookCount: 0 };

	if (node.body === null) {
		return { maxJsxDepth: 0, nullLiterals: new Array<ESTree.Node>(), stateHookCount: 0 };
	}

	let maxJsxDepth = 0;
	let stateHookCount = 0;
	const nullLiterals = new Array<ESTree.Node>();
	let currentJsxDepth = 0;

	walkAst(node.body, (current) => {
		if (FUNCTION_BOUNDARY_TYPES.has(current.type) && current !== node) return;

		if (current.type === "JSXElement" || current.type === "JSXFragment") {
			currentJsxDepth += 1;
			if (currentJsxDepth > maxJsxDepth) maxJsxDepth = currentJsxDepth;
			return;
		}

		if (current.type === "CallExpression") {
			const hookName = getHookName(current);
			if (hookName !== undefined && hookName.length > 0 && stateHooks.has(hookName)) stateHookCount += 1;
		}

		if (current.type === "Literal" && current.value === null && !isTypeOnlyNullLiteral(current, current.parent)) {
			nullLiterals.push(current);
		}
	});

	return { maxJsxDepth, nullLiterals, stateHookCount };
}

interface NoGodComponentsOptions {
	readonly enforceTargetLines?: boolean;
	readonly ignoreComponents?: ReadonlyArray<string>;
	readonly maxDestructuredProps?: number;
	readonly maxLines?: number;
	readonly maxStateHooks?: number;
	readonly maxTsxNesting?: number;
	readonly stateHooks?: ReadonlyArray<string>;
	readonly targetLines?: number;
}

function parseOptions(options: unknown): Required<NoGodComponentsOptions> {
	const defaults: Required<NoGodComponentsOptions> = {
		enforceTargetLines: true,
		ignoreComponents: new Array<string>(),
		maxDestructuredProps: 5,
		maxLines: 200,
		maxStateHooks: 5,
		maxTsxNesting: 3,
		stateHooks: ["useState", "useReducer", "useBinding"],
		targetLines: 120,
	};

	if (typeof options !== "object" || options === null) return defaults;

	const cast = options as NoGodComponentsOptions;
	return {
		enforceTargetLines:
			typeof cast.enforceTargetLines === "boolean" ? cast.enforceTargetLines : defaults.enforceTargetLines,
		ignoreComponents: Array.isArray(cast.ignoreComponents) ? cast.ignoreComponents : defaults.ignoreComponents,
		maxDestructuredProps: isNumberRaw(cast.maxDestructuredProps)
			? cast.maxDestructuredProps
			: defaults.maxDestructuredProps,
		maxLines: isNumberRaw(cast.maxLines) ? cast.maxLines : defaults.maxLines,
		maxStateHooks: isNumberRaw(cast.maxStateHooks) ? cast.maxStateHooks : defaults.maxStateHooks,
		maxTsxNesting: isNumberRaw(cast.maxTsxNesting) ? cast.maxTsxNesting : defaults.maxTsxNesting,
		stateHooks: Array.isArray(cast.stateHooks) ? cast.stateHooks : defaults.stateHooks,
		targetLines: isNumberRaw(cast.targetLines) ? cast.targetLines : defaults.targetLines,
	};
}

const noGodComponents = defineRule({
	create(context): Visitor {
		const configuration = parseOptions(context.options[0]);
		const ignoreSet = new Set(configuration.ignoreComponents);
		const stateHooks = new Set(configuration.stateHooks);
		const checked = new WeakSet<ESTree.Node>();

		function checkComponent(node: ESTree.Node, name: string): void {
			if (ignoreSet.has(name) || checked.has(node)) return;
			checked.add(node);

			const location = node.loc;
			const lines = location.end.line - location.start.line + 1;
			if (lines > configuration.maxLines) {
				context.report({
					data: {
						lines: String(lines),
						max: String(configuration.maxLines),
						name,
						target: String(configuration.targetLines),
					},
					messageId: "exceedsMaxLines",
					node,
				});
			} else if (configuration.enforceTargetLines && lines > configuration.targetLines) {
				context.report({
					data: {
						lines: String(lines),
						max: String(configuration.maxLines),
						name,
						target: String(configuration.targetLines),
					},
					messageId: "exceedsTargetLines",
					node,
				});
			}

			const propertiesCount = countDestructuredProperties(node);
			if (isNumberRaw(propertiesCount) && propertiesCount > configuration.maxDestructuredProps) {
				context.report({
					data: { count: String(propertiesCount), max: String(configuration.maxDestructuredProps), name },
					messageId: "tooManyProps",
					node,
				});
			}

			const analysis = analyzeComponentBody(node, stateHooks);
			if (analysis.maxJsxDepth > configuration.maxTsxNesting) {
				context.report({
					data: { depth: String(analysis.maxJsxDepth), max: String(configuration.maxTsxNesting), name },
					messageId: "tsxNestingTooDeep",
					node,
				});
			}

			if (analysis.stateHookCount > configuration.maxStateHooks) {
				context.report({
					data: {
						count: String(analysis.stateHookCount),
						hooks: configuration.stateHooks.join(", "),
						max: String(configuration.maxStateHooks),
						name,
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
				if (
					!firstArgument ||
					(firstArgument.type !== "FunctionExpression" && firstArgument.type !== "ArrowFunctionExpression")
				) {
					return;
				}

				const nameFromParent = getComponentNameFromCallParent(node);
				const nameFromArgument = getComponentNameFromFunction(firstArgument);
				const name = nameFromParent ?? nameFromArgument;
				if (name === undefined || name.length === 0) return;
				checkComponent(firstArgument, name);
			},
			FunctionDeclaration(node): void {
				if (node.type === "FunctionDeclaration") maybeCheckFunction(node);
			},
			FunctionExpression(node): void {
				if (node.type === "FunctionExpression") maybeCheckFunction(node);
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
			tooManyProps:
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
						description: "Component names to ignore.",
						items: { type: "string" },
						type: "array",
					},
					maxDestructuredProps: {
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
