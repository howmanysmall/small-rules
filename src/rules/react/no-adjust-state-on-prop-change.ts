// oxlint-disable small-rules/prevent-abbreviations -- the `props` data key is
// a published contract.
import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = InferContextFromRule<typeof noAdjustStateOnPropertyChange>;

function getPropertyReferences(analysis: ReactEffectAnalysis, effect: ReactEffect): ReadonlyArray<Reference> {
	const propertyReferences = new Array<Reference>();
	let size = 0;
	/* v8 ignore next -- @preserve dependencyReferences is guarded against undefined at the only call site, so the fallback is unreachable. */
	const dependencyReferences = effect.dependencyReferences ?? [];
	for (const reference of dependencyReferences) {
		for (const upstreamReference of analysis.scope.getUpstreamReferences(reference)) {
			if (analysis.isProp(upstreamReference)) propertyReferences[size++] = upstreamReference;
		}
	}
	return propertyReferences;
}

function reportAdjustStateEffect(
	context: RuleContext,
	analysis: ReactEffectAnalysis,
	effect: ReactEffect,
	propertyReferences: ReadonlyArray<Reference>,
): void {
	for (const reference of effect.functionReferences) {
		if (
			!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode) ||
			!analysis.isStateCall(reference)
		) {
			continue;
		}

		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;

		// Avoid overlap with no-derived-state
		const isSomeArgumentsProperties = analysis.scope.getArgumentUpstreamReferences(reference).some(analysis.isProp);

		if (isSomeArgumentsProperties) continue;

		const stateName = analysis.getStateName(reference);
		if (stateName === undefined) continue;

		context.report({
			data: {
				props: propertyReferences
					.map((propertyReference) => `"${propertyReference.identifier.name}"`)
					.join(" and "),
				state: stateName,
			},
			messageId: "avoidAdjustingStateWhenAPropChanges",
			node: callExpression,
		});
	}
}

const noAdjustStateOnPropertyChange = createRule("no-adjust-state-on-prop-change", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.dependencyReferences === undefined) continue;

					const propertyReferences = getPropertyReferences(analysis, effect);
					if (propertyReferences.length === 0) continue;

					reportAdjustStateEffect(context, analysis, effect, propertyReferences);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow adjusting state in an effect when a prop changes.",
			recommended: true,
		},
		messages: {
			avoidAdjustingStateWhenAPropChanges:
				'Avoid adjusting state when a prop changes. Instead, adjust "{{state}}" directly during render when {{props}} changes, or refactor your state to avoid this need entirely.',
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

export default noAdjustStateOnPropertyChange;
