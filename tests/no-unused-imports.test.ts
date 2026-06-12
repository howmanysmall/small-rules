import { describe } from "vitest";
import rule from "$oxc-rules/no-unused-imports";

import { ts } from "./rule-testers";

describe("no-unused-imports", () => {
	// @ts-expect-error -- this thing is dumb.
	ts.run("no-unused-imports", rule, {
		invalid: [
			{
				code: "import UnusedDefault from './module';",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import * as UnusedNamespace from './module';",
				errors: [{ data: { identifierName: "UnusedNamespace" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import type { TypeOnly } from './types';",
				errors: [{ data: { identifierName: "TypeOnly" }, messageId: "unusedImport" }],
				output: "",
			},
			{
				code: "import { unused1, unused2 } from './module';",
				errors: [
					{ data: { identifierName: "unused1" }, messageId: "unusedImport" },
					{ data: { identifierName: "unused2" }, messageId: "unusedImport" },
				],
				output: "import { unused2 } from './module';",
			},
			{
				code: "/** @see {unusedFunction} */\nimport { unusedFunction } from './utils';",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
				options: [{ checkJSDoc: false }],
				output: "/** @see {unusedFunction} */\n",
			},
			{
				code: "import { used, unused } from './module';\nused();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { used } from './module';\nused();",
			},
		],
		valid: [
			{
				code: "import UsedDefault from './module';\nUsedDefault();",
			},
			{
				code: "import { usedFunction } from './utils';\nusedFunction();",
			},
			{
				code: "import * as UsedNamespace from './module';\nUsedNamespace.foo();",
			},
			{
				code: "import './polyfills';",
			},
			{
				code: "export { x } from './module';",
			},
			{
				code: "/** @see {usedFunction} */\nimport { usedFunction } from './utils';",
			},
			{
				code: "/** {@link usedFunction} */\nimport { usedFunction } from './utils';",
			},
			{
				code: "/** @type {usedFunction} */\nimport { usedFunction } from './utils';",
			},
		],
	});
});
