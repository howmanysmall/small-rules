import { isUseMemoCall } from "$oxc-utilities/oxc-utilities";
import { classifyDependencies, DependenciesKind, getEffectCallback } from "$oxc-utilities/react-hook-utilities";
import { isStandaloneUseMemo, trackUseMemoImports } from "$oxc-utilities/react-memo-utilities";
import { getEnvironment, getReactSources } from "$oxc-utilities/react-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	isStaticArrayExpression,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Environment } from "$oxc-utilities/react-utilities";
import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";
import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type DependencyMode = "aggressive" | "empty-or-omitted" | "non-updating";

interface NormalizedOptions {
	readonly dependencyMode: DependencyMode;
	readonly environment: Environment;
	readonly staticGlobalFactories: ReadonlySet<string>;
}

function getDependencyMode(value: unknown): DependencyMode {
	if (!isRecord(value) || typeof value.dependencyMode !== "string") return "non-updating";
	if (value.dependencyMode === "empty-or-omitted" || value.dependencyMode === "aggressive") {
		return value.dependencyMode;
	}
	return "non-updating";
}

function isStaticGlobalFactories(value: unknown): value is ReadonlyArray<string> {
	if (!Array.isArray(value)) return false;
	for (const item of value) if (typeof item !== "string") return false;
	return true;
}

function normalizeOptions(raw: unknown): NormalizedOptions {
	const factories =
		isRecord(raw) && isStaticGlobalFactories(raw.staticGlobalFactories)
			? raw.staticGlobalFactories
			: DEFAULT_STATIC_GLOBAL_FACTORIES;

	return {
		dependencyMode: getDependencyMode(raw),
		environment: getEnvironment(raw),
		staticGlobalFactories: new Set(factories),
	};
}

function toStaticExpressionOptions(options: NormalizedOptions): StaticExpressionOptions {
	return { staticGlobalFactories: options.staticGlobalFactories };
}

function getMemoCallbackExpression(node: ESTree.CallExpression): ESTree.Expression | undefined {
	const callback = getEffectCallback(node);
	if (callback === undefined) return undefined;

	const { body } = callback;
	if (body === null) return undefined;

	if (body.type !== "BlockStatement") return body;
	if (body.body.length !== 1) return undefined;

	const [statement] = body.body;
	return statement?.type === "ReturnStatement" ? (statement.argument ?? undefined) : undefined;
}

function dependenciesAreNonUpdating(dependenciesKind: DependenciesKind, options: NormalizedOptions): boolean {
	switch (options.dependencyMode) {
		case "aggressive":
			return true;

		case "empty-or-omitted": {
			return (
				dependenciesKind === DependenciesKind.MissingOrOmitted ||
				dependenciesKind === DependenciesKind.EmptyArray
			);
		}

		case "non-updating": {
			return (
				dependenciesKind === DependenciesKind.MissingOrOmitted ||
				dependenciesKind === DependenciesKind.EmptyArray ||
				dependenciesKind === DependenciesKind.StaticArray
			);
		}

		default: {
			const error = new Error(`Unknown dependency mode: ${String(options.dependencyMode)}`);
			Error.captureStackTrace(error, dependenciesAreNonUpdating);
			throw error;
		}
	}
}

const noUselessUseMemo = defineRule({
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);
		const staticOptions = toStaticExpressionOptions(options);
		const reactSources = getReactSources(options.environment);
		const memoIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();

		return {
			CallExpression(node): void {
				if (
					!isUseMemoCall(node, memoIdentifiers, reactNamespaces) ||
					isStandaloneUseMemo(node) ||
					node.arguments.length === 0
				) {
					return;
				}

				const callbackExpression = getMemoCallbackExpression(node);
				if (callbackExpression === undefined) return;

				const seen = new Set<ESTree.Node>();
				if (!isStaticExpression(context.sourceCode, callbackExpression, seen, staticOptions)) return;

				const dependencies = classifyDependencies(
					context.sourceCode,
					node.arguments[1],
					seen,
					staticOptions,
					isStaticArrayExpression,
				);
				if (!dependenciesAreNonUpdating(dependencies, options)) return;

				context.report({
					messageId: "uselessUseMemo",
					node,
				});
			},
			ImportDeclaration(node): void {
				trackUseMemoImports(node, reactSources, memoIdentifiers, reactNamespaces);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow useMemo calls that only wrap values static enough to live at module scope.",
		},
		messages: {
			uselessUseMemo:
				"useMemo is wrapping a static value. Move the value to module scope instead of paying hook overhead for no runtime benefit.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					dependencyMode: {
						default: "non-updating",
						description: "Dependency-array mode used to decide whether a memoized value is static.",
						enum: ["empty-or-omitted", "non-updating", "aggressive"],
						type: "string",
					},
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
					staticGlobalFactories: {
						default: DEFAULT_STATIC_GLOBAL_FACTORIES,
						description: "Global constructors and factories whose calls are treated as static values.",
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

export default noUselessUseMemo;
