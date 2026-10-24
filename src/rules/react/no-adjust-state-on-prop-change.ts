// oxlint-disable small-rules/prevent-abbreviations -- the `props` data key is
// a published contract.
import { getSynchronousStateSetterCalls, joinQuotedReferenceNames } from "$oxc-utilities/react-effect-call-sites";
import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { Reference } from "oxlint-plugin-utilities";

import type { ReactEffectRuleContext } from "$oxc-utilities/react-effect-rule";
import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = ReactEffectRuleContext<"avoidAdjustingStateWhenAPropChanges">;

function getPropertyReferences(analysis: ReactEffectAnalysis, effect: ReactEffect): ReadonlyArray<Reference> {
	const propertyReferences = new Array<Reference>();
	let size = 0;
	/* v8 ignore next -- @preserve dependencyReferences is guarded against undefined at the only call site, so the fallback is unreachable. */
	const dependencyReferences = effect.dependencyReferences ?? [];
	for (const reference of dependencyReferences) {
		for (const upstreamReference of analysis.scope.getUpstreamReferences(reference)) {
			if (analysis.isProp(upstreamReference)) {
				propertyReferences[size++] = upstreamReference;
			}
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

const noAdjustStateOnPropertyChange = createReactEffectRule("no-adjust-state-on-prop-change", {
	checkEffect(context, analysis, effect): void {
		if (effect.dependencyReferences === undefined) return;

		const propertyReferences = getPropertyReferences(analysis, effect);
		if (propertyReferences.length === 0) return;

		reportAdjustStateEffect(context, analysis, effect, propertyReferences);
	},
	description: "Disallow adjusting state in an effect when a prop changes.",
	messages: {
		avoidAdjustingStateWhenAPropChanges:
			'Avoid adjusting state when a prop changes. Instead, adjust "{{state}}" directly during render when {{props}} changes, or refactor your state to avoid this need entirely.',
	},
});

export default noAdjustStateOnPropertyChange;
