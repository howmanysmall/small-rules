import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

import type { CreateRule, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

const REACT_EFFECT_RULE_SCHEMA = [
	{
		additionalProperties: false,
		properties: { environment: ENVIRONMENT_SCHEMA },
		type: "object",
	},
] as const;

type ReactEffectRuleSchema = typeof REACT_EFFECT_RULE_SCHEMA;

export type ReactEffectRuleContext<TMessageIds extends string> = InferContextFromRule<
	CreateRule<ReactEffectRuleSchema, TMessageIds>
>;

export interface ReactEffectRuleDefinition<TMessageIds extends string> {
	readonly checkEffect: (
		context: ReactEffectRuleContext<TMessageIds>,
		analysis: ReactEffectAnalysis,
		effect: ReactEffect,
	) => void;
	readonly description: string;
	readonly messages: Readonly<Record<TMessageIds, string>>;
	/** Skips effects that return a cleanup function. */
	readonly skipEffectsWithCleanup?: boolean;
}

export function createReactEffectRule<TMessageIds extends string>(
	name: string,
	{ checkEffect, description, messages, skipEffectsWithCleanup = false }: ReactEffectRuleDefinition<TMessageIds>,
): CreateRule<ReactEffectRuleSchema, TMessageIds> {
	return createRule(name, "react", {
		create(context): Visitor {
			const environment = getEnvironment(context.options[0]);
			const analysis = getReactEffectAnalysis(context.sourceCode, environment);

			return {
				Program(): void {
					for (const effect of analysis.effects) {
						if (skipEffectsWithCleanup && effect.cleanup !== undefined) continue;
						checkEffect(context, analysis, effect);
					}
				},
			} satisfies Visitor;
		},
		meta: {
			docs: { description, recommended: true },
			messages,
			schema: REACT_EFFECT_RULE_SCHEMA,
			type: "suggestion",
		},
	});
}
