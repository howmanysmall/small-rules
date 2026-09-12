import { Predicate } from "effect";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isIdentifierName, isMemberExpression } from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA, getReactSourcesFromOptions, isReactNamespaceImport } from "$oxc-utilities/react-utilities";
import { isStringArray } from "$oxc-utilities/type-utilities";

import type { InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

const HOOK_NAME_PATTERN = /^use[A-Z]/v;

type RuleOptions = InferContextFromRule<typeof preferDirectHookImports>["options"][0];
interface NormalizedOptions {
	readonly allowedHooks: ReadonlySet<string>;
}

function normalizeOptions(raw: RuleOptions): NormalizedOptions {
	if (!Predicate.isObject(raw)) return { allowedHooks: new Set() };
	return { allowedHooks: new Set(isStringArray(raw.allowedHooks) ? raw.allowedHooks : []) };
}

const preferDirectHookImports = createRule("prefer-direct-hook-imports", "react", {
	create(context) {
		const reactSources = getReactSourcesFromOptions(context.options[0]);
		const { allowedHooks } = normalizeOptions(context.options[0]);
		const { sourceCode } = context;

		return {
			CallExpression(node): void {
				const { callee } = node;
				if (!isMemberExpression(callee) || callee.computed) return;
				if (!isIdentifierName(callee.object) || !isIdentifierName(callee.property)) return;

				const propertyName = callee.property.name;
				if (!HOOK_NAME_PATTERN.test(propertyName) || allowedHooks.has(propertyName)) return;

				const variable = getVariableByName(sourceCode.getScope(callee.object), callee.object.name);
				if (!isReactNamespaceImport(variable, reactSources)) return;

				context.report({
					data: { hookName: propertyName },
					messageId: "preferDirectHookImport",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer importing React hooks directly instead of calling them via the React namespace.",
			recommended: true,
		},
		messages: {
			preferDirectHookImport: "Import `{{hookName}}` directly instead of calling `React.{{hookName}}`.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowedHooks: {
						description: "Hook names that are allowed to be called via React namespace.",
						items: { type: "string" },
						type: "array",
					},
					environment: ENVIRONMENT_SCHEMA,
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default preferDirectHookImports;
