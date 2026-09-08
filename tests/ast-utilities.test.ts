import { describe } from "vitest";
import { defineRule } from "oxlint-plugin-utilities";

import { forEachNode, STOP_NODE_TRAVERSAL } from "$oxc-utilities/ast-utilities";

import { js } from "./rule-testers";

import type { Visitor } from "oxlint-plugin-utilities";

const messages = { callCount: "callCount", stopped: "stopped" };

const traversalRule = defineRule({
	create(context): Visitor {
		return {
			"Program:exit"(node): void {
				let callCount = 0;
				forEachNode(node, (current) => {
					if (current.type === "FunctionDeclaration") return false;
					if (current.type === "CallExpression") {
						if (current.callee.type === "Identifier" && current.callee.name === "stop") {
							return STOP_NODE_TRAVERSAL;
						}
						callCount += 1;
					}
					return true;
				});
				if (callCount === 1) context.report({ messageId: "callCount", node });
				else if (callCount === 0) context.report({ messageId: "stopped", node });
			},
		} satisfies Visitor;
	},
	meta: { messages, schema: [], type: "problem" },
});

describe("forEachNode", () => {
	js.run("for-each-node", traversalRule, {
		invalid: [
			{
				code: "outer(); const values = [,];",
				errors: [{ messageId: "callCount" }],
			},
			{
				code: "outer(); function nested() { inner(); }",
				errors: [{ messageId: "callCount" }],
			},
			{
				code: "stop(); outer();",
				errors: [{ messageId: "stopped" }],
			},
		],
		valid: [],
	});
});
