import { describe } from "vitest";
import rule from "$oxc-rules/anti-slop/no-unsafe-dictionary-type";

import { ts } from "./rule-testers";

const error = { messageId: "unsafeDictionary" };

describe("no-unsafe-dictionary-type", () => {
	ts.run("no-unsafe-dictionary-type", rule, {
		invalid: [
			{ code: "type A = Record<string, unknown>;", errors: [error] },
			{ code: "type A = { [key: string]: any };", errors: [error] },
			{ code: "type A = { [K in PropertyKey]: object };", errors: [error] },
			{ code: "type A = Record<string, {}>;", errors: [error] },
			{ code: "interface Escape {} type A = Record<string, Escape>;", errors: [error] },
			{ code: "type A = Record<string, string | unknown>;", errors: [error] },
			{ code: "type A = Record<string, unknown & {}>;", errors: [error] },
			{ code: "type Escape = unknown; type A = Record<string, Escape>;", errors: [error] },
			{ code: "type A = Readonly<Record<string, unknown>>;", errors: [error] },
			{ code: "type A = Record<string, Readonly<unknown>>;", errors: [error] },
			{ code: "type A = Record<string, Partial<unknown>>;", errors: [error] },
			{ code: "type A = Record<string, Required<unknown>>;", errors: [error] },
			{ code: "type A = Record<string, NonNullable<unknown>>;", errors: [error] },
			{ code: "interface A { [key: string]: unknown }", errors: [error] },
			{ code: "type A = { readonly [key: string]: unknown };", errors: [error] },
		],
		valid: [
			"type Commands = Record<string, Command>;",
			"type Metadata = Record<PropertyKey, JsonValue>;",
			"type Indexed = { [key: string]: Command };",
			"type Exhaustive = { [K in Permission]: number };",
			"type Allowed = Record<string, { payload: unknown }>;",
			"type Index<T> = Record<string, T>; type EntityIndex<T extends Entity> = Record<string, T>;",
			"type A = Map<string, unknown>; type B = ReadonlyMap<string, unknown>;",
			"import { Record } from './local'; type A = Record<string, unknown>;",
			"type Record<K, V> = { key: K; value: V }; type A = Record<string, unknown>;",
			"type Readonly<T> = { value: T }; type A = Record<string, Readonly<unknown>>;",
			"interface Owner { readonly id: string } type A = Record<string, unknown & Owner>;",
			"interface Owner { readonly id: string } interface Child extends Owner {} type A = Record<string, Child>;",
		],
	});
});
