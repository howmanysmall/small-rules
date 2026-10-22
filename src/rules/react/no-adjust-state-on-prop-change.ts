// oxlint-disable small-rules/prevent-abbreviations -- the `props` data key is
// a published contract.
import { createRule } from "$oxc-utilities/create-rule";
import { getSynchronousStateSetterCalls, joinQuotedReferenceNames } from "$oxc-utilities/react-effect-call-sites";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

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

function isNoArgumentProperty(analysis: ReactEffectAnalysis, argumentReferences: ReadonlyArray<Reference>): boolean {
	// Avoid overlap with no-derived-state
	return !argumentReferences.some(analysis.isProp);
}

function reportAdjustStateEffect(
	context: RuleContext,
	analysis: ReactEffectAnalysis,
	effect: ReactEffect,
	propertyReferences: ReadonlyArray<Reference>,
): void {
	const props = joinQuotedReferenceNames(propertyReferences);
	for (const stateSetterCall of getSynchronousStateSetterCalls(analysis, effect, isNoArgumentProperty)) {
		context.report({
			data: { props, state: stateSetterCall.stateName },
			messageId: "avoidAdjustingStateWhenAPropChanges",
			node: stateSetterCall.callExpression,
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
				properties: { environment: ENVIRONMENT_SCHEMA },
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noAdjustStateOnPropertyChange;
