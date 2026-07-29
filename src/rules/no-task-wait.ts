import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isPromiseDelayAwaitCall(node: ESTree.CallExpression): boolean {
	const { callee } = node;
	if (
		callee.type !== "MemberExpression" ||
		getMemberPropertyName(callee) !== "await" ||
		callee.object.type !== "CallExpression"
	) {
		return false;
	}

	const delayCallee = callee.object.callee;
	return delayCallee.type !== "MemberExpression" ||
		delayCallee.object.type !== "Identifier" ||
		delayCallee.object.name !== "Promise"
		? false
		: getMemberPropertyName(delayCallee) === "delay";
}

const noTaskWait = createRule("no-task-wait", "roblox", {
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
