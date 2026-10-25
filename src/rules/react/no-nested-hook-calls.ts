import { createRule } from "$oxc-utilities/create-rule";
import { getHookName } from "$oxc-utilities/react-hook-utilities";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

/** Mirrors the React Compiler's `Environment.isHookName`. */
const HOOK_NAME_PATTERN = /^use[A-Z0-9]/u;

interface HookCallEntry {
	readonly name: string;
	readonly call: ESTree.CallExpression;
}

function getReactHookName(node: ESTree.CallExpression): string | undefined {
	const hookName = getHookName(node);
	return hookName !== undefined && HOOK_NAME_PATTERN.test(hookName) ? hookName : undefined;
}

const noNestedHookCalls = createRule("no-nested-hook-calls", "react", {
	createOnce(context): VisitorWithHooks {
		// Hook calls still being traversed, innermost last. A function pushes
		// `undefined` so hooks called in its body never see the hook call that
		// received the function.
		let enclosing: Array<HookCallEntry | undefined>;

		function enterFunction(): void {
			enclosing.push(undefined);
		}

		function exitFunction(): void {
			enclosing.pop();
		}

		return {
			ArrowFunctionExpression: enterFunction,
			"ArrowFunctionExpression:exit": exitFunction,
			before(): void {
				enclosing = [];
			},
			CallExpression(node): void {
				const name = getReactHookName(node);
				if (name === undefined) return;

				const outer = enclosing.at(-1);
				if (outer !== undefined) {
					context.report({
						data: { inner: name, outer: outer.name },
						messageId: "nestedHookCall",
						node,
					});
				}

				enclosing.push({ name, call: node });
			},
			"CallExpression:exit"(node): void {
				if (enclosing.at(-1)?.call === node) {
					enclosing.pop();
				}
			},
			FunctionDeclaration: enterFunction,
			"FunctionDeclaration:exit": exitFunction,
			FunctionExpression: enterFunction,
			"FunctionExpression:exit": exitFunction,
		};
	},
	meta: {
		docs: {
			description: "Disallow nesting a hook call inside another hook call.",
			recommended: true,
		},
		messages: {
			nestedHookCall: "`{{inner}}` is called inside the `{{outer}}` call. Assign its result to a variable first.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default noNestedHookCalls;
