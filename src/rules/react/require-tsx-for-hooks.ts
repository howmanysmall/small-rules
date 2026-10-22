import { isCallbackFunction, isIdentifier } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

/**
 * Mirrors the React Compiler's `Environment.isHookName`. A name the compiler
 * treats as a hook is a name this rule has to place in a `.tsx` file.
 */
const HOOK_NAME = /^use[A-Z0-9]/u;

function isPlainTypeScriptFile(filename: string): boolean {
	return filename.endsWith(".ts") && !filename.endsWith(".d.ts");
}

const requireTsxForHooks = createRule("require-tsx-for-hooks", "react", {
	create(context): Visitor {
		if (!isPlainTypeScriptFile(context.filename)) return {};

		function reportHook(node: ESTree.BindingIdentifier): void {
			context.report({ data: { name: node.name }, messageId: "requireTsxForHooks", node });
		}

		return {
			FunctionDeclaration({ id }): void {
				if (id !== null && HOOK_NAME.test(id.name)) reportHook(id);
			},
			VariableDeclarator({ id, init }): void {
				if (isIdentifier(id) && HOOK_NAME.test(id.name) && isCallbackFunction(init)) reportHook(id);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require React hooks to be declared in a `.tsx` file.",
		},
		messages: {
			requireTsxForHooks:
				"`{{name}}` is a React hook declared in a `.ts` file. Rename the file to `.tsx`: tooling that treats `.tsx` as the marker for React code, such as React lint rules scoped to `.tsx` and the React Compiler, skips it otherwise.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default requireTsxForHooks;
