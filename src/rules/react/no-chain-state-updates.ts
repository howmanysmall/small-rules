import { createRule } from "$oxc-utilities/create-rule";
import { getSynchronousStateSetterCalls } from "$oxc-utilities/react-effect-call-sites";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

import type { Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

function isNoArgumentState(analysis: ReactEffectAnalysis, argumentReferences: ReadonlyArray<Reference>): boolean {
	// Avoid overlap with no-derived-state
	return !argumentReferences.some(analysis.isState);
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
						.flatMap(analysis.scope.getUpstreamReferences)
						.some(analysis.isState);

					if (!isSomeDependenciesState) continue;

					for (const stateSetterCall of getSynchronousStateSetterCalls(analysis, effect, isNoArgumentState)) {
						context.report({
							data: { state: stateSetterCall.stateName },
							messageId: "avoidChainingStateUpdates",
							node: stateSetterCall.callExpression,
						});
					}
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
				properties: { environment: ENVIRONMENT_SCHEMA },
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noChainStateUpdates;
