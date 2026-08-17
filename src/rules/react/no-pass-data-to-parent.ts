import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ReactEffect, ReactEffectAnalysis, ReactOwner } from "$oxc-utilities/react-effect-utilities";
import type { ESTree, InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

type RuleContext = InferContextFromRule<typeof noPassDataToParent>;

function getDataArguments(analysis: ReactEffectAnalysis, reference: Reference): ReadonlyArray<Reference> {
	const dataArguments = new Array<Reference>();
	for (const upstreamReference of analysis.scope.getArgumentUpstreamReferences(reference)) {
		// Leaves only because our "is data" check is essentially "is not all
		// this other stuff", and the "other stuff" only works on leaf nodes.
		// Mid-stream nodes are effectively nothing, and so would pass those.
		if (analysis.scope.getUpstreamReferences(upstreamReference).length !== 1) continue;

		// Ideally would use isState and isRef, not the hooks.
		// But because it goes to leaves. Must be some other way?
		const { identifier } = upstreamReference;
		if (isUseState(identifier) || analysis.isProp(upstreamReference) || isUseRef(identifier)) continue;

		/* v8 ignore next -- data leaves resolve to plain identifiers; `ref.current` / constant leaf shapes are covered by the isProp/isUseRef guards above. @preserve */
		if (analysis.isRefCurrent(upstreamReference)) continue;
		if (!analysis.isConstant(upstreamReference)) dataArguments.push(upstreamReference);
	}
	return dataArguments;
}

function getComponentDisplayName(
	analysis: ReactEffectAnalysis,
	containingNode: ReactOwner | undefined,
	isInCustomHook: boolean,
): string {
	const name = analysis.getComponentName(containingNode);
	/* v8 ignore next 3 -- findEnclosingReactNode never yields a name-less ReactOwner: functional components/HOCs/custom hooks all carry an identifier. @preserve */
	if (name !== undefined && name !== "") return `"${name}"`;
	/* v8 ignore next -- findEnclosingReactNode never yields a name-less ReactOwner. @preserve */
	return isInCustomHook ? "this custom hook" : "this component";
}

function reportPassDataEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const reference of effect.functionReferences) {
		/* v8 ignore next -- effect traversal skips call arguments, so no non-synchronous prop-call reference is ever collected. @preserve */
		if (!analysis.scope.isSynchronousWithin(reference.identifier, effect.functionNode)) continue;
		if (!analysis.isPropCall(reference) || analysis.isRefCall(reference)) continue;

		const callExpression = analysis.scope.getCallExpression(reference);
		if (callExpression === undefined) continue;

		const dataArguments = getDataArguments(analysis, reference);
		if (dataArguments.length === 0) continue;

		const containingNode = analysis.findEnclosingReactNode(effect.node);
		const isInCustomHook = containingNode !== undefined && analysis.isCustomHook(containingNode);

		context.report({
			data: {
				name: getComponentDisplayName(analysis, containingNode, isInCustomHook),
				data: dataArguments.map((dataReference) => `"${dataReference.identifier.name}"`).join(" and "),
			},
			messageId: isInCustomHook ? "avoidPassingDataToParentInHook" : "avoidPassingDataToParentInComponent",
			node: callExpression,
		});
	}
}

const noPassDataToParent = createRule("no-pass-data-to-parent", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup !== undefined) continue;

					reportPassDataEffect(context, analysis, effect);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow passing data to parents in an effect.",
			recommended: true,
		},
		messages: {
			avoidPassingDataToParentInComponent:
				'Avoid passing data to parents in an effect. Instead, fetch "{{data}}" in the parent and pass it down to {{name}} as a prop.',
			avoidPassingDataToParentInHook:
				'Avoid passing data to parents in an effect. Instead, return "{{data}}" from {{name}}.',
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

function isUseState(node: ESTree.Node): boolean {
	/* v8 ignore start -- @preserve data-flow leaves are plain identifiers; non-identifier shapes never reach these checks. */
	if (node.type !== "Identifier" && node.type !== "MemberExpression") return false;
	if (node.type === "Identifier") return node.name === "useState";
	return (
		node.object.type === "Identifier" &&
		node.object.name === "React" &&
		node.property.type === "Identifier" &&
		node.property.name === "useState"
	);
	/* v8 ignore stop */
}
function isUseRef(node: ESTree.Node): boolean {
	/* v8 ignore start -- @preserve data-flow leaves are plain identifiers; non-identifier shapes never reach these checks. */
	if (node.type !== "Identifier" && node.type !== "MemberExpression") return false;
	if (node.type === "Identifier") return node.name === "useRef";
	return (
		node.object.type === "Identifier" &&
		node.object.name === "React" &&
		node.property.type === "Identifier" &&
		node.property.name === "useRef"
	);
	/* v8 ignore stop */
}

export default noPassDataToParent;
