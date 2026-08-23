import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-unknown-parameters";
import { ts } from "$test/rule-testers";

const unknownParameter = { messageId: "unknownParameter" };

describe("no-unknown-parameters", () => {
	ts.run("no-unknown-parameters", rule, {
		invalid: [
			{
				code: "function handle(input: unknown) {}",
				errors: [{ messageId: "unknownParameter" }],
				documentation: { id: "fail", title: "unknown function parameter" },
			},
			{ code: "const handle = (input: unknown) => {};", errors: [unknownParameter] },
			{ code: "type Handler = (input: unknown) => void;", errors: [unknownParameter] },
			{ code: "interface Handler { save(value: unknown): void }", errors: [unknownParameter] },
			{ code: "declare function save(value: unknown): void;", errors: [unknownParameter] },
			{ code: "function save({ id }: unknown) {}", errors: [unknownParameter] },
			{
				code: "declare function isNode(value: unknown, other: unknown): value is Node;",
				errors: [{ messageId: "unknownParameter", data: { parameter: "other" } }],
			},
			{
				code: "class Owner { constructor(private readonly value: unknown) {} }",
				errors: [{ messageId: "unknownParameter", data: { parameter: "value" } }],
			},
			{
				code: "function save(...values: unknown) {}",
				errors: [{ messageId: "unknownParameter", data: { parameter: "values" } }],
			},
		],
		valid: [
			{
				code: "export function isNode(value: unknown): value is ESTree.Node {}",
				documentation: { id: "pass", title: "type-guard boundary parameter" },
			},
			"export function isNode(value: unknown): value is ESTree.Node {}",
			"declare function assertNode(value: unknown): asserts value is ESTree.Node;",
			'const isText = (value: unknown): value is string => typeof value === "string";',
			"type Guard = (value: unknown) => value is Element;",
			"interface Guards { isNode(value: unknown): value is Node }",
			"class Owner { constructor(private readonly cause: unknown) {} }",
			"function enrich(cause: unknown) {}",
			"function save(cause: unknown = input) {}",
			"function save(...cause: unknown[]) {}",
			"type Constructor = new (cause: unknown) => Error;",
			"function handle(input: User) {}",
			"function save(value) {}",
			"function save(...values) {}",
		],
	});
});
