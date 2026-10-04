import { describe } from "vitest";

import rule from "$oxc-rules/roblox/prefer-native-collection-copy";

import { ts } from "./rule-testers";

describe("prefer-native-collection-copy", () => {
	ts.run("prefer-native-collection-copy", rule, {
		invalid: [
			// Catches a shallow Map copy being obscured by an allocation and loop.
			{
				code: [
					"const current = new Map<number, NodePosition>(entries);",
					"const updated = new Map<number, NodePosition>();",
					"for (const [key, value] of current) updated.set(key, value);",
				].join("\n"),
				output: [
					"const current = new Map<number, NodePosition>(entries);",
					"const updated = table.clone(current);",
				].join("\n"),
				errors: [{ messageId: "preferNativeCollectionCopy" }],
				documentation: { id: "fail", title: "manual shallow Map copy" },
			},
			{
				code: [
					"const current = new Set<number>(values);",
					"const updated = new Set<number>();",
					"for (const value of current) {",
					"\tupdated.add(value);",
					"}",
				].join("\n"),
				output: ["const current = new Set<number>(values);", "const updated = table.clone(current);"].join(
					"\n",
				),
				errors: [{ messageId: "preferNativeCollectionCopy" }],
			},
			{
				code: [
					"const current = new Map(entries);",
					"function table() {}",
					"const updated = new Map();",
					"for (const [key, value] of current) updated.set(key, value);",
				].join("\n"),
				output: null,
				errors: [{ messageId: "preferNativeCollectionCopy" }],
			},
		],
		valid: [
			{
				code: "const current = new Map(entries);\nconst updated = table.clone(current);",
				documentation: { id: "pass", title: "native shallow collection copy" },
			},
			"const updated = new Map();\nfor (const [key, value] of unknownSource) updated.set(key, value);",
			"const source = new Set(values);\nconst updated = new Map();\nfor (const value of source) updated.set(value, true);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, transform(value));",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) if (keep(value)) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = existing;\nfor (const [key, value] of source) updated.set(key, value);",
			"const source = new WeakMap();\nconst updated = new WeakMap();\nfor (const [key, value] of source) updated.set(key, value);",
			"function Map() {}\nconst source = new Map();\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) { updated.set(key, value); log(key); }",
			"const source = new Map(entries);\nconst updated = new Map();\nprepare();\nfor (const [key, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, updated.get(key) ?? value);",
			"const source = source;\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map(existing);\nfor (const [key, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of updated) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) copy(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const key of source) updated.set(key);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [{ key }, value] of source) updated.set(key, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(...[key, value]);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(...keys, value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) other.set(key, value);",
			"const source = new Set(values);\nconst updated = new Set();\nfor (const value of source) updated.set(value);",
			"const source = new Set(values);\nconst updated = new Set();\nfor (const [value] of source) updated.add(value);",
			"const source = new Map(entries);\nconst updated = new Map();\nfor (entry of source) updated.set(entry[0], entry[1]);",
			"function copy(source: Map<number, number>) { const updated = new Map(); for (const [key, value] of source) updated.set(key, value); }",
			"let source = new Map(entries);\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, value);",
			"declare const source: Map<number, number>;\nconst updated = new Map();\nfor (const [key, value] of source) updated.set(key, value);",
			"const updated = new Map();\nfor (const [key, value] of getSource()) updated.set(key, value);",
		],
	});
});
