import nodePath from "node:path";
import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/anti-slop/require-safety-comment-for-type-assertion";

const missingSafetyComment = { messageId: "missingSafetyComment" };
const tsgolint2001 = { "small-rules": { tsgolintVersion: "7.0.2001" } };
const tsgolint2002 = { "small-rules": { tsgolintVersion: "7.0.2002" } };
const FIXTURES = nodePath.join(import.meta.dirname, "..", "..", "..", "tests", "fixtures", "tsgolint-version");

const multilineObjectAssertion = ["const user = {", "	name: value,", "} as User;"].join("\n");

describe("require-safety-comment-for-type-assertion", () => {
	ts.run("require-safety-comment-for-type-assertion", rule, {
		invalid: [
			{
				code: "const userId = value as UserId;",
				errors: [{ messageId: "missingSafetyComment" }],
				documentation: { id: "fail", title: "unexplained type assertion" },
			},
			{ code: "const userId = <UserId>value;", errors: [missingSafetyComment] },
			{ code: "const userId = value as UserId; // SAFETY: Too late.", errors: [missingSafetyComment] },
			{ code: "function load() { return value as User; }", errors: [missingSafetyComment] },
			{
				code: "// SAFETY: This whole module trusts the API dump shape.\nfunction load() { return value as User; }",
				errors: [missingSafetyComment],
			},
			{ code: "// This cast seems fine.\nconst id = value as UserId;", errors: [missingSafetyComment] },
			{
				code: "// oxlint-disable-next-line typescript/no-non-null-assertion -- Unrelated suppression.\nconst user = value as User;",
				errors: [missingSafetyComment],
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion\nconst user = value as User;",
				errors: [missingSafetyComment],
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion --\nconst user = value as User;",
				errors: [missingSafetyComment],
			},
			{
				code: "// eslint-disable-next-line typescript/no-unsafe-type-assertion -- Not an Oxlint directive.\nconst user = value as User;",
				errors: [missingSafetyComment],
			},
			{
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Trailing.",
				errors: [missingSafetyComment],
				settings: tsgolint2001,
			},
			{
				code: [
					"// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shape verified above.",
					multilineObjectAssertion,
				].join("\n"),
				errors: [missingSafetyComment],
				settings: tsgolint2002,
			},
			{
				filename: nodePath.join(FIXTURES, "v2002", "file.ts"),
				code: [
					"// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shape verified above.",
					multilineObjectAssertion,
				].join("\n"),
				errors: [missingSafetyComment],
			},
			{
				filename: nodePath.join(FIXTURES, "v2002", "file.ts"),
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Settings override the installed version.",
				errors: [missingSafetyComment],
				settings: tsgolint2001,
			},
			{
				filename: nodePath.join(FIXTURES, "no-tsgolint", "file.ts"),
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Invalid settings fall back to statement range.",
				errors: [missingSafetyComment],
				settings: { "small-rules": "7.0.2002" },
			},
			{ code: "// SAFETY:\nconst id = value as UserId;", errors: [missingSafetyComment] },
			{ code: "// SAFETY:   \nconst id = value as UserId;", errors: [missingSafetyComment] },
			{ code: "const id = /* SAFETY: */ value as UserId;", errors: [missingSafetyComment] },
			{ code: "export const id = value as UserId;", errors: [missingSafetyComment] },
			{ code: "function load(value = input as User) {}", errors: [missingSafetyComment] },
			{
				code: "// This is not a safety justification.\nexport const id = value as UserId;",
				errors: [missingSafetyComment],
			},
		],
		valid: [
			{
				code: "// SAFETY: parseUserId validated the identifier before branding it.\nconst userId = value as UserId;",
				documentation: { id: "pass", title: "assertion with checked invariant" },
			},
			"const values = [1, 2] as const;",
			"const userId = /* SAFETY: Parser established the identifier invariant. */ value as UserId;",
			"// SAFETY: The parser validated this value.\nconsume(value as User);",
			"class Owner { // SAFETY: Construction validated this value.\nuser = value as User; }",
			"function load() { // SAFETY: The parser validated this value.\nreturn value as User; }",
			"async function load() {\n\t// SAFETY: The API dump shape is stable enough to trust.\n\tif (!validate) return (await value.json()) as ApiDump;\n}",
			"// SAFETY: The parser validated every item in this list.\nfor (const item of items) consume(item as User);",
			"// SAFETY: This error has a verified owner.\nthrow value as Error;",
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility tests build minimal AST nodes for parser-shape branches.\nconst node = value as ESTree.Node;",
			},
			{
				code: "/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The schema parser validated this payload. */\nconst user = value as User;",
			},
			{
				code: "// oxlint-disable-next-line no-console, typescript/no-unsafe-type-assertion -- Shape verified above.\nconst user = value as User;",
			},
			"// SAFETY: The parser established the exported UserId invariant.\nexport const id = value as UserId;",
			"/* SAFETY:\n * The parser established the exported UserId invariant.\n */\nexport const id = value as UserId;",
			{
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Shape verified above.",
				settings: tsgolint2002,
			},
			{
				code: [
					"// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shape verified above.",
					multilineObjectAssertion,
				].join("\n"),
				settings: tsgolint2001,
			},
			{
				code: "/* oxlint-disable typescript/no-unsafe-type-assertion -- Shape verified above. */\nconst user = value as User;",
				settings: tsgolint2002,
			},
			{
				code: ["// SAFETY: Shape verified above.", multilineObjectAssertion].join("\n"),
				settings: tsgolint2002,
			},
			{
				code: [
					"const user = {",
					"	name: value,",
					"// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shape verified above.",
					"} as User;",
				].join("\n"),
				settings: tsgolint2002,
			},
			{
				code: [
					"export const isBunFile = type({",
					'	writer: "Function",',
					"	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- slopware",
					"}).readonly() as unknown as Type<BunFile>;",
				].join("\n"),
			},
			{
				filename: nodePath.join(FIXTURES, "v2002", "file.ts"),
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Installed tsgolint reports on as.",
			},
			{
				filename: nodePath.join(FIXTURES, "v2001", "file.ts"),
				code: [
					"// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Installed tsgolint reports on the statement.",
					multilineObjectAssertion,
				].join("\n"),
			},
			{
				filename: nodePath.join(FIXTURES, "workspace-2002", "file.ts"),
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- Catalog version reports on as.",
			},
			{
				filename: nodePath.join(FIXTURES, "installed-2002", "file.ts"),
				code: "const user = value as User; // oxlint-disable-line typescript/no-unsafe-type-assertion -- node_modules wins over package.json.",
			},
		],
	});

	ts.run("require-safety-comment-for-type-assertion custom suppression rules", rule, {
		invalid: [
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Replaced default.\nconst category = value as Category;",
				options: [{ suppressionRules: ["typescript/no-unsafe-enum-assignment"] }],
				errors: [missingSafetyComment],
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-enum-assignment\nconst category = value as Category;",
				options: [{ suppressionRules: ["typescript/no-unsafe-enum-assignment"] }],
				errors: [missingSafetyComment],
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Disabled by empty list.\nconst category = value as Category;",
				options: [{ suppressionRules: [] }],
				errors: [missingSafetyComment],
			},
		],
		valid: [
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- slop\nconst category = diagnostic.category as DiagnosticCategory;",
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- Enum value checked upstream.\nconst category = value as Category;",
				options: [{ suppressionRules: ["typescript/no-unsafe-enum-assignment"] }],
			},
			{
				code: "// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Still listed.\nconst category = value as Category;",
				options: [
					{
						suppressionRules: [
							"typescript/no-unsafe-type-assertion",
							"typescript/no-unsafe-enum-assignment",
						],
					},
				],
			},
			{
				code: "const category = value as Category; // oxlint-disable-line typescript/no-unsafe-enum-assignment -- Enum value checked upstream.",
				options: [{ suppressionRules: ["typescript/no-unsafe-enum-assignment"] }],
				settings: tsgolint2002,
			},
		],
	});

	ts.run("require-safety-comment-for-type-assertion custom markers", rule, {
		invalid: [
			{
				code: "// SAFETY: This marker is not configured.\nconst value = input as User;",
				options: [{ markers: ["INVARIANT"] }],
				errors: [{ data: { marker: "INVARIANT" }, messageId: "missingSafetyComment" }],
			},
			{
				code: "// INVARIANT:   \nconst value = input as User;",
				options: [{ markers: ["INVARIANT"] }],
				errors: [{ data: { marker: "INVARIANT" }, messageId: "missingSafetyComment" }],
			},
		],
		valid: [
			{
				code: "// INVARIANT: The caller parsed this value.\nconst value = input as User;",
				options: [{ markers: ["INVARIANT"] }],
			},
			{
				code: "// SAFETY: The caller parsed this value.\nconst value = input as User;",
				options: [{ markers: ["INVARIANT", "SAFETY"] }],
			},
			{
				code: "// SAFE+: The caller parsed this value.\nconst value = input as User;",
				options: [{ markers: ["SAFE+"] }],
			},
		],
	});

	ts.run("require-safety-comment-for-type-assertion block disable range", rule, {
		invalid: [
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- legacy block below */",
					"const legacy = raw as Foo;",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
					"",
					"export function later(): Foo {",
					"	return raw as Foo;",
					"}",
				].join("\n"),
				errors: [{ line: 6, messageId: "missingSafetyComment" }],
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- legacy block below */",
					"const legacy = raw as Foo;",
					"/* oxlint-enable */",
					"const later = raw as Foo;",
				].join("\n"),
				errors: [{ line: 4, messageId: "missingSafetyComment" }],
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- first block */",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
					"/* oxlint-disable no-console -- unrelated block */",
					"const later = raw as Foo;",
				].join("\n"),
				errors: [{ line: 4, messageId: "missingSafetyComment" }],
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- first block */",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
					"/* oxlint-disable typescript/no-unsafe-type-assertion */",
					"const later = raw as Foo;",
				].join("\n"),
				errors: [{ line: 4, messageId: "missingSafetyComment" }],
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion, no-console -- legacy block */",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
					"const later = raw as Foo;",
				].join("\n"),
				errors: [{ line: 3, messageId: "missingSafetyComment" }],
				settings: tsgolint2002,
			},
		],
		valid: [
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- legacy block below */",
					"/* oxlint-enable no-console */",
					"const legacy = raw as Foo;",
				].join("\n"),
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unsafe-enum-assignment -- legacy */",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
					"const legacy = raw as Foo;",
				].join("\n"),
				settings: tsgolint2002,
			},
			{
				code: [
					"/* oxlint-disable typescript/no-unsafe-type-assertion -- legacy block below */",
					"const legacy = raw as Foo;",
					"/* oxlint-enable typescript/no-unsafe-type-assertion */",
				].join("\n"),
				settings: tsgolint2002,
			},
		],
	});

	ts.run("require-safety-comment-for-type-assertion comment ownership", rule, {
		invalid: [
			{
				code: "const first = raw as Foo; // SAFETY: raw was validated above\nconst second = other as Foo;",
				errors: [missingSafetyComment, missingSafetyComment],
			},
			{
				code: "const first = 1; // SAFETY: first is fine\nexport const second = other as Foo;",
				errors: [missingSafetyComment],
			},
			{
				code: "class Widget {\n\tfirst = 1; /* SAFETY: first is fine */\n\tsecond = other as Foo;\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: only the lookup below is checked\nfunction lookup(value: unknown): void {\n\tif (value as boolean) {\n\t\tconsole.log(1);\n\t}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: this class is fine\nclass Widget {\n\trun(input: unknown): void {\n\t\tfor (const item of input as Array<number>) {}\n\t}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: this class is fine\nclass Widget {\n\trun(input = other as number): void {}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: this class is fine\nclass Widget {\n\tstatic {\n\t\twhile (other as boolean) {}\n\t}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: this namespace is fine\nnamespace Scope {\n\twhile (other as boolean) {}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "// SAFETY: this switch is fine\nswitch (kind) {\n\tcase 1:\n\t\twhile (other as boolean) {}\n}",
				errors: [missingSafetyComment],
			},
			{
				code: "const first = 1; // SAFETY: first is fine\nconsume(raw as Foo);",
				errors: [missingSafetyComment],
			},
			{
				code: "const first = 1; // SAFETY: first is fine\ntarget = raw as Foo;",
				errors: [missingSafetyComment],
			},
			{
				code: "const first = raw as Foo; // SAFETY: first is fine\nconsume(other as Foo);",
				errors: [missingSafetyComment, missingSafetyComment],
			},
			{
				code: "switch (kind) {\n\tcase 1:\n\t\tprepare(); // SAFETY: prepare is fine\n\t\tconsume(raw as Foo);\n}",
				errors: [missingSafetyComment],
			},
		],
		valid: [
			"const first = 1;\n// SAFETY: second is checked\nconst second = other as Foo;",
			"const first = 1; /* SAFETY: second is checked */ const second = other as Foo;",
			"const first = 1;\n// SAFETY: second is checked\nexport const second = other as Foo;",
			"// SAFETY: the condition is checked\nif (value as boolean) {}",
			"// SAFETY: the key is checked\nswitch (kind) {\n\tcase other as Foo:\n\t\tbreak;\n}",
			"// SAFETY: the parameter default is checked\nfunction lookup(value = other as Foo): void {}",
		],
	});
});
