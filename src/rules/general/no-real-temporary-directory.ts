import { createRule } from "$oxc-utilities/create-rule";
import { createApiTrees, createModuleCallVisitor } from "$oxc-utilities/module-calls";

import type { Visitor } from "oxlint-plugin-utilities";

import type { ModuleFunctions } from "$oxc-utilities/module-calls";

const DEFAULT_FUNCTIONS: ReadonlyArray<ModuleFunctions> = [
	{ functions: ["mkdtemp", "mkdtempSync", "promises.mkdtemp"], source: "fs" },
	{ functions: ["mkdtemp"], source: "fs/promises" },
	{ functions: ["tmpdir"], source: "os" },
];
const DEFAULT_MODULES = createApiTrees(DEFAULT_FUNCTIONS);

const noRealTemporaryDirectory = createRule("no-real-temporary-directory", "general", {
	create(context): Visitor {
		const [options] = context.options;
		const additionalFunctions = options?.additionalFunctions ?? [];
		const modules =
			additionalFunctions.length === 0
				? DEFAULT_MODULES
				: createApiTrees([...DEFAULT_FUNCTIONS, ...additionalFunctions]);

		return createModuleCallVisitor(context.sourceCode, modules, (call) => {
			context.report({ messageId: "noRealTemporaryDirectory", node: call });
		});
	},
	meta: {
		docs: { description: "Disallow real temp directories (`os.tmpdir`, `fs.mkdtemp`) in unit tests." },
		messages: {
			noRealTemporaryDirectory:
				"Unit tests must not touch real temp directories. Use memfs through an injected fs seam, or move the test to a *.integration.test.ts file.",
		},
		schema: [
			{
				additionalProperties: false,
				default: { additionalFunctions: [] },
				properties: {
					additionalFunctions: {
						default: [],
						description:
							"More functions that create or locate a real temp directory, grouped by the module that exports them",
						items: {
							additionalProperties: false,
							properties: {
								functions: {
									description:
										"The exported functions, as dotted paths for namespaces, such as `dirSync` or `promises.dir`",
									items: { type: "string" },
									minItems: 1,
									type: "array",
								},
								source: {
									description: "The module specifier, such as `tmp`; a `node:` prefix is optional",
									type: "string",
								},
							},
							required: ["functions", "source"],
							type: "object",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noRealTemporaryDirectory;
