import { describe } from "vitest";
import rule from "$oxc-rules/no-unused-imports";

import { ts } from "./rule-testers";

describe("no-unused-imports", () => {
	ts.run("no-unused-imports", rule, {
		invalid: [
			{
				code: "import UnusedDefault from './module';",
				documentation: { id: "fail", title: "Unused default import removal" },
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
			{
				code: "import UnusedDefault, { used } from './module';\nused();",
				errors: [{ data: { identifierName: "UnusedDefault" }, messageId: "unusedImport" }],
				output: "import { used } from './module';\nused();",
			},
			{
				code: "import { unused, used } from './module';\nused();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { used } from './module';\nused();",
			},
			{
				code: "import { used, unused, other } from './module';\nused();\nother();",
				errors: [{ data: { identifierName: "unused" }, messageId: "unusedImport" }],
				output: "import { used,  other } from './module';\nused();\nother();",
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
