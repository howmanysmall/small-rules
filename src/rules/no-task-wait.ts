import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isPromiseDelayAwaitCall(node: ESTree.CallExpression): boolean {
	const { callee } = node;
	if (callee.type !== "MemberExpression") return false;
	if (getMemberPropertyName(callee) !== "await") return false;
	if (callee.object.type !== "CallExpression") return false;

	const delayCallee = callee.object.callee;
	if (delayCallee.type !== "MemberExpression") return false;
	if (delayCallee.object.type !== "Identifier" || delayCallee.object.name !== "Promise") return false;
	return getMemberPropertyName(delayCallee) === "delay";
}

const noTaskWait = defineRule({
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				if (isPromiseDelayAwaitCall(node)) {
					context.report({ messageId: "noPromiseDelayAwait", node });
					return;
				}

				const { callee } = node;
				if (callee.type !== "MemberExpression") return;
				if (callee.object.type !== "Identifier" || callee.object.name !== "task") return;
				if (getMemberPropertyName(callee) !== "wait") return;

				context.report({ messageId: "noTaskWait", node });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow task.wait() and Promise.delay(...).await() calls.",
		},
		messages: {
			noPromiseDelayAwait:
				"Do not use Promise.delay(...).await() in tests. Advance deterministic schedulers or wait for the actual condition instead.",
			noTaskWait:
				"Do not use task.wait() in tests. Advance deterministic schedulers or wait for the actual condition instead.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default noTaskWait;
