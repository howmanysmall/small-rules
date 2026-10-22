import { getSynchronousStateSetterCalls } from "$oxc-utilities/react-effect-call-sites";
import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { Reference } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

function isSomeArgumentInternal(analysis: ReactEffectAnalysis, argumentReferences: ReadonlyArray<Reference>): boolean {
	return argumentReferences.some(
		(upstreamReference) => analysis.isState(upstreamReference) || analysis.isProp(upstreamReference),
	);
}

const noDerivedState = createReactEffectRule("no-derived-state", {
	checkEffect(context, analysis, effect): void {
		if (effect.dependencyReferences === undefined) return;

		const calls = getSynchronousStateSetterCalls(analysis, effect, isSomeArgumentInternal);
		for (const { callExpression, stateName } of calls) {
			context.report({
				data: { state: stateName },
				messageId: "avoidDerivedState",
				node: callExpression,
			});
		}
	},
	description: "Disallow storing derived state in an effect.",
	messages: {
		avoidDerivedState: 'Avoid storing derived state. Instead, compute "{{state}}" directly during render.',
	},
	skipEffectsWithCleanup: true,
});

export default noDerivedState;
