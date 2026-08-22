import { describe } from "vitest";

import rule from "$oxc-rules/general/no-use-of-empty-return-value";

import { js, ts } from "./rule-testers";

describe("no-use-of-empty-return-value", () => {
	js.run("no-use-of-empty-return-value", rule, {
		invalid: [
			{
				code: ["function doWork() {", "  sideEffect();", "}", "const result = doWork();"].join("\n"),
				errors: [{ data: { name: "doWork" }, messageId: "removeUseOfOutput" }],
				documentation: { id: "fail", title: "Using void function result" },
			},
			{ code: "function clear() {}\nconst value = clear();", errors: [{ messageId: "removeUseOfOutput" }] },
			{ code: "function clear() {}\nconsume(clear());", errors: [{ messageId: "removeUseOfOutput" }] },
			{ code: "function clear() {}\nif (clear()) {}", errors: [{ messageId: "removeUseOfOutput" }] },
			{ code: "const clear = () => {};\nconst value = clear();", errors: [{ messageId: "removeUseOfOutput" }] },
			{
				code: "const clear = function () {};\nconst value = clear();",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
			{
				code: "function clear() { return; }\nconst value = clear();",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
			{
				code: "function clear() {}\nconst value = clear() || fallback;",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
			{
				code: "function clear() {}\nconst value = clear() ? a : b;",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
			{
				code: "function clear() {}\nconst value = (0, clear());",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
			{
				code: "function clear() {}\nconst value = (noop(), clear());",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
		],
		valid: [
			{
				code: ["function getValue() {", "  return 1;", "}", "const result = getValue();"].join("\n"),
				documentation: { id: "pass", title: "Using returned value" },
			},
			"function clear() {}\nclear();",
			"function clear() {}\nvoid clear();",
			"function wrapper() {\n  function clear() {}\n  return clear();\n}",
			"function getValue() { return 1; }\nconst result = getValue();",
			"const getValue = () => 1;\nconst result = getValue();",
			"async function load() {}\nconst promise = load();",
			"function* generate() {}\nconst iterator = generate();",
			"async function run() {\n  function clear() {}\n  await clear();\n}",
			"obj.method();",
			"const value = obj.method();",
			"function clear() {}\nthrow clear();",
			"const value = unknown();",
			"function clear() {}\nconst value = (clear(), 1);",
			"const a = 1, b = 2;\nfunction clear() {}\nconst value = clear && clear;",
			"const value = unknown();",
			"function clear() {}\nfunction clear() {}\nconst value = clear();",
			"const clear = 1;\nconst value = clear();",
			"import { clear } from 'mod';\nconst value = clear();",
			"const { clear } = object;\nconst value = clear();",
			"const clear = class {};\nconst value = clear();",
			"function getValue() { return 1; }\nvoid getValue();",
			"function getValue() { return 1; }\ngetValue();",
		],
	});

	ts.run("no-use-of-empty-return-value typescript", rule, {
		invalid: [
			{
				code: "function clear(): void { sideEffect(); }\nconst value = clear();",
				errors: [{ messageId: "removeUseOfOutput" }],
			},
		],
		valid: ["function getValue(): number { return 1; }\nconst value = getValue();"],
	});
});
