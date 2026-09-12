import { createRule } from "$oxc-utilities/create-rule";
import {
	describeEffectOwner,
	getReactEffectAnalysis,
	getReportableEffectCall,
} from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = InferContextFromRule<typeof noPassLiveStateToParent>;

function getStateNames(stateReferences: ReadonlyArray<Reference>): string {
	return stateReferences.map((stateReference) => `"${stateReference.identifier.name}"`).join(" and ");
}

function reportPassLiveStateEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const reference of effect.functionReferences) {
		const callExpression = getReportableEffectCall(analysis, effect, reference, (candidate) => {
			return analysis.isPropCall(candidate);
		});
		if (callExpression === undefined) continue;

		const stateReferences = analysis.scope.getArgumentUpstreamReferences(reference).filter(analysis.isState);
		if (stateReferences.length === 0) continue;

		const owner = describeEffectOwner(analysis, effect);

		context.report({
			data: {
				name: owner.displayName,
				state: getStateNames(stateReferences),
			},
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

export default noPassLiveStateToParent;
