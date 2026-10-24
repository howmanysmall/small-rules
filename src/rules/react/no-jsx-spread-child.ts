import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const noJsxSpreadChild = createRule("no-jsx-spread-child", "react", {
	createOnce(context): Visitor {
		return {
			JSXSpreadChild(node): void {
				context.report({ messageId: "noJsxSpreadChild", node });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow a spread in JSX child position.",
		},
		messages: {
			noJsxSpreadChild:
				"A spread in JSX child position parses as a `JSXSpreadChild`, which the React Compiler cannot emit back, so the whole component throws and memoizes nothing. Drop the `...`: React flattens an array child. Keep a `key` on every element.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default noJsxSpreadChild;
