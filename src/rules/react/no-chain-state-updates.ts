import { getSynchronousStateSetterCalls } from "$oxc-utilities/react-effect-call-sites";
import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { Reference } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

function isNoArgumentState(analysis: ReactEffectAnalysis, argumentReferences: ReadonlyArray<Reference>): boolean {
	// Avoid overlap with no-derived-state
	return !argumentReferences.some(analysis.isState);
}

const noChainStateUpdates = createReactEffectRule("no-chain-state-updates", {
	checkEffect(context, analysis, effect): void {
		if (effect.dependencyReferences === undefined) return;

		const isSomeDependenciesState = effect.dependencyReferences
			.flatMap(analysis.scope.getUpstreamReferences)
			.some(analysis.isState);

		if (!isSomeDependenciesState) return;

		for (const stateSetterCall of getSynchronousStateSetterCalls(analysis, effect, isNoArgumentState)) {
			context.report({
				data: { state: stateSetterCall.stateName },
				messageId: "avoidChainingStateUpdates",
				node: stateSetterCall.callExpression,
			});
		}
	},
	description: "Disallow chaining state changes in an effect.",
	messages: {
		avoidChainingStateUpdates:
			'Avoid chaining state changes. When possible, update "{{state}}" along with other relevant state simultaneously.',
	},
	skipEffectsWithCleanup: true,
});

export default noChainStateUpdates;
