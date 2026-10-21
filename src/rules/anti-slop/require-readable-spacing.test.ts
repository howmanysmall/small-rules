import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/anti-slop/require-readable-spacing";

describe("require-readable-spacing", () => {
	ts.run("require-readable-spacing", rule, {
		invalid: [
			{
				code: [
					'import { readFile } from "node:fs/promises";',
					"export async function readConfig(path: string) {",
					'\tconst text = await readFile(path, "utf8");',
					"\tconst config = JSON.parse(text);",
					"\treturn config;",
					"}",
				].join("\n"),
				output: [
					'import { readFile } from "node:fs/promises";',
					"",
					"export async function readConfig(path: string) {",
					'\tconst text = await readFile(path, "utf8");',
					"\tconst config = JSON.parse(text);",
					"",
					"\treturn config;",
					"}",
				].join("\n"),
				errors: [{ messageId: "expectedBlankLine" }, { messageId: "expectedBlankLine" }],
				documentation: { id: "fail", title: "cramped statement groups" },
			},
			{
				code: "const a = 1;\n/** B docs. */\nconst b = 2;",
				output: "const a = 1;\n\n/** B docs. */\nconst b = 2;",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1;\n// b\nconst b = 2;",
				output: "const a = 1;\n\n// b\nconst b = 2;",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1;\nconst b = {\n};\nconst c = 3;",
				output: "const a = 1;\n\nconst b = {\n};\n\nconst c = 3;",
				errors: [
					{ column: 1, endColumn: 12, endLine: 2, line: 2, messageId: "expectedBlankLine" },
					{ column: 1, endColumn: 13, endLine: 4, line: 4, messageId: "expectedBlankLine" },
				],
			},
			{
				code: "const a = 1;\nfoo(a);",
				output: "const a = 1;\n\nfoo(a);",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "export const a = 1;\n/** B docs. */\nexport type B = number;",
				output: "export const a = 1;\n\n/** B docs. */\nexport type B = number;",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1; // trailing\n// leading\nconst b = 2;",
				output: "const a = 1; // trailing\n\n// leading\nconst b = 2;",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1; foo(a);",
				output: "const a = 1;\n\n foo(a);",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1; /* note */ foo(a);",
				output: "const a = 1; /* note */\n\n foo(a);",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "import { a } from 'a';\nconst b = a;",
				output: "import { a } from 'a';\n\nconst b = a;",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = 1;\nreturn a;\n}",
				output: "function f() {\nconst a = 1;\n\nreturn a;\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = 1;\nif (a) go();\n}",
				output: "function f() {\nconst a = 1;\n\nif (a) go();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nif (ok) { go(); }\nstop();\n}",
				output: "function f() {\nif (ok) { go(); }\n\nstop();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: [
					"const f = Effect.gen(function* () {",
					"const a = yield* A;",
					"const b = yield* B;",
					"const dispatch = Effect.fn('dispatch')(function* () {",
					"yield* a;",
					"});",
					"return dispatch;",
					"});",
				].join("\n"),
				output: [
					"const f = Effect.gen(function* () {",
					"const a = yield* A;",
					"const b = yield* B;",
					"",
					"const dispatch = Effect.fn('dispatch')(function* () {",
					"yield* a;",
					"});",
					"",
					"return dispatch;",
					"});",
				].join("\n"),
				errors: [{ messageId: "expectedBlankLine" }, { messageId: "expectedBlankLine" }],
			},
			{
				code: "export interface A {}\nexport class B {}",
				output: "export interface A {}\n\nexport class B {}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1\n;[1].forEach(f)",
				output: "const a = 1\n\n;[1].forEach(f)",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1 // trailing\n;[1].forEach(f)",
				output: "const a = 1 // trailing\n\n;[1].forEach(f)",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nfoo();\nwhile (ok) go();\n}",
				output: "function f() {\nfoo();\n\nwhile (ok) go();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nfor (const item of items) use(item);\n}",
				output: "function f() {\ngo();\n\nfor (const item of items) use(item);\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\ntry { a(); } catch { b(); }\n}",
				output: "function f() {\ngo();\n\ntry { a(); } catch { b(); }\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\ndo stop(); while (ok);\n}",
				output: "function f() {\ngo();\n\ndo stop(); while (ok);\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nswitch (x) {}\nstop();\n}",
				output: "function f() {\ngo();\n\nswitch (x) {}\n\nstop();\n}",
				errors: [{ messageId: "expectedBlankLine" }, { messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ndo { go(); } while (ok);\nstop();\n}",
				output: "function f() {\ndo { go(); } while (ok);\n\nstop();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst g = () => {};\ngo();\n}",
				output: "function f() {\nconst g = () => {};\n\ngo();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\n(function () {})();\ngo();\n}",
				output: "function f() {\n(function () {})();\n\ngo();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nvoid function () {}();\ngo();\n}",
				output: "function f() {\nvoid function () {}();\n\ngo();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\n(0, () => {})();\ngo();\n}",
				output: "function f() {\n(0, () => {})();\n\ngo();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\n(function () {})?.();\ngo();\n}",
				output: "function f() {\n(function () {})?.();\n\ngo();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nfunction g() {}\n}",
				output: "function f() {\ngo();\n\nfunction g() {}\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nclass A {}\n}",
				output: "function f() {\ngo();\n\nclass A {}\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "namespace N {\nconst a = 1;\ntype B = string;\ninterface C {}\nconst d = 1;\n}",
				output: "namespace N {\nconst a = 1;\n\ntype B = string;\n\ninterface C {}\n\nconst d = 1;\n}",
				errors: [
					{ messageId: "expectedBlankLine" },
					{ messageId: "expectedBlankLine" },
					{ messageId: "expectedBlankLine" },
				],
			},
			{
				code: "class A {\nstatic {\nconst a = 1;\nif (a) go();\n}\n}",
				output: "class A {\nstatic {\nconst a = 1;\n\nif (a) go();\n}\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "switch (x) {\ncase 1: {\ngo();\n}\ncase 2:\nstop();\n}",
				output: "switch (x) {\ncase 1: {\ngo();\n}\n\ncase 2:\nstop();\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nouter: for (;;) break outer;\n}",
				output: "function f() {\ngo();\n\nouter: for (;;) break outer;\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{ code: ";\nfoo();", output: ";\n\nfoo();", errors: [{ messageId: "expectedBlankLine" }] },
			{
				code: "foo();\n;\nbar();",
				output: "foo();\n\n;\n\nbar();",
				errors: [{ messageId: "expectedBlankLine" }, { messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1\n;\nfoo()",
				output: "const a = 1\n;\n\nfoo()",
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = 1;\n/*\n\n*/\nreturn a;\n}",
				output: "function f() {\nconst a = 1;\n\n/*\n\n*/\nreturn a;\n}",
				errors: [{ messageId: "expectedBlankLine" }],
			},
		],
		valid: [
			{
				code: [
					'import { readFile } from "node:fs/promises";',
					"",
					"export async function readConfig(path: string) {",
					'\tconst text = await readFile(path, "utf8");',
					"\tconst config = JSON.parse(text);",
					"",
					"\treturn config;",
					"}",
				].join("\n"),
				documentation: { id: "pass", title: "grouped bindings, separated logic" },
			},
			"import { a } from 'a';\nimport { b } from 'b';\n\nexport const c = a + b;",
			"function f() {\nconst a = 1;\nconst b = 2;\n\nreturn a + b;\n}",
			"function f() { return 1; }",
			"function f(a: string): string;\nfunction f(a: number): number;\nfunction f(a: string | number) { return a; }",
			[
				"export function f(a: string): string;",
				"export function f(a: number): number;",
				"export function f(a: string | number) { return a; }",
			].join("\n"),
			"declare function f(a: string): string;\ndeclare function f(a: number): number;",
			"const f = Effect.gen(function* () {\nconst a = yield* A;\nconst b = yield* B;\n\nreturn a + b;\n});",
			"export type A = string;\n\n/** B documentation. */\nexport type B = number;",
			"function f() { if (ok) { go(); } else { stop(); } }",
			"function f() {\n// return docs\nreturn 1;\n}",
			"const a = 1;\n\n\nconst b = 2;",
			"switch (x) { case 1: case 2: go(); break; default: stop(); }",
			"const a = 1;\nconst b = 2;",
			"export const a = 1;\nexport const b = 2;",
			"const a = 1;\nlet b = 2;\nvar c = 3;",
			"function f() {\nconst a = 1;\nusing b = open();\n\nreturn a;\n}",
			"const a = 1;\nconst b = 2;\n\nconst c = 3;",
			"const a = 1; // trailing\nconst b = 2;",
			"/** Heads a group. */\nconst a = 1;\nconst b = 2;",
			"import { a } from 'a';\n\nconst b = a;\nexport const c = b;",
			"const a = 1\n\n;[1].forEach(f)",
			"function f() {\nconst a = 1;\n// note\n\nreturn a;\n}",
			"function f() {\nconst a = 1;\n\n// note\nreturn a;\n}",
			"function f() {\ndo go(); while (ok);\nstop();\n}",
			"function f() {\nconst o = {};\ngo();\n}",
			"function f() {\nfoo(function () {});\ngo();\n}",
			"function f() {\nconst C = class { m() {} };\ngo();\n}",
			`function f() {
const text = \`\${() => {}}\`;
go();
}`,
			"function f() {\nfoo();\nbar();\n}",
			"function f() {\nx = 1;\ngo();\n}",
			";\n\nfoo();",
			"function f() {\nouter: for (;;) {\nbreak outer;\n}\n\ngo();\n}",
			"interface A {\nf(): void;\ng(): void;\n}",
			"export { a };\n\nexport { b };",
			"export function f(): void;\n\nexport { f };",
		],
	});

	ts.run("require-readable-spacing options", rule, {
		invalid: [
			{
				code: "import { a } from 'a';\nconst b = a;",
				output: "import { a } from 'a';\n\nconst b = a;",
				options: [{ afterImports: false }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function a() {}\nfunction b() {}",
				output: "function a() {}\n\nfunction b() {}",
				options: [{ betweenTopLevelStatements: false }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nx = 1;\nreturn x;\n}",
				output: "function f() {\nx = 1;\n\nreturn x;\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f(x) {\nx.y = 1;\nreturn x;\n}",
				output: "function f(x) {\nx.y = 1;\n\nreturn x;\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f(x) {\ngo(x);\nreturn x;\n}",
				output: "function f(x) {\ngo(x);\n\nreturn x;\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f(a) {\nif (a) go();\nreturn a;\n}",
				output: "function f(a) {\nif (a) go();\n\nreturn a;\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = 1;\nif (b) go();\nuse(a);\n}",
				output: "function f() {\nconst a = 1;\n\nif (b) go();\nuse(a);\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = {\n};\nreturn a;\n}",
				output: "function f() {\nconst a = {\n};\n\nreturn a;\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nconst a = 1;\nfunction g() { return a; }\n}",
				output: "function f() {\nconst a = 1;\n\nfunction g() { return a; }\n}",
				options: [{ allowAttachedUses: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nif (a) {\nreturn;\n}\nif (b) return;\n}",
				output: "function f() {\nif (a) {\nreturn;\n}\n\nif (b) return;\n}",
				options: [{ allowGuardClauseRuns: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\nif (a) return;\nfor (;;) go();\n}",
				output: "function f() {\nif (a) return;\n\nfor (;;) go();\n}",
				options: [{ allowGuardClauseRuns: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "function f() {\ngo();\nif (a) return;\n}",
				output: "function f() {\ngo();\n\nif (a) return;\n}",
				options: [{ allowGuardClauseRuns: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
			{
				code: "const a = 1;\n/** B docs. */\nconst b = new B({\nx: 1,\n});",
				output: "const a = 1;\n\n/** B docs. */\nconst b = new B({\nx: 1,\n});",
				options: [{ allowMultilineBindingRuns: true }],
				errors: [{ messageId: "expectedBlankLine" }],
			},
		],
		valid: [
			{
				code: "import { a } from 'a';\nconst b = a;",
				options: [{ afterImports: false, betweenTopLevelStatements: false }],
			},
			{ code: "foo();\nbar();", options: [{ betweenTopLevelStatements: false }] },
			{
				code: "function a() {}\nfunction b() {}",
				options: [{ afterBlocks: false, aroundDeclarations: false, betweenTopLevelStatements: false }],
			},
			{ code: "function f() {\ngo();\nfunction g() {}\n}", options: [{ aroundDeclarations: false }] },
			{
				code: "function f() {\nconst a = 1;\nconst b = {\n};\ngo();\n}",
				options: [{ aroundMultilineBindings: false }],
			},
			{ code: "function f() {\ngo();\nwhile (ok) go();\n}", options: [{ beforeControlFlow: false }] },
			{ code: "function f() {\nif (ok) { go(); }\nstop();\n}", options: [{ afterBlocks: false }] },
			{
				code: [
					"async function f(path) {",
					"\tconst exists = await check(path);",
					"\tif (exists) {",
					"\t\tconst items = await scan(path);",
					"\t\treturn new Set(items);",
					"\t}",
					"",
					'\tlet result = "";',
					"\tfor (const item of items) result += item;",
					'\tconst { Client } = await import("client");',
					"\tconst client = new Client({",
					"\t\tresult,",
					"\t});",
					"",
					"\treturn client;",
					"}",
				].join("\n"),
				options: [{ allowAttachedUses: true }],
			},
			{ code: "function f() {\nlet a = 0;\na = next();\nreturn a;\n}", options: [{ allowAttachedUses: true }] },
			{ code: "function f() {\nlet a = 0;\na++;\nreturn a;\n}", options: [{ allowAttachedUses: true }] },
			{
				code: "function f() {\nif (a) return 1;\nif (b) return 2;\nreturn 3;\n}",
				options: [{ allowGuardClauseRuns: true }],
			},
			{
				code: "function f() {\nif (a) return;\nthrow new Error();\n}",
				options: [{ allowGuardClauseRuns: true }],
			},
			{
				code: "const a = /a/v;\nconst b = new B(undefined, {\nx: 1,\n});\nconst c = 2;",
				options: [{ allowMultilineBindingRuns: true }],
			},
		],
	});
});
