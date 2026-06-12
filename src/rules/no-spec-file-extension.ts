import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const SPEC_EXTENSION_PATTERN = /\.spec\.(?:ts|tsx)$/u;

const noSpecFileExtension = defineRule({
	create(context): Visitor {
		return {
			Program(node): void {
				const { filename } = context;
				if (!(filename && SPEC_EXTENSION_PATTERN.test(filename))) return;

				context.report({
					messageId: "noSpecFileExtension",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow the .spec.{ts,tsx} file extension for test files. Use .test.{ts,tsx} instead.",
			recommended: true,
		},
		messages: {
			noSpecFileExtension:
				"Test files must use .test.ts or .test.tsx instead of .spec.ts or .spec.tsx. Rename this file to use the .test extension.",
		},
		schema: [],
		type: "problem",
	},
});

export default noSpecFileExtension;
