import { createRule } from "$oxc-utilities/create-rule";

import type { Visitor } from "oxlint-plugin-utilities";

const startsWithVerb = createRule("starts-with-verb", "english", {
	create(context): Visitor {
		return {} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Function or method name should begin with a verb",
			recommended: true,
		},
		messages: {
			isConstant: "'{{name}}' is constant.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowList: {
						items: { type: "string" },
						type: "array",
					},
					denyList: {
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		] as const,
		type: "suggestion",
	},
});

export default startsWithVerb;
