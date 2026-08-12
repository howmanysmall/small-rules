import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis, ReactOwner } from "$oxc-utilities/react-effect-utilities";
import type { InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noPassLiveStateToParent>;

function getComponentDisplayName(
	analysis: ReactEffectAnalysis,
	containingNode: ReactOwner | undefined,
	isInCustomHook: boolean,
): string {
	const name = analysis.getComponentName(containingNode);
	/* v8 ignore next 3 -- findEnclosingReactNode never yields a name-less ReactOwner: functional components/HOCs/custom hooks all carry an identifier. @preserve */
	if (name !== undefined && name !== "") {
		return `"${name}"`;
	}
	/* v8 ignore next -- findEnclosingReactNode never yields a name-less ReactOwner. @preserve */
	return isInCustomHook ? "this custom hook" : "this component";
}

function getStateNames(stateReferences: ReadonlyArray<Reference>): string {
	return stateReferences.map((stateReference) => `"${stateReference.identifier.name}"`).join(" and ");
}

function reportPassLiveStateEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const reference of effect.functionReferences) {
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) continue;
		if (!analysis.isPropCall(reference)) continue;
		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;

		const stateReferences = analysis.scope
			.getArgumentUpstreamReferences(reference)
			.filter((upstreamReference) => analysis.isState(upstreamReference));

		if (stateReferences.length === 0) continue;

		const containingNode = analysis.findEnclosingReactNode(effect.node);
		const isInCustomHook = containingNode !== undefined && analysis.isCustomHook(containingNode);

		context.report({
			data: {
				name: getComponentDisplayName(analysis, containingNode, isInCustomHook),
				state: getStateNames(stateReferences),
			},
			messageId: isInCustomHook
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
