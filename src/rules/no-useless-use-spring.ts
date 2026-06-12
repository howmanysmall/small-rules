import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { classifyDependencies, DependenciesKind } from "$oxc-utilities/react-hook-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	getConstInitializer,
	isImportBinding,
	isModuleLevelScope,
	isStaticArrayExpression,
	isStaticObjectExpression,
} from "$oxc-utilities/static-expression-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface NormalizedOptions {
	readonly springHooks: ReadonlySet<string>;
	readonly staticGlobalFactories: ReadonlySet<string>;
	readonly treatEmptyDepsAsViolation: boolean;
}

const DEFAULT_SPRING_HOOKS: ReadonlyArray<string> = ["useSpring"];

function objectHasFromAndTo(objectExpr: ESTree.ObjectExpression): boolean {
	let hasFrom = false;
	let hasTo = false;

	for (const property of objectExpr.properties) {
		if (property.type !== "Property" || property.computed || property.key.type !== "Identifier") continue;

		if (property.key.name === "from") hasFrom = true;
		if (property.key.name === "to") hasTo = true;
		if (hasFrom && hasTo) return true;
	}

	return false;
}

function objectExpressionMatches(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	predicate: (objectExpression: ESTree.ObjectExpression) => boolean,
): boolean {
	const unwrapped = unwrapExpression(expression);
	if (unwrapped.type === "ObjectExpression") return predicate(unwrapped);

	if (unwrapped.type !== "Identifier") return false;

	const variable = getVariableByName(sourceCode.getScope(unwrapped), unwrapped.name);
	if (variable === undefined || !isModuleLevelScope(variable.scope) || isImportBinding(variable)) return false;

	for (const definition of variable.defs) {
		const initializer = getConstInitializer(definition);
		if (initializer === undefined) continue;

		const normalizedInitializer = unwrapExpression(initializer);
		if (normalizedInitializer.type !== "ObjectExpression") continue;

		if (predicate(normalizedInitializer)) return true;
	}

	return false;
}

function hasFromAndToProperties(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	return objectExpressionMatches(sourceCode, expression, objectHasFromAndTo);
}

function isStaticObjectLikeConfig(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	seen: Set<ESTree.Node>,
	options: NormalizedOptions,
): boolean {
	const staticOptions: StaticExpressionOptions = { staticGlobalFactories: options.staticGlobalFactories };
	return objectExpressionMatches(sourceCode, expression, (objectExpression) =>
		isStaticObjectExpression(sourceCode, objectExpression, seen, staticOptions),
	);
}

function areDependenciesNonUpdating(kind: DependenciesKind, options: NormalizedOptions): boolean {
	if (kind === DependenciesKind.MissingOrOmitted || kind === DependenciesKind.StaticArray) return true;
	if (kind === DependenciesKind.EmptyArray) return options.treatEmptyDepsAsViolation;
	return false;
}

function isSpringHookCall({ callee }: ESTree.CallExpression, options: NormalizedOptions): boolean {
	if (callee.type === "Identifier") return options.springHooks.has(callee.name);

	if (callee.type === "MemberExpression" && !callee.computed) {
		const { property } = callee;
		if (property.type === "Identifier") return options.springHooks.has(property.name);
	}

	return false;
}

const noUselessUseSpring = defineRule({
	create(context): Visitor {
		const [rawOptions] = context.options;
		const normalized: NormalizedOptions = {
			springHooks: new Set(rawOptions?.springHooks ?? DEFAULT_SPRING_HOOKS),
			staticGlobalFactories: new Set(rawOptions?.staticGlobalFactories ?? DEFAULT_STATIC_GLOBAL_FACTORIES),
			treatEmptyDepsAsViolation: rawOptions?.treatEmptyDepsAsViolation ?? true,
		};

		return {
			CallExpression(node): void {
				if (!isSpringHookCall(node, normalized) || node.arguments.length === 0) return;

				const [configArgument] = node.arguments;
				if (configArgument === undefined || configArgument.type === "SpreadElement") return;

				const seen = new Set<ESTree.Node>();
				if (
					!isStaticObjectLikeConfig(context.sourceCode, configArgument, seen, normalized) ||
					hasFromAndToProperties(context.sourceCode, configArgument)
				) {
					return;
				}

				const dependenciesArgument = node.arguments.length > 1 ? node.arguments[1] : undefined;
				const dependenciesKind = classifyDependencies(
					context.sourceCode,
					dependenciesArgument,
					seen,
					normalized,
					isStaticArrayExpression,
				);
				if (!areDependenciesNonUpdating(dependenciesKind, normalized)) return;

				context.report({
					messageId: "uselessSpring",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow useSpring hooks whose config and dependencies are entirely static",
		},
		messages: {
			uselessSpring:
				"useSpring call has only static inputs and non-updating dependencies; replace it with a constant or remove the hook.",
		},
		schema: [
			{
				additionalProperties: false,
				default: {
					staticGlobalFactories: [...DEFAULT_STATIC_GLOBAL_FACTORIES],
					treatEmptyDepsAsViolation: true,
				},
				properties: {
					springHooks: {
						description: "Hook identifiers that should be treated as spring hooks",
						items: { type: "string" },
						type: "array",
					},
					staticGlobalFactories: {
						default: [...DEFAULT_STATIC_GLOBAL_FACTORIES],
						description: "Global factory identifiers that are treated as static constructors",
						items: { type: "string" },
						type: "array",
					},
					treatEmptyDepsAsViolation: {
						default: true,
						description: "Treat static config with an empty dependency array as a violation",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noUselessUseSpring;
