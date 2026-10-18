import { createRule } from "$oxc-utilities/create-rule";
import { getParentCallbackCalls } from "$oxc-utilities/react-effect-call-sites";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

import type { InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = InferContextFromRule<typeof noPassLiveStateToParent>;

function getStateArguments(analysis: ReactEffectAnalysis, reference: Reference): ReadonlyArray<Reference> {
	return analysis.scope.getArgumentUpstreamReferences(reference).filter(analysis.isState);
}

function reportPassLiveStateEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const { callExpression, names, owner } of getParentCallbackCalls(analysis, effect, getStateArguments)) {
		context.report({
			data: { name: owner.displayName, state: names },
			messageId: owner.isInCustomHook
				? "avoidPassingLiveStateToParentInHook"
				: "avoidPassingLiveStateToParentInComponent",
			node: callExpression,
		});
	}
}

const noPassLiveStateToParent = createRule("no-pass-live-state-to-parent", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					reportPassLiveStateEffect(context, analysis, effect);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow passing live state to parents in an effect.",
			recommended: true,
		},
		messages: {
			avoidPassingLiveStateToParentInComponent:
				'Avoid passing live state to parents in an effect. Instead, lift "{{state}}" to the parent and pass it down to {{name}} as a prop.',
			avoidPassingLiveStateToParentInHook:
				'Avoid passing live state to parents in an effect. Instead, return "{{state}}" from {{name}}.',
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

export default noPassLiveStateToParent;
