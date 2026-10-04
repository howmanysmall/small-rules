import { describe } from "vitest";

import rule from "$oxc-rules/general/no-loop-iterable-mutation";

import { js, ts } from "./rule-testers";

describe("no-loop-iterable-mutation", () => {
	js.run("no-loop-iterable-mutation", rule, {
		invalid: [
			{
				code: ["for (const item of items) {", "  items.push(item.clone());", "}"].join("\n"),
				errors: [{ data: { iterable: "items" }, messageId: "noLoopIterableMutation" }],
				documentation: { id: "fail", title: "Mutating iterable during for-of" },
			},
			{
				code: "for (const value of values) {\n  values.shift();\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const value of values) {\n  values.splice(0, 1);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const value of set) {\n  set.delete(value);\n  set.add(value);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of items) {\n  items.pop();\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of items.values()) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const key of map.keys()) {\n  map.clear();\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const [key] of map.entries()) {\n  map.clear();\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (let item of items) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (item of items) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const value of (items)) {\n  items.push(value);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (let item of set) {\n  set.delete(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of items.keys()) {\n  items.delete(other);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const [, value] of map.entries()) {\n  map.clear();\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of set) {\n  set.delete(other);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const key of map.keys()) {\n  map.add(key);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
		],
		valid: [
			{
				code: ["for (const item of [...items]) {", "  items.push(item.clone());", "}"].join("\n"),
				documentation: { id: "pass", title: "Snapshot loop is safe" },
			},
			"for (const item of items) {\n  otherItems.push(item);\n}",
			"for (const key of Object.keys(object)) {\n  delete object[key];\n}",
			"for (const value of set) {\n  set.add(value);\n}",
			"for (const key of map.keys()) {\n  map.set(key, newValue);\n}",
			"for (const [key] of map) {\n  map.delete(key);\n}",
			"for (const [key] of map.entries()) {\n  map.delete(key);\n}",
			"for (const key of map.keys()) {\n  map.delete(key);\n}",
			"for (const item of items) {\n  function later() {\n    items.push(item);\n  }\n}",
			"for (const item of items) {\n  items.notMutating(item);\n}",
			"for await (const item of items) {\n  items.push(item);\n}",
			"for (const item of items.entries()) {\n  other.push(item);\n}",
			"for (const item of foo()) {\n  items.push(item);\n}",
			"for (const item of items.with(0, 1)) {\n  items.push(item);\n}",
			"for (const item of obj?.items) {\n  items.push(item);\n}",
			"for (const item of items?.values()) {\n  items.push(item);\n}",
			"for (const item of items.custom()) {\n  items.push(item);\n}",
			"for (const item of items[method]()) {\n  items.push(item);\n}",
			"for (const [key] of map.entries()) {\n  map.set(key, value);\n}",
			"for (const key of map.keys()) {\n  map.set(key, value);\n}",
			"for (const value of set.values()) {\n  set.add(value);\n}",
		],
	});

	ts.run("no-loop-iterable-mutation typescript", rule, {
		invalid: [
			{
				code: "for (const item of items as string[]) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of (items as string[])) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of items!) {\n  items.push(item);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
			{
				code: "for (const item of set) {\n  set.delete(other as string);\n}",
				errors: [{ messageId: "noLoopIterableMutation" }],
			},
		],
		valid: [
			"for (const item of items as string[]) {\n  other.push(item);\n}",
			"for (const item of set) {\n  set.delete(item as string);\n}",
			"for (const item of set) {\n  set.delete(<string>item);\n}",
			"for (const item of (<string[]>items)) {\n  other.push(item);\n}",
			"for (const item of (items as any).values()) {\n  items.push(item);\n}",
		],
	});
});
