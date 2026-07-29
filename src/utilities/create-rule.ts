import type {
	CreateOnceRule,
	CreateRule,
	DefaultOptionsFromSchema,
	RuleSchemaDefinition,
} from "oxlint-plugin-utilities";

const BASE_URL = "https://docs.howmanysmall.com/small-rules/rules";

/**
 * Creates a rule with automatic documentation URL generation.
 *
 * URLs follow the pattern: `https://docs.howmanysmall.com/small-rules/rules/{category}/{name}/`
 */
export function createRule<
	const TSchema extends RuleSchemaDefinition | undefined = undefined,
	TMessageIds extends string = string,
	const TDefaultOptions extends DefaultOptionsFromSchema<TSchema> | undefined = undefined,
>(
	name: string,
	category: string,
	rule: CreateRule<TSchema, TMessageIds, TDefaultOptions>,
): CreateRule<TSchema, TMessageIds, TDefaultOptions>;
export function createRule<
	const TSchema extends RuleSchemaDefinition | undefined = undefined,
	TMessageIds extends string = string,
	const TDefaultOptions extends DefaultOptionsFromSchema<TSchema> | undefined = undefined,
>(
	name: string,
	category: string,
	rule: CreateOnceRule<TSchema, TMessageIds, TDefaultOptions>,
): CreateOnceRule<TSchema, TMessageIds, TDefaultOptions>;
export function createRule(
	name: string,
	category: string,
	rule: CreateRule | CreateOnceRule,
): CreateRule | CreateOnceRule {
	const url = `${BASE_URL}/${category}/${name}/`;

	if (rule.meta !== undefined) {
		return {
			...rule,
			meta: {
				...rule.meta,
				docs: { ...rule.meta.docs, url },
			},
		};
	}

	return { ...rule };
}
