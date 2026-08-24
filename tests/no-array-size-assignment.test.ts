import { describe } from "vitest";

import rule from "$oxc-rules/roblox/no-array-size-assignment";

import { js } from "./rule-testers";

describe("no-array-size-assignment", () => {
	js.run("no-array-size-assignment", rule, {
		invalid: [
			// .size() pattern (default roblox-ts)
			{
				code: "array[array.size()] = value;",
				output: "array.push(value);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
				documentation: { id: "fail", title: "array size index assignment" },
			},
			{
				code: "state.items[state.items.size()] = item;",
				output: "state.items.push(item);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: 'store["items"][store["items"].size()] = item;',
				output: 'store["items"].push(item);',
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[keyRef.value][registry[keyRef.value].size()] = item;",
				output: "registry[keyRef.value].push(item);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[keys[index]][registry[keys[index]].size()] = item;",
				output: "registry[keys[index]].push(item);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Store { items = []; add(item) { this.items[this.items.size()] = item; } }",
				output: "class Store { items = []; add(item) { this.items.push(item); } }",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Store { #items = []; add(item) { this.#items[this.#items.size()] = item; } }",
				output: "class Store { #items = []; add(item) { this.#items.push(item); } }",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "array[array.size()] = value;",
				output: null,
				options: [{ allowAutofix: false }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "const x = (array[array.size()] = value);",
				output: null,
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "getArray()[getArray().size()] = value;",
				output: null,
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "getStore().items[getStore().items.size()] = value;",
				output: null,
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[getKey().value][registry[getKey().value].size()] = item;",
				output: null,
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Base { items = []; } class Child extends Base { add(item) { super.items[super.items.size()] = item; } }",
				output: null,
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "usePush" }],
			},
			// .length pattern (standard)
			{
				code: "array[array.length] = value;",
				output: "array.push(value);",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "state.items[state.items.length] = item;",
				output: "state.items.push(item);",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: 'store["items"][store["items"].length] = item;',
				output: 'store["items"].push(item);',
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[keyRef.value][registry[keyRef.value].length] = item;",
				output: "registry[keyRef.value].push(item);",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[keys[index]][registry[keys[index]].length] = item;",
				output: "registry[keys[index]].push(item);",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Store { items = []; add(item) { this.items[this.items.length] = item; } }",
				output: "class Store { items = []; add(item) { this.items.push(item); } }",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Store { #items = []; add(item) { this.#items[this.#items.length] = item; } }",
				output: "class Store { #items = []; add(item) { this.#items.push(item); } }",
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "array[array.length] = value;",
				output: null,
				options: [{ allowAutofix: false, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "const x = (array[array.length] = value);",
				output: null,
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "getArray()[getArray().length] = value;",
				output: null,
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "getStore().items[getStore().items.length] = value;",
				output: null,
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "registry[getKey().value][registry[getKey().value].length] = item;",
				output: null,
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
			{
				code: "class Base { items = []; } class Child extends Base { add(item) { super.items[super.items.length] = item; } }",
				output: null,
				options: [{ allowAutofix: true, environment: "standard" }],
				errors: [{ messageId: "usePush" }],
			},
		],
		valid: [
			// .size() valid (default roblox-ts)
			{
				code: "array.push(value);",
				documentation: { id: "pass", title: "append with push" },
			},
			"array[array.size() - 1] = value;",
			"array[other.size()] = value;",
			"array[factory().size()] = value;",
			"state.items[state['items'].size()] = item;",
			"state.items[state.values.size()] = item;",
			"state.items[other.items.size()] = item;",
			"array[array.size()] += value;",
			"array[array.size?.()] = value;",
			"array[array.size(value)] = value;",
			"array[size()] = value;",
			"array[array?.size()] = value;",
			"array[(array?.size)()] = value;",
			'array[array["size"]()] = value;',
			"class Store { #size() { return 0; } add(item) { this[this.#size()] = item; } }",
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
