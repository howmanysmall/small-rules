// Vendored from src/rules/no-reflect-apply.ts@c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.

import { isSuper, isV8IntrinsicExpression } from "@small-rules/oxlint-utilities";

import { isGlobalReflectMethodCall } from "$oxc-utilities/anti-slop/reflect-method";
import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const noReflectApply = createRule("no-reflect-apply", "anti-slop", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				const { callee } = node;
				/* v8 ignore next -- Oxc's parser does not produce V8 intrinsic call expressions. @preserve */
				if (isSuper(callee) || isV8IntrinsicExpression(callee)) return;
				if (isGlobalReflectMethodCall(context.sourceCode, callee, "apply")) {
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
