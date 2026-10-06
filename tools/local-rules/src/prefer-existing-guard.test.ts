import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import preferExistingGuard, { createPreferExistingGuardRule } from "./prefer-existing-guard";
import { indexUtilities } from "./utilities-index";

const index = indexUtilities([
	{
		source: [
			"export function isStringLiteral(node?: ESTree.Node | null): node is ESTree.StringLiteral {",
			"\treturn isAnyLiteral(node) && Predicate.isString(node.value);",
			"}",
			"export function isIdentifierNamed(node: ESTree.Node, name: string): boolean {",
			'\treturn node.type === "Identifier" && node.name === name;',
			"}",
			"export function isFirstOrSecond(node: ESTree.Node, extra: unknown): boolean {",
			"\treturn first(node) || second(node);",
			"}",
			"export function isListed(node: ESTree.Node): boolean {",
			"\treturn includes([node, 1], node) && listed(node);",
			"}",
		].join("\n"),
		specifier: "@small-rules/example",
	},
]);

const rule = createPreferExistingGuardRule(() => index);

describe("prefer-existing-guard", () => {
	ts.run("prefer-existing-guard", rule, {
		invalid: [
			{
				code: "if (!isAnyLiteral(node) || !Predicate.isString(node.value)) throw new Error();",
				errors: [
					{
						data: {
							guard: "isStringLiteral",
							replacement: "!isStringLiteral(node)",
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: "const isText = isAnyLiteral(member.object) && Predicate.isString(member.object.value);",
				errors: [
					{
						data: {
							guard: "isStringLiteral",
							replacement: "isStringLiteral(member.object)",
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'const isUseMemo = callee.type === "Identifier" && callee.name === "useMemo";',
				errors: [
					{
						data: {
							guard: "isIdentifierNamed",
							replacement: 'isIdentifierNamed(callee, "useMemo")',
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
		],
		valid: [
			"const isText = isStringLiteral(node);",
			"const mixed = isAnyLiteral(left) && Predicate.isString(right.value);",
			"const either = isAnyLiteral(node) || Predicate.isString(node.value);",
			"const halfNegated = !isAnyLiteral(node) || Predicate.isString(node.value);",
			"const longer = isAnyLiteral(node) && Predicate.isString(node.value) && extra;",
			"const reordered = Predicate.isString(node.value) && isAnyLiteral(node);",
			"const different = isAnyLiteral(node) && Predicate.isNumber(node.value);",
			'const computed = isAnyLiteral(node) && Predicate.isString(node["value"]);',
			"const unbound = first(node) || second(node);",
			'const regex = callee.type === /Identifier/u && callee.name === "useMemo";',
			"const nullish = first(node) ?? second(node);",
			"const sparse = includes([node, , 1], node) && listed(node);",
			[
				"export function isStringLiteral(node) {",
				"\treturn isAnyLiteral(node) && Predicate.isString(node.value);",
				"}",
			].join("\n"),
		],
	});
});

describe("prefer-existing-guard with the repository utilities", () => {
	ts.run("prefer-existing-guard", preferExistingGuard, {
		invalid: [
			{
				code: "if (!isAnyLiteral(node) || !Predicate.isString(node.value)) throw new Error();",
				errors: [{ messageId: "useGuard" }],
			},
		],
		valid: ["if (!isStringLiteral(node)) throw new Error();"],
	});
});
