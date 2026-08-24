import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = InferContextFromRule<typeof noEventHandler>;

function reportEventHandlerEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const ifStatement of analysis.scope.getDescendantIfStatements(effect.functionNode)) {
		if (ifStatement.alternate !== null) continue;

		for (const ifTestReference of analysis.scope.getDownstreamReferences(ifStatement.test)) {
			const upstreamReferences = analysis.scope.getUpstreamReferences(ifTestReference);
			const { name } = ifTestReference.identifier;

			if (upstreamReferences.some((reference) => analysis.isState(reference))) {
				context.report({
					data: { name },
					messageId: "avoidEventHandler",
					node: ifTestReference.identifier,
				});
			}
			if (upstreamReferences.some((reference) => analysis.isProp(reference))) {
				context.report({
					data: { name },
					messageId: "avoidPropHandler",
					node: ifTestReference.identifier,
				});
			}
		}
	}
}

const noEventHandler = createRule("no-event-handler", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup !== undefined) continue;

					reportEventHandlerEffect(context, analysis, effect);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow using state and an effect as an event handler.",
			recommended: true,
		},
		messages: {
			avoidEventHandler:
				'Avoid using state and effects as an event handler. Instead, call the code that uses "{{name}}" directly when the event occurs.',
			avoidPropHandler:
				'Avoid using props and effects as an event handler. Instead, move the code that uses "{{name}}" to the parent component.',
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

export default noEventHandler;
