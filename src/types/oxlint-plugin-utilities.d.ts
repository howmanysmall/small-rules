import type { CreateOnceRule, InferOptionsFromSchema, RuleSchemaDefinition } from "oxlint-plugin-utilities";

declare module "oxlint-plugin-utilities" {
	export function defineRule<
		const TSchema extends RuleSchemaDefinition | undefined = undefined,
		TMessageIds extends string = string,
	>(
		rule: CreateOnceRule<InferOptionsFromSchema<TSchema>, TMessageIds, TSchema>,
	): CreateOnceRule<InferOptionsFromSchema<TSchema>, TMessageIds, TSchema>;
}
