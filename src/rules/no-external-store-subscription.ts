import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import type { ESTree, InferContextFromRule, Reference, Variable, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noExternalStoreSubscription>;

function getBodySetters(analysis: ReactEffectAnalysis, effect: ReactEffect): ReadonlyArray<Reference> {
	return effect.functionReferences.filter((reference) => {
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) {
			return false;
		}
		return analysis.isStateCall(reference);
	});
}

function collectCleanupReferences(analysis: ReactEffectAnalysis, cleanupArgument: ESTree.Expression): Array<Reference> {
	const cleanupReferences = [...analysis.scope.getDownstreamReferences(cleanupArgument)];

	// Manual descend because `descend` skips arguments.
	for (const callExpression of analysis.scope.getDescendantCallExpressions(cleanupArgument)) {
		for (const argument of callExpression.arguments) {
			for (const argumentReference of analysis.scope.getDownstreamReferences(argument)) {
				cleanupReferences.push(argumentReference);
			}
		}
	}

	return cleanupReferences;
}

function collectCleanupVariables(
	analysis: ReactEffectAnalysis,
	cleanupReferences: ReadonlyArray<Reference>,
): Set<Variable> {
	// Trace both the body setter and cleanup refs through alias chains.
	// If they share any upstream variable, the cleanup references the same setter.
	const cleanupVariables = new Set<Variable>();
	for (const cleanupReference of cleanupReferences) {
		for (const upstreamReference of analysis.scope.getUpstreamReferences(cleanupReference)) {
			// `resolved` is typed `Variable | null`, but the harness exposes unresolved
			// bindings as `undefined`; the cast makes the runtime shape visible to lint.
			const resolved: Variable | null | undefined = upstreamReference.resolved;
			// oxlint-disable-next-line typescript/no-unnecessary-condition -- harness exposes unresolved refs as undefined despite the declared type.
			if (resolved === null || resolved === undefined) continue;
			// Import-bound variables (e.g. the `useState` callee) are shared by every
			// setter's upstream chain; ignoring them preserves the upstream rule's
			// behavior, where unresolved globals were skipped the same way.
			if (isImportBoundVariable(resolved)) continue;
			cleanupVariables.add(resolved);
		}
	}
	return cleanupVariables;
}

function reportSharedCleanupSetters(
	context: RuleContext,
	analysis: ReactEffectAnalysis,
	bodySetters: ReadonlyArray<Reference>,
	cleanupVariables: Set<Variable>,
): void {
	for (const reference of bodySetters) {
		const sharesCleanupVariable = analysis.scope
			.getUpstreamReferences(reference)
			.some((upstreamReference: Reference) => {
				const resolved: Variable | null | undefined = upstreamReference.resolved;
				// oxlint-disable-next-line typescript/no-unnecessary-condition -- harness exposes unresolved refs as undefined despite the declared type.
				return resolved !== null && resolved !== undefined && cleanupVariables.has(resolved);
			});
		if (!sharesCleanupVariable) continue;

		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;

		const stateName = analysis.getStateName(reference);
		if (stateName === undefined) continue;

		context.report({
			data: { state: stateName },
			messageId: "avoidExternalStoreSubscription",
			node: callExpression,
		});
	}
}

const noExternalStoreSubscription = createRule("no-external-store-subscription", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup === undefined) continue;
					// `getEffectCleanup` filters out bare `return;` (argument === null),
					// so a cleanup ReturnStatement always carries an argument here.
					/* v8 ignore next -- bare returns never reach this check. @preserve */
					if (effect.cleanup.argument === null) continue;

					const bodySetters = getBodySetters(analysis, effect);
					if (bodySetters.length === 0) continue;

					const cleanupReferences = collectCleanupReferences(analysis, effect.cleanup.argument);
					const cleanupVariables = collectCleanupVariables(analysis, cleanupReferences);

					reportSharedCleanupSetters(context, analysis, bodySetters, cleanupVariables);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow subscribing to an external store in an effect.",
			recommended: true,
		},
		messages: {
			avoidExternalStoreSubscription:
				'Avoid using an effect to subscribe to an external store. Instead, use "useSyncExternalStore" to manage "{{state}}".',
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
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

function isImportBoundVariable(variable: Variable): boolean {
	return variable.defs.some((definition) => definition.type === "ImportBinding");
}

export default noExternalStoreSubscription;
