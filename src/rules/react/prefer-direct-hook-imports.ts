import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ENVIRONMENT_SCHEMA,
	getReactSourcesFromOptions,
	isReactImportDefinition,
} from "$oxc-utilities/react-utilities";
import { isStringArray } from "$oxc-utilities/type-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

const HOOK_NAME_PATTERN = /^use[A-Z]/v;

function isReactNamespaceSource(variable: ScopeVariable | undefined, reactSources: ReadonlySet<string>): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- React namespace checks only reach default or namespace import definitions. @preserve */
		if (definition.node.type === "ImportDefaultSpecifier" || definition.node.type === "ImportNamespaceSpecifier") {
			return true;
		}
	}

	return false;
}

interface PreferDirectHookImportsOptions {
	readonly allowedHooks?: ReadonlyArray<string>;
	readonly environment?: "roblox-ts" | "standard";
}

function normalizeOptions(raw: unknown): { readonly allowedHooks: ReadonlySet<string> } {
	if (typeof raw !== "object" || raw === null) return { allowedHooks: new Set() };

	const options = raw as PreferDirectHookImportsOptions;
	return { allowedHooks: new Set(isStringArray(options.allowedHooks) ? options.allowedHooks : []) };
}

const preferDirectHookImports = createRule("prefer-direct-hook-imports", "react", {
	create(context) {
		const reactSources = getReactSourcesFromOptions(context.options[0]);
		const { allowedHooks } = normalizeOptions(context.options[0]);
		const { sourceCode } = context;

		return {
			CallExpression(node): void {
				const { callee } = node;
				if (callee.type !== "MemberExpression" || callee.computed) return;
				if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return;

				const propertyName = callee.property.name;
				if (!HOOK_NAME_PATTERN.test(propertyName)) return;
				if (allowedHooks.has(propertyName)) return;

				const variable = getVariableByName(sourceCode.getScope(callee.object), callee.object.name);
				if (!isReactNamespaceSource(variable, reactSources)) return;

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
