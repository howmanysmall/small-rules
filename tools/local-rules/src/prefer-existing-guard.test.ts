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
			"export function isTypeAssertionExpression(node: ESTree.Node): node is TypeAssertionExpression {",
			"\treturn isTsAsExpression(node) || isTsTypeAssertion(node);",
			"}",
			"export function isListed(node: ESTree.Node): boolean {",
			"\treturn includes([node, 1], node) && listed(node);",
			"}",
			"export function isNamedIdentifier(node: ESTree.Node | null | undefined, name: string): boolean {",
			"\treturn node?.type === IDENTIFIER && node.name === name;",
			"}",
			"export function isIdentifier(node?: ESTree.Node | null): node is ESTree.IdentifierName {",
			"\treturn node?.type === IDENTIFIER;",
			"}",
			"export function isIdentifierReference(node: ESTree.Node): node is ESTree.IdentifierReference {",
			"\treturn node.type === IDENTIFIER;",
			"}",
			"export function isOwned(node: ESTree.Node): boolean {",
			"\treturn owner(node) && node.owned;",
			"}",
			"export function isOwnedField(node: ESTree.Node): boolean {",
			"\treturn owner(node.field) && node.ok;",
			"}",
			"export function hasOwner(value: ESTree.Node): boolean {",
			"\treturn owner(value);",
			"}",
			"export function hasOwnedParent(node: ESTree.Node): boolean {",
			"\treturn owner(node.parent);",
			"}",
			"export function isStrictReference(node: ESTree.Node): boolean {",
			"\treturn node.type === REFERENCE && node.strict;",
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
				code: 'const isLength = isIdentifier(property.property) && property.property.name === "length";',
				errors: [
					{
						data: {
							guard: "isNamedIdentifier",
							replacement: 'isNamedIdentifier(property.property, "length")',
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'const isLength = isIdentifierReference(target) && target.name === "length";',
				errors: [
					{
						data: {
							guard: "isNamedIdentifier",
							replacement: 'isNamedIdentifier(target, "length")',
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: "const isOwned = hasOwner(target.field) && target.ok;",
				errors: [
					{
						data: {
							guard: "isOwnedField",
							replacement: "isOwnedField(target)",
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: 'const isLength = target.type === IDENTIFIER && target.name === "length";',
				errors: [
					{
						data: {
							guard: "isNamedIdentifier",
							replacement: 'isNamedIdentifier(target, "length")',
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: "const isAssertion = isTsTypeAssertion(current) || isTsAsExpression(current);",
				errors: [
					{
						data: {
							guard: "isTypeAssertionExpression",
							replacement: "isTypeAssertionExpression(current)",
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
			{
				code: "const isOther = !isTsTypeAssertion(current) && !isTsAsExpression(current);",
				errors: [
					{
						data: {
							guard: "isTypeAssertionExpression",
							replacement: "!isTypeAssertionExpression(current)",
							specifier: "@small-rules/example",
						},
						messageId: "useGuard",
					},
				],
			},
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
			'const otherName = isIdentifier(left) && right.name === "length";',
			'const unknownCall = isMaybeIdentifier(target) && target.name === "length";',
			'const extraArgument = isIdentifier(target, other) && target.name === "length";',
			'const spread = isIdentifier(...targets) && target.name === "length";',
			"const looser = target?.type === REFERENCE && target.strict;",
			"const parentOwned = hasOwnedParent(target) && target.owned;",
			"const split = isTsTypeAssertion(left) || isTsAsExpression(right);",
			"const repeated = isTsAsExpression(current) || isTsAsExpression(current);",
			"const extended = isTsTypeAssertion(current) || isTsAsExpression(current) || isSatisfies(current);",
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
