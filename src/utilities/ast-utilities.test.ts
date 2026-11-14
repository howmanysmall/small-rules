import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";
import { defineRule } from "oxlint-plugin-utilities";

import { forEachNode, getResolvedVariable, STOP_NODE_TRAVERSAL } from "$oxc-utilities/ast-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const messages = { callCount: "callCount", stopped: "stopped" };
const resolutionMessages = { resolved: "resolved to {{definitions}} definition(s)", unresolved: "unresolved" };

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

				if (callCount === 1) {
					context.report({ messageId: "callCount", node });
				} else if (callCount === 0) {
					context.report({ messageId: "stopped", node });
				}
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

const resolutionRule = defineRule({
	create(context): Visitor {
		return {
			Identifier(node): void {
				const variable = getResolvedVariable(context.sourceCode, node);
				if (variable === undefined) {
					context.report({ messageId: "unresolved", node });
				} else {
					context.report({
						data: { definitions: String(variable.defs.length) },
						messageId: "resolved",
						node,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: { messages: resolutionMessages, schema: [], type: "problem" },
});

describe("getResolvedVariable", () => {
	js.run("get-resolved-variable", resolutionRule, {
		invalid: [
			{
				// The declared name is a binding, not a reference; the use
				// resolves to it.
				code: "const value = 1; value;",
				errors: [{ messageId: "unresolved" }, { data: { definitions: "1" }, messageId: "resolved" }],
			},
			{
				// A reference no binding declares stays unresolved.
				code: "missing;",
				errors: [{ messageId: "unresolved" }],
			},
			{
				// A binding inside a function climbs every enclosing scope
				// before giving up.
				code: "function outer() { const inner = 1; return inner; }",
				errors: [
					{ messageId: "unresolved" },
					{ messageId: "unresolved" },
					{ data: { definitions: "1" }, messageId: "resolved" },
				],
			},
		],
		valid: [],
	});
});
