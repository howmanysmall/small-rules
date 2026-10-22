import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-real-temporary-directory";

const TEMPORARY_DIRECTORY_ERROR = [{ messageId: "noRealTemporaryDirectory" }];
const TMP_PACKAGE = [{ additionalFunctions: [{ functions: ["dirSync", "promises.dir"], source: "tmp" }] }];
const NODE_FS_EXTRA = [
	{
		additionalFunctions: [
			{ functions: ["mkdtempDisposableSync", "promises.mkdtempDisposable", "mkdtemp.native"], source: "node:fs" },
		],
	},
];

describe("no-real-temporary-directory", () => {
	ts.run("no-real-temporary-directory", rule, {
		invalid: [
			{
				code: [
					'import { mkdtemp } from "node:fs/promises";',
					'import { tmpdir } from "node:os";',
					'import { join } from "node:path";',
					'const directory = await mkdtemp(join(tmpdir(), "case-"));',
				].join("\n"),
				errors: [{ messageId: "noRealTemporaryDirectory" }, { messageId: "noRealTemporaryDirectory" }],
				documentation: { id: "fail", title: "Real temp directory in a unit test" },
			},
			{ code: "import { tmpdir } from 'node:os'; tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { tmpdir } from 'os'; tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { tmpdir as t } from 'node:os'; t();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import * as os from 'node:os'; os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import os from 'node:os'; os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { default as os } from 'node:os'; os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { mkdtemp } from 'node:fs/promises'; mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { mkdtemp } from 'fs/promises'; mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { mkdtempSync } from 'node:fs'; mkdtempSync('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { mkdtemp as make } from 'fs'; make('x', cb);", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import * as fs from 'node:fs'; fs.mkdtempSync('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import fs from 'node:fs'; fs.promises.mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { promises } from 'node:fs'; promises.mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import { promises as p } from 'node:fs'; p.mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "import fsp from 'node:fs/promises'; await fsp.mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const os = require('node:os'); os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const { tmpdir } = require('os'); tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const { tmpdir: t } = require('node:os'); t();", errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "const { promises: { mkdtemp } } = require('fs'); mkdtemp('x');",
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{ code: "require('node:os').tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const os = await import('node:os'); os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const { tmpdir } = await import('node:os'); tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "const { default: os } = await import('node:os'); os.tmpdir();",
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{ code: "(await import('node:fs/promises')).mkdtemp('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const fs = await import('fs'); fs.default.mkdtempSync('x');", errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "import { tmpdir } from 'node:os'; function f() { return tmpdir(); }",
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{ code: "import { 'tmpdir' as t } from 'node:os'; t();", errors: TEMPORARY_DIRECTORY_ERROR },
			{ code: "const { 'tmpdir': t } = require('node:os'); t();", errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "const { mkdtemp, mkdtempSync } = require('fs'); mkdtempSync('x');",
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{ code: "const { ...os } = require('node:os'); os.tmpdir();", errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "import { tmpdir } from 'node:os'; tmpdir(); tmpdir();",
				errors: [...TEMPORARY_DIRECTORY_ERROR, ...TEMPORARY_DIRECTORY_ERROR],
			},
			{ code: "import tmp from 'tmp'; tmp.dirSync();", options: TMP_PACKAGE, errors: TEMPORARY_DIRECTORY_ERROR },
			{
				code: "import { promises } from 'tmp'; promises.dir();",
				options: TMP_PACKAGE,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{
				code: "import { tmpdir } from 'node:os'; tmpdir();",
				options: TMP_PACKAGE,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{
				code: "import fs from 'fs'; fs.mkdtempDisposableSync('x');",
				options: NODE_FS_EXTRA,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{
				code: "import fs from 'fs'; fs.mkdtempSync('x');",
				options: NODE_FS_EXTRA,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{
				code: "import fs from 'fs'; fs.promises.mkdtempDisposable('x');",
				options: NODE_FS_EXTRA,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
			{
				code: "import { mkdtemp } from 'fs'; mkdtemp('x', cb);",
				options: NODE_FS_EXTRA,
				errors: TEMPORARY_DIRECTORY_ERROR,
			},
		],
		valid: [
			{
				code: ['import { fs } from "memfs";', "", 'const directory = fs.mkdtempSync("/case-");'].join("\n"),
				documentation: { id: "pass", title: "In-memory file system" },
			},
			"import { vol } from 'memfs'; vol.mkdtempSync('x');",
			"import { fs } from 'memfs'; fs.mkdtempSync('x'); fs.promises.mkdtemp('x');",
			"import * as memfs from 'memfs'; memfs.fs.mkdtempSync('x');",
			"function tmpdir() { return '/t'; } tmpdir();",
			"const tmpdir = () => '/t'; tmpdir();",
			"import { tmpdir } from 'node:os'; function f(tmpdir) { return tmpdir(); }",
			"import * as os from 'node:os'; os.homedir(); os.tmpdir;",
			"import { readFileSync } from 'node:fs'; readFileSync('x');",
			"import * as fs from 'node:fs'; fs[name]('x'); fs.promises.readFile('x');",
			"const fs = require('node:fs'); fs.readFileSync('x');",
			"const fs = require(name); fs.mkdtempSync('x');",
			"const fs = makeFs(); fs.mkdtempSync('x');",
			"const { tmpdir } = load('node:os'); tmpdir();",
			"const [tmpdir] = require('node:os'); tmpdir();",
			"const { [key]: tmpdir } = require('node:os'); tmpdir();",
			"import type { tmpdir } from 'node:os';",
			"export { tmpdir } from 'node:os';",
			"other.tmpdir();",
			"const { 1: tmpdir } = require('node:os'); tmpdir();",
			"const { tmpdir } = require('node:os', extra); tmpdir();",
			"const { tmpdir } = require(`node:os`); tmpdir();",
			"const os = import(name); os.tmpdir();",
			"let os; os = require('node:os');",
			"import { tmpdir } from 'node:os'; const call = tmpdir; tmpdir.call();",
			"import { tmpdir } from 'node:os'; tmpdir = other;",
			"import { type tmpdir } from 'node:os';",
			"import { homedir } from 'node:os'; homedir();",
			"import * as fs from 'node:fs'; fs.promises.default.mkdtemp('x'); fs.toString();",
			"require('node:os').homedir();",
			"import tmp from 'tmp'; tmp.dirSync();",
			"import fs from 'fs'; fs.mkdtempDisposableSync('x');",
			{ code: "import tmp from 'tmp'; tmp.fileSync(); tmp.promises.file();", options: TMP_PACKAGE },
		],
	});
});
