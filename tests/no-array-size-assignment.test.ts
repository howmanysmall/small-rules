import { describe } from "vitest";
import rule from "$oxc-rules/no-array-size-assignment";

import { js } from "./rule-testers";

describe("no-array-size-assignment", () => {
	// @ts-expect-error -- Stupid.
	js.run("no-array-size-assignment", rule, {
		invalid: [
			// .size() pattern (default roblox-ts)
			{
				code: "array[array.size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "array.push(value);",
			},
			{
				code: "state.items[state.items.size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "state.items.push(item);",
			},
			{
				code: 'store["items"][store["items"].size()] = item;',
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: 'store["items"].push(item);',
			},
			{
				code: "registry[keyRef.value][registry[keyRef.value].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "registry[keyRef.value].push(item);",
			},
			{
				code: "registry[keys[index]][registry[keys[index]].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "registry[keys[index]].push(item);",
			},
			{
				code: "class Store { items = []; add(item) { this.items[this.items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "class Store { items = []; add(item) { this.items.push(item); } }",
			},
			{
				code: "class Store { #items = []; add(item) { this.#items[this.#items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: "class Store { #items = []; add(item) { this.#items.push(item); } }",
			},
			{
				code: "array[array.size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: false }],
				output: null,
			},
			{
				code: "const x = (array[array.size()] = value);",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: null,
			},
			{
				code: "getArray()[getArray().size()] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: null,
			},
			{
				code: "registry[getKey().value][registry[getKey().value].size()] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: null,
			},
			{
				code: "class Base { items = []; } class Child extends Base { add(item) { super.items[super.items.size()] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true }],
				output: null,
			},
			// .length pattern (standard)
			{
				code: "array[array.length] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "array.push(value);",
			},
			{
				code: "state.items[state.items.length] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "state.items.push(item);",
			},
			{
				code: 'store["items"][store["items"].length] = item;',
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: 'store["items"].push(item);',
			},
			{
				code: "registry[keyRef.value][registry[keyRef.value].length] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "registry[keyRef.value].push(item);",
			},
			{
				code: "registry[keys[index]][registry[keys[index]].length] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "registry[keys[index]].push(item);",
			},
			{
				code: "class Store { items = []; add(item) { this.items[this.items.length] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "class Store { items = []; add(item) { this.items.push(item); } }",
			},
			{
				code: "class Store { #items = []; add(item) { this.#items[this.#items.length] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: "class Store { #items = []; add(item) { this.#items.push(item); } }",
			},
			{
				code: "array[array.length] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: false, environment: "standard" }],
				output: null,
			},
			{
				code: "const x = (array[array.length] = value);",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: null,
			},
			{
				code: "getArray()[getArray().length] = value;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: null,
			},
			{
				code: "registry[getKey().value][registry[getKey().value].length] = item;",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: null,
			},
			{
				code: "class Base { items = []; } class Child extends Base { add(item) { super.items[super.items.length] = item; } }",
				errors: [{ messageId: "usePush" }],
				options: [{ allowAutofix: true, environment: "standard" }],
				output: null,
			},
		],
		valid: [
			// .size() valid (default roblox-ts)
			"array.push(value);",
			"array[array.size() - 1] = value;",
			"array[other.size()] = value;",
			"array[array.size()] += value;",
			'array[array["size"]()] = value;',
			"[item][[item].size()] = item;",
			"store[\"items\"][store['items'].size()] = item;",
			// .length should NOT trigger in roblox-ts mode
			"array[array.length] = value;",
			// .length valid (standard)
			{
				code: "array[array.length - 1] = value;",
				options: [{ environment: "standard" }],
			},
			{
				code: "array[other.length] = value;",
				options: [{ environment: "standard" }],
			},
			{
				code: 'array[array["length"]] = value;',
				options: [{ environment: "standard" }],
			},
			{
				code: "array[array.length] += value;",
				options: [{ environment: "standard" }],
			},
			{
				code: "[item][[item].length] = item;",
				options: [{ environment: "standard" }],
			},
			{
				code: "store[\"items\"][store['items'].length] = item;",
				options: [{ environment: "standard" }],
			},
		],
	});
});
