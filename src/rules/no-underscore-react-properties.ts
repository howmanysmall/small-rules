import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noUnderscoreReactProperties = defineRule({
	createOnce(context): Visitor {
		return {
			JSXAttribute(node): void {
				if (node.name.type !== "JSXIdentifier" || !node.name.name.startsWith("_")) return;

				context.report({
					data: { propName: node.name.name },
					messageId: "noUnderscoreReactProperty",
					node: node.name,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Ban React property names that begin with an underscore in JSX.",
		},
		messages: {
			noUnderscoreReactProperty:
				"React prop '{{propName}}' starts with '_'. Remove the leading underscore from the prop name.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default noUnderscoreReactProperties;
