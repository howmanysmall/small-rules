import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/require-safety-comment-for-type-assertion";
import { ts } from "$test/rule-testers";

const missingSafetyComment = { messageId: "missingSafetyComment" };

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
		],
	});
});
