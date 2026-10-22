import { getParentCallbackCalls } from "$oxc-utilities/react-effect-call-sites";
import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { Reference } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

function getStateArguments(analysis: ReactEffectAnalysis, reference: Reference): ReadonlyArray<Reference> {
	return analysis.scope.getArgumentUpstreamReferences(reference).filter(analysis.isState);
}

const noPassLiveStateToParent = createReactEffectRule("no-pass-live-state-to-parent", {
	checkEffect(context, analysis, effect): void {
		for (const { callExpression, names, owner } of getParentCallbackCalls(analysis, effect, getStateArguments)) {
			context.report({
				data: { name: owner.displayName, state: names },
				messageId: owner.isInCustomHook
					? "avoidPassingLiveStateToParentInHook"
					: "avoidPassingLiveStateToParentInComponent",
				node: callExpression,
			});
		}
	},
	description: "Disallow passing live state to parents in an effect.",
	messages: {
		avoidPassingLiveStateToParentInComponent:
			'Avoid passing live state to parents in an effect. Instead, lift "{{state}}" to the parent and pass it down to {{name}} as a prop.',
		avoidPassingLiveStateToParentInHook:
			'Avoid passing live state to parents in an effect. Instead, return "{{state}}" from {{name}}.',
	},
});

export default noPassLiveStateToParent;
