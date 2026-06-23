import { describe } from "vitest";
import rule from "$oxc-rules/prefer-sequence-overloads";

import { js } from "./rule-testers";

describe("prefer-sequence-overloads", () => {
	// @ts-expect-error dumb piece of shit
	js.run("prefer-sequence-overloads", rule, {
		invalid: [
			{
				code: "const gradient = new ColorSequence(new Color3(), new Color3());",
				errors: [{ messageId: "preferSingleOverload" }],
				output: "const gradient = new ColorSequence(new Color3());",
			},
			{
				code: "const constant = new NumberSequence(42, 42);",
				errors: [{ messageId: "preferSingleOverload" }],
				output: "const constant = new NumberSequence(42);",
			},
			{
				code:
					"const gradient = new ColorSequence([\n" +
					"    new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),\n" +
					"    new ColorSequenceKeypoint(1, Color3.fromRGB(255, 100, 200)),\n" +
					"]);",
				errors: [{ messageId: "preferTwoPointOverload" }],
				output: "const gradient = new ColorSequence(Color3.fromRGB(100, 200, 255), Color3.fromRGB(255, 100, 200));",
			},
			{
				code:
					"const solid = new ColorSequence([\n" +
					"    new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),\n" +
					"    new ColorSequenceKeypoint(1, Color3.fromRGB(100, 200, 255)),\n" +
					"]);",
				errors: [{ messageId: "preferSingleOverload" }],
				output: "const solid = new ColorSequence(Color3.fromRGB(100, 200, 255));",
			},
			{
				code:
					"const fade = new NumberSequence([\n" +
					"    new NumberSequenceKeypoint(0, 0),\n" +
					"    new NumberSequenceKeypoint(1, 100),\n" +
					"]);",
				errors: [{ messageId: "preferTwoPointOverload" }],
				output: "const fade = new NumberSequence(0, 100);",
			},
			{
				code:
					"const constant = new NumberSequence([\n" +
					"    new NumberSequenceKeypoint(0, 42),\n" +
					"    new NumberSequenceKeypoint(1, 42),\n" +
					"]);",
				errors: [{ messageId: "preferSingleOverload" }],
				output: "const constant = new NumberSequence(42);",
			},
		],
		valid: [
			// Non-endpoint keypoints should be untouched.
			`
new ColorSequence([
    new ColorSequenceKeypoint(0, Color3.fromRGB(255, 255, 255)),
    new ColorSequenceKeypoint(0.5, Color3.fromRGB(128, 128, 128)),
    new ColorSequenceKeypoint(1, Color3.fromRGB(0, 0, 0)),
]);
`,

			// Wrong keypoint ordering
			`
new ColorSequence([
    new ColorSequenceKeypoint(1, Color3.fromRGB(255, 100, 200)),
    new ColorSequenceKeypoint(0, Color3.fromRGB(100, 200, 255)),
]);
`,

			// Unsupported overload with envelope
			`
new NumberSequence([
    new NumberSequenceKeypoint(0, 10, 0.2),
    new NumberSequenceKeypoint(1, 90, 0.8),
]);
			`,

			// Already optimized constructors
			"new ColorSequence(Color3.fromRGB(100, 200, 255));",
			"new ColorSequence(Color3.fromRGB(0, 0, 0), Color3.fromRGB(255, 255, 255));",
			"new NumberSequence(0);",
			"new NumberSequence(0, 1);",

			// Different two-argument constructors should be untouched
			"new ColorSequence(new Color3(1, 0, 0), new Color3(0, 1, 0));",
			"new NumberSequence(10, 20);",
			"new ColorSequence(...parts);",
			"new ColorSequence(value, ...moreParts);",
			"new ColorSequence(...parts, ...moreParts);",
			"new Roblox.ColorSequence(value, value);",
			"new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(1, 2), new NumberSequenceKeypoint(2, 3)]);",
			"new NumberSequence([0, new NumberSequenceKeypoint(1, 2)]);",
			"new NumberSequence([new NumberSequenceKeypoint(...timeAndValue), new NumberSequenceKeypoint(1, 2)]);",
			"new NumberSequence([new NumberSequenceKeypoint(0, ...values), new NumberSequenceKeypoint(1, 2)]);",
			"new NumberSequence([, new NumberSequenceKeypoint(1, 2)]);",
			"new NumberSequence([new NumberSequenceKeypoint(0, 1),]);",
			"new NumberSequence([new NumberSequenceKeypoint(0, 1), ...keypoints]);",
			"new ColorSequence([new SomethingElse(0, Color3.fromRGB(0, 0, 0)), new ColorSequenceKeypoint(1, Color3.fromRGB(255, 255, 255))]);",
			"new ColorSequence([new React.ColorSequenceKeypoint(0, Color3.fromRGB(0, 0, 0)), new ColorSequenceKeypoint(1, Color3.fromRGB(255, 255, 255))]);",
			"new NumberSequence([new NumberSequenceKeypoint(0, 1), new NumberSequenceKeypoint(0.5, 2)]);",

			// Additional arguments or different constructors
			"new SomethingElse([new ColorSequenceKeypoint(0, Color3.fromRGB(0, 0, 0)), new ColorSequenceKeypoint(1, Color3.fromRGB(255, 255, 255))]);",
		],
	});
});
