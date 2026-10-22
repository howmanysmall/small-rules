import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { ReactEffectRuleContext } from "$oxc-utilities/react-effect-rule";
import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = ReactEffectRuleContext<"avoidInitializingState">;

function reportInitializeStateEffect(
	context: RuleContext,
	{ getStateName, isStateCall, scope }: ReactEffectAnalysis,
	effect: ReactEffect,
): void {
	for (const reference of effect.functionReferences) {
		if (!scope.isSynchronousWithin(reference.identifier, effect.functionNode) || !isStateCall(reference)) continue;

		const callExpression = scope.getCallExpression(reference);

		if (callExpression === undefined) continue;
		const stateName = getStateName(reference);
		if (stateName === undefined) continue;

		let argumentText = "undefined";
		const [firstArgument] = callExpression.arguments;
		if (firstArgument !== undefined) {
			argumentText = context.sourceCode.getText(firstArgument);
		}

		context.report({
			data: { arguments: argumentText, state: stateName },
			messageId: "avoidInitializingState",
			node: callExpression,
		});
	}
}

const noInitializeState = createReactEffectRule("no-initialize-state", {
	checkEffect(context, analysis, effect): void {
		if (effect.dependencyReferences === undefined) return;

		const isEffectRunOnlyOnMount = effect.dependencyReferences.every(analysis.isStateSetter);
		if (!isEffectRunOnlyOnMount) return;

		reportInitializeStateEffect(context, analysis, effect);
	},
	description: "Disallow initializing state in an effect.",
	messages: {
		avoidInitializingState:
			'Avoid initializing state in an effect. Instead, initialize "{{state}}"\'s "useState()" with "{{arguments}}". For SSR hydration, prefer "useSyncExternalStore".',
	},
});

export default noInitializeState;
