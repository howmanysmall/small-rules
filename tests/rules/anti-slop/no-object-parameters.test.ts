import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-object-parameters";
import { ts } from "$test/rule-testers";

const objectParameter = { messageId: "objectParameter" };
const objectParameterSyntaxes = [
	"const consume = (value: object) => {};",
	"const consume = function (value: object) {};",
	"type Handler = { (value: object): void };",
	"interface Factory { new (value: object): Owner }",
	"type Factory = new (value: object) => Owner;",
	"declare function consume(value: object): void;",
	"class Owner { consume(value: object): void; consume(value: string): void {} }",
];

describe("no-object-parameters", () => {
	ts.run("no-object-parameters", rule, {
		invalid: [
			...objectParameterSyntaxes.map((code) => ({ code, errors: [objectParameter] })),
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
				errors: [{ data: { parameter: "{ id }" }, messageId: "objectParameter" }],
			},
			{
				code: "function f(value: (object | string)) {}",
				errors: [{ data: { parameter: "value" }, messageId: "objectParameter" }],
			},
			{ code: "function save(value: object = {}) {}", errors: [objectParameter] },
			{ code: "interface Handler { save(value: object): void }", errors: [objectParameter] },
			{ code: "type Handler = (value: object) => void;", errors: [objectParameter] },
			{
				code: "function save(...values: object) {}",
				errors: [{ data: { parameter: "values" }, messageId: "objectParameter" }],
			},
			{
				code: "type Item = object; type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;",
				errors: [objectParameter],
			},
			{
				code: "function consume(value: object = {}): void {}",
				errors: [{ data: { parameter: "value" }, messageId: "objectParameter" }],
			},
			{
				code: "function consume({ value }: object = {}): void {}",
				errors: [{ data: { parameter: "{ value }" }, messageId: "objectParameter" }],
			},
			{
				code: "type Bag = object; function consume({ value }: Bag): void {}",
				errors: [{ data: { parameter: "{ value }" }, messageId: "objectParameter" }],
			},
			{
				code: "function outer() { type Payload = object; function consume(value: Payload) {} }",
				errors: [objectParameter],
			},
			{
				code: "function outer() { function consume(value: Payload) {} type Payload = object; }",
				errors: [objectParameter],
			},
			{
				code: "type Identity<T> = T; function consume(value: Identity<object>) {}",
				errors: [objectParameter],
			},
			{
				code: "type Identity<T> = T; type Wrapped<T> = Identity<T>; function consume(value: Wrapped<object>) {}",
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
			"type Payload = object; function outer() { type Payload = { readonly id: string }; function consume(value: Payload) {} }",
			"type Identity<T> = T; function consume<Identity>(value: Identity) {}",
			"function one() { type Payload = object; } function two() { function consume(value: Payload) {} }",
			"type Key = object; type Mapped<Input> = { [Key in keyof Input]: (value: Key) => void };",
			"type Item = object; type Unpacked<Input> = Input extends Promise<infer Item> ? (value: Item) => void : never;",
		],
	});
});
