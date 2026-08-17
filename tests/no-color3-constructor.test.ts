import { describe } from "vitest";
import rule from "$oxc-rules/roblox/no-color3-constructor";

import { js } from "./rule-testers";

describe("no-color3-constructor", () => {
	js.run("no-color3-constructor", rule, {
		invalid: [
			{
				code: "new Color3(value);",
				output: null,
				errors: [{ messageId: "useFromRGB" }],
			},
			{
				code: "new Color3(255);",
				output: "Color3.fromRGB(255, 0, 0);",
				errors: [{ messageId: "useFromRGB" }],
				documentation: { id: "fail", title: "single-channel Color3 constructor" },
			},
			{
				code: "new Color3(0.5);",
				output: "Color3.fromRGB(128, 0, 0);",
				errors: [{ messageId: "useFromRGB" }],
			},
			{
				code: "new Color3(1, 0);",
				output: "Color3.fromRGB(255, 0, 0);",
				errors: [{ messageId: "useFromRGB" }],
			},
			{
				code: "new Color3(255, 128);",
				output: "Color3.fromRGB(255, 128, 0);",
				errors: [{ messageId: "useFromRGB" }],
			},
			{
				code: "new Color3(255, 128, 64);",
				output: "Color3.fromRGB(255, 128, 64);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "new Color3(1, 1, 1);",
				output: "Color3.fromRGB(255, 255, 255);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "new Color3(0, 0, 1);",
				output: "Color3.fromRGB(0, 0, 255);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "new Color3(0, 1, 0);",
				output: "Color3.fromRGB(0, 255, 0);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "new Color3(1, 0, 0);",
				output: "Color3.fromRGB(255, 0, 0);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "const c = new Color3(0.5, 0.5, 0.5);",
				output: "const c = Color3.fromRGB(128, 128, 128);",
				errors: [{ messageId: "onlyZeroArgs" }],
			},
			{
				code: "new Color3(255, green, 64);",
				output: null,
				errors: [{ messageId: "onlyZeroArgs" }],
			},
		],
		valid: [
			"new Color3();",
			"new Color3(0, 0, 0);",
			{
				code: "Color3.fromRGB(255, 128, 64);",
				documentation: { id: "pass", title: "Color3 fromRGB factory" },
			},
			"Color3.fromRGB(0, 0, 0);",
			"const color = Color3.fromRGB(255, 255, 255);",
			"new Color();",
			"new Color2(1, 2);",
			"const c = someOtherConstructor(1, 2, 3);",
			{
				code: "new Color3(red, green, blue);",
				options: [{ reportUnknownComponents: false }],
			},
		],
	});
});
