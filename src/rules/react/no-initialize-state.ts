import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import type { InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noInitializeState>;

function reportInitializeStateEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const reference of effect.functionReferences) {
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) continue;
		if (!analysis.isStateCall(reference)) continue;
		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;
		const stateName = analysis.getStateName(reference);
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

const noInitializeState = createRule("no-initialize-state", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.dependencyReferences === undefined) continue;

					const isEffectRunOnlyOnMount =
						!effect.dependencyReferences.some((reference) => !analysis.isStateSetter(reference));
					if (!isEffectRunOnlyOnMount) continue;

					reportInitializeStateEffect(context, analysis, effect);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow initializing state in an effect.",
			recommended: true,
		},
		messages: {
			avoidInitializingState:
				'Avoid initializing state in an effect. Instead, initialize "{{state}}"\'s "useState()" with "{{arguments}}". For SSR hydration, prefer "useSyncExternalStore".',
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

export default noInitializeState;
