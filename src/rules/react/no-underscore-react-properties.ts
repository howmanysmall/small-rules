import { createRule } from "$oxc-utilities/create-rule";
import { isJsxIdentifier } from "$oxc-utilities/oxc-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const noUnderscoreReactProperties = createRule("no-underscore-react-props", "react", {
	createOnce(context): Visitor {
		return {
			JSXAttribute(node): void {
				if (!isJsxIdentifier(node.name) || !node.name.name.startsWith("_")) return;

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
