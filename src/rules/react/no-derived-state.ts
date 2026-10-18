import { createRule } from "$oxc-utilities/create-rule";
import { getSynchronousStateSetterCalls } from "$oxc-utilities/react-effect-call-sites";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

import type { Reference, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

function isSomeArgumentInternal(analysis: ReactEffectAnalysis, argumentReferences: ReadonlyArray<Reference>): boolean {
	return argumentReferences.some(
		(upstreamReference) => analysis.isState(upstreamReference) || analysis.isProp(upstreamReference),
	);
}

const noDerivedState = createRule("no-derived-state", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.cleanup !== undefined || effect.dependencyReferences === undefined) continue;

					const calls = getSynchronousStateSetterCalls(analysis, effect, isSomeArgumentInternal);
					for (const { callExpression, stateName } of calls) {
						context.report({
							data: { state: stateName },
							messageId: "avoidDerivedState",
							node: callExpression,
						});
					}
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow storing derived state in an effect.",
			recommended: true,
		},
		messages: {
			avoidDerivedState: 'Avoid storing derived state. Instead, compute "{{state}}" directly during render.',
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

export default noDerivedState;
