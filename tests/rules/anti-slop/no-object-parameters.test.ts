import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-object-parameters";
import { ts } from "$test/rule-testers";

const objectParameter = { messageId: "objectParameter" };

describe("no-object-parameters", () => {
	ts.run("no-object-parameters", rule, {
		invalid: [
			{
				code: "function save(value: object) {}",
				errors: [{ messageId: "objectParameter" }],
				documentation: { id: "fail", title: "broad object parameter" },
			},
			{ code: "type Alias = object; function save(value: Alias) {}", errors: [objectParameter] },
			{ code: "type Alias = (object); function save(value: Alias) {}", errors: [objectParameter] },
			{ code: "function save(value: object | string) {}", errors: [objectParameter] },
			{ code: "class Owner { constructor(private readonly value: object) {} }", errors: [objectParameter] },
			{
				code: "function save({ id }: object) {}",
				errors: [{ messageId: "objectParameter", data: { parameter: "{ id }" } }],
			},
			{
				code: "function f(value: (object | string)) {}",
				errors: [{ messageId: "objectParameter", data: { parameter: "value" } }],
			},
			{ code: "function save(value: object = {}) {}", errors: [objectParameter] },
			{ code: "interface Handler { save(value: object): void }", errors: [objectParameter] },
			{ code: "type Handler = (value: object) => void;", errors: [objectParameter] },
			{
				code: "function save(...values: object) {}",
				errors: [{ messageId: "objectParameter", data: { parameter: "...values" } }],
			},
			{
				code: "type Item = object; type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;",
				errors: [objectParameter],
			},
		],
		valid: [
			{
				code: ["interface Owner { readonly id: string }", "function save(value: Owner) {}"].join("\n"),
				documentation: { id: "pass", title: "named owner contract" },
			},
			"function f<Value>(value: Value) {}",
			"type Alias = object; function consume<Alias>(value: Alias) {}",
			"function f(value: Alias) {}",
			"function f<Value extends object>(value: Value) {}",
			"type Owner = { readonly id: string }; function f<Value extends Owner>(value: Value) {}",
			"type Consumer<Alias> = (value: Alias) => void;",
			"interface Consumer<Alias> { consume(value: Alias): void }",
			"function save(value = {}) {}",
			"function save(...values) {}",
			"function h({ id } = {}) {}",
			"type Box2<T> = { readonly id: T }; function g(v: Box2<string>) {}",
			"type Open<T> = object;",
		],
	});
});
