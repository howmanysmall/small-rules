import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const onlyTypeImports = defineRule({
	create(context): Visitor {
		return {
			ImportDeclaration(node): void {
				if (node.importKind !== "type") {
					context.report({ messageId: "onlyTypeImports", node });
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Require all imports to be type-only imports. Benchmarks cannot import non-types because the benchmarker plugin will throw an error.",
			recommended: true,
		},
		messages: {
			onlyTypeImports:
				"Benchmarks must use `import type` to avoid runtime imports that break the benchmarker plugin.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default onlyTypeImports;
