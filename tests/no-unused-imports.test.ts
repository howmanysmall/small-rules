import { describe } from "vitest";

import rule from "$oxc-rules/general/no-unused-imports";

import { ts } from "./rule-testers";

describe("no-unused-imports", () => {
	ts.run("no-unused-imports", rule, {
		invalid: [
			{
				code: "import UnusedDefault from './module';",
				output: "",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				documentation: { id: "fail", title: "Unused default import removal" },
			},
			{
				code: "import { unusedFunction } from './utils';",
				output: "",
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
			},
			{
				code: "import * as UnusedNamespace from './module';",
				output: "",
				errors: [{ data: { identifierName: "UnusedNamespace" }, messageId: "unusedImport" }],
			},
			{
				code: "import type { TypeOnly } from './types';",
				output: "",
				errors: [{ data: { identifierName: "TypeOnly" }, messageId: "unusedImport" }],
			},
			{
				code: "import { unused1, unused2 } from './module';",
				output: "import { unused2 } from './module';",
				errors: [
					{ data: { identifierName: "unused1" }, messageId: "unusedImport" },
					{ data: { identifierName: "unused2" }, messageId: "unusedImport" },
				],
			},
			{
				code: "/** @see {unusedFunction} */\nimport { unusedFunction } from './utils';",
				output: "/** @see {unusedFunction} */\n",
				options: [{ checkJSDoc: false }],
				errors: [{ data: { identifierName: "unusedFunction" }, messageId: "unusedImport" }],
			},
			{
				code: "import { used, unused } from './module';\nused();",
				output: "import { used } from './module';\nused();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
			},
			{
				code: "import UnusedDefault, { used } from './module';\nused();",
				output: "import { used } from './module';\nused();",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
			},
			{
				code: "import { unused, used } from './module';\nused();",
				output: "import { used } from './module';\nused();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
			},
			{
				code: "import { used, unused, other } from './module';\nused();\nother();",
				output: "import { used,  other } from './module';\nused();\nother();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
			},
		],
		valid: [
			{
				code: "import UsedDefault from './module';\nUsedDefault();",
				documentation: { id: "pass", title: "Used default import" },
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
			{
				code: "/** @param {UsedType} value */\nimport { UsedType } from './types';",
			},
		],
	});
});
