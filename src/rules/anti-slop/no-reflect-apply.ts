// Vendored from src/rules/no-reflect-apply.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { isGlobalReflectMethodCall } from "$oxc-utilities/anti-slop/reflect-method";
import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const noReflectApply = createRule("no-reflect-apply", "anti-slop", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
				if (isGlobalReflectMethodCall(context.sourceCode, node.callee, "apply")) {
					context.report({ messageId: "reflectApply", node });
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Disallow Reflect.apply; call typed functions directly or model dynamic dispatch behind an interface.",
			recommended: true,
		},
		messages: {
			reflectApply:
				"Replace `Reflect.apply` with a typed function call. Model dynamic dispatch behind a named interface.",
		},
		type: "problem",
	},
});

export default noReflectApply;
