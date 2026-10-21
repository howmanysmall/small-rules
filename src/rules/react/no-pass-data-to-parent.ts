import { isIdentifier, isIdentifierNamed, isMemberExpression } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { getParentCallbackCalls } from "$oxc-utilities/react-effect-call-sites";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

import type { ESTree, InferContextFromRule, Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

type RuleContext = InferContextFromRule<typeof noPassDataToParent>;

function createIsUseHook(hookName: `use${string}`): (node: ESTree.Node) => boolean {
	return function isUseHook(node): boolean {
		/* v8 ignore start -- @preserve data-flow leaves are plain identifiers; non-identifier shapes never reach these checks. */
		if (!isIdentifier(node) && !isMemberExpression(node)) return false;

		return (
			isIdentifierNamed(node, hookName) ||
			(isIdentifierNamed(node.object, "React") && isIdentifierNamed(node.property, hookName))
		);
		/* v8 ignore stop */
	};
}

const isUseState = createIsUseHook("useState");
const isUseRef = createIsUseHook("useRef");
const NO_REFERENCES: ReadonlyArray<Reference> = [];

function getDataArguments(analysis: ReactEffectAnalysis, reference: Reference): ReadonlyArray<Reference> {
	if (analysis.isRefCall(reference)) return NO_REFERENCES;

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

function reportPassDataEffect(context: RuleContext, analysis: ReactEffectAnalysis, effect: ReactEffect): void {
	for (const { callExpression, names, owner } of getParentCallbackCalls(analysis, effect, getDataArguments)) {
		context.report({
			data: { name: owner.displayName, data: names },
			messageId: owner.isInCustomHook ? "avoidPassingDataToParentInHook" : "avoidPassingDataToParentInComponent",
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
					environment: ENVIRONMENT_SCHEMA,
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default noPassDataToParent;
