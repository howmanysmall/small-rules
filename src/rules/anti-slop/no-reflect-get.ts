// Vendored from src/rules/no-reflect-get.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to oxlint-plugin-utilities createRule API and local path aliases.
import { isGlobalReflectMethodCall } from "$oxc-utilities/anti-slop/reflect-method";
import { createRule } from "$oxc-utilities/create-rule";
import { isSuper, isV8IntrinsicExpression } from "$oxc-utilities/oxc-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noReflectGet = createRule("no-reflect-get", "anti-slop", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				const { callee } = node;
				/* v8 ignore next -- Oxc's parser does not produce V8 intrinsic call expressions. @preserve */
				if (isSuper(callee) || isV8IntrinsicExpression(callee)) return;
				if (isGlobalReflectMethodCall(context.sourceCode, callee, "get")) {
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
