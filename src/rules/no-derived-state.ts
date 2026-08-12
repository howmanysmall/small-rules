import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import type { InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noDerivedState>;

function reportDerivedStateEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const reference of effect.functionReferences) {
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) continue;
		if (!analysis.isStateCall(reference)) continue;
		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;
		const stateName = analysis.getStateName(reference);
		if (stateName === undefined) continue;

		const argumentsUpstreamReferences = analysis.scope.getArgumentUpstreamReferences(reference);
		const isSomeArgumentsInternal = argumentsUpstreamReferences.some(
			(upstreamReference) => analysis.isState(upstreamReference) || analysis.isProp(upstreamReference),
		);
		if (!isSomeArgumentsInternal) continue;

		context.report({
			data: { state: stateName },
			messageId: "avoidDerivedState",
			node: callExpression,
		});
	}
}

const noDerivedState = createRule("no-derived-state", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup !== undefined) continue;
					if (effect.dependencyReferences === undefined) continue;

					reportDerivedStateEffect(context, analysis, effect);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow storing derived state in an effect.",
			recommended: true,
		},
		messages: {
			avoidDerivedState: 'Avoid storing derived state. Instead, compute "{{state}}" directly during render.',
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

export default noDerivedState;
