import { createRule } from "$oxc-utilities/create-rule";
import {
	getMemberPropertyName,
	isCallExpression,
	isIdentifierName,
	isMemberExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isPromiseDelayAwaitCall({ callee }: ESTree.CallExpression): boolean {
	if (!isMemberExpression(callee) || getMemberPropertyName(callee) !== "await" || !isCallExpression(callee.object)) {
		return false;
	}

	const delayCallee = callee.object.callee;
	return !isMemberExpression(delayCallee) ||
		!isIdentifierName(delayCallee.object) ||
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
				if (!isMemberExpression(callee)) return;
				if (!isIdentifierName(callee.object) || callee.object.name !== "task") return;
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
