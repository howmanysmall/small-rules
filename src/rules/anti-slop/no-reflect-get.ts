// Vendored from src/rules/no-reflect-get.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.
import { isGlobalReflectMethodCall } from "$oxc-utilities/anti-slop/reflect-method";
import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const noReflectGet = createRule("no-reflect-get", "anti-slop", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
				if (isGlobalReflectMethodCall(context.sourceCode, node.callee, "get")) {
					context.report({ messageId: "reflectGet", node });
				}
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow Reflect.get; use typed property access or parse dynamic input into a domain type.",
			recommended: true,
		},
		messages: {
			reflectGet:
				"Replace `Reflect.get` with typed property access. Parse dynamic input into a named domain type before reading it.",
		},
		type: "problem",
	},
});

export default noReflectGet;
