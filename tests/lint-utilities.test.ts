import { describe } from "vitest";
import { isHookCall } from "$oxc-utilities/lint-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester } from "./rule-testers";

import type { Visitor } from "oxlint-plugin-utilities";

const tester = createRuleTester({ language: "js", sourceType: "module" });

describe("lint utilities", () => {
	const messages = {
		hook: "hook",
	};

	const rule = defineRule({
		create(context): Visitor {
			const hooks = new Set(["useMemo", "useEffect"]);

			return {
				CallExpression(node): void {
					if (isHookCall(node, hooks)) context.report({ messageId: "hook", node });
				},
			} satisfies Visitor;
		},
		meta: { messages, schema: [], type: "problem" },
	});

	tester.run("lint-utilities", rule, {
		invalid: [{ code: "useEffect();", errors: [{ messageId: "hook" }] }],
		valid: ["useReducer();"],
	});
});
