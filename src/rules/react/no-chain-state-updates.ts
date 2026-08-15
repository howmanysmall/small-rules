import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import type { InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noChainStateUpdates>;

function reportChainStateUpdatesEffect(
	context: RuleContext,
	analysis: ReactEffectAnalysis,
	effect: ReactEffect,
	isSomeDependenciesState: boolean,
): void {
	for (const reference of effect.functionReferences) {
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) continue;
		if (!analysis.isStateCall(reference)) continue;
		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;

		// Avoid overlap with no-derived-state
		const isSomeArgumentsState = analysis.scope
			.getArgumentUpstreamReferences(reference)
			.some((upstreamReference) => analysis.isState(upstreamReference));

		if (!isSomeDependenciesState || isSomeArgumentsState) continue;

		const stateName = analysis.getStateName(reference);
		if (stateName === undefined) continue;

		context.report({
			data: { state: stateName },
			messageId: "avoidChainingStateUpdates",
			node: callExpression,
		});
	}
}

const noChainStateUpdates = createRule("no-chain-state-updates", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup !== undefined) continue;
					if (effect.dependencyReferences === undefined) continue;

					const isSomeDependenciesState = effect.dependencyReferences
						.flatMap((reference) => analysis.scope.getUpstreamReferences(reference))
						.some((reference) => analysis.isState(reference));

					reportChainStateUpdatesEffect(context, analysis, effect, isSomeDependenciesState);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow chaining state changes in an effect.",
			recommended: true,
		},
		messages: {
			avoidChainingStateUpdates:
				'Avoid chaining state changes. When possible, update "{{state}}" along with other relevant state simultaneously.',
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

export default noChainStateUpdates;
