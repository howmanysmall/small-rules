import { describe } from "vitest";
import rule, { isDefaultValue } from "$oxc-rules/no-useless-default";
import { defineRule } from "oxlint-plugin-utilities";

import { ts, tsx } from "./rule-testers";

import type { CanonicalValue } from "$oxc-rules/no-useless-default";
import type { CreateRule, Visitor } from "oxlint-plugin-utilities";

function createComparisonRule(
	defaultValue: CanonicalValue,
): CreateRule<readonly [], "match" | "mismatch", readonly []> {
	return defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					if (node.callee.type !== "Identifier" || node.callee.name !== "check") return;

					const [argument] = node.arguments;
					if (argument === undefined || argument.type === "SpreadElement") return;

					context.report({
						messageId: isDefaultValue(argument, defaultValue) ? "match" : "mismatch",
						node: argument,
					});
				},
			} satisfies Visitor;
		},
		meta: {
			messages: {
				match: "match",
				mismatch: "mismatch",
			},
			schema: [],
			type: "problem",
		},
	});
}

describe("no-useless-default comparison helpers", () => {
	describe("primitive literal matching", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default number defaults", createComparisonRule({ type: "number", value: 0 }), {
			invalid: [
				{ code: "check(0);", errors: [{ messageId: "match" }] },
				{ code: "check(+0);", errors: [{ messageId: "match" }] },
				{ code: "check(1);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(!0);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(+value);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(math.huge);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(math['huge']);", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default bool defaults", createComparisonRule({ type: "bool", value: true }), {
			invalid: [
				{ code: "check(true);", errors: [{ messageId: "match" }] },
				{ code: "check(false);", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default string defaults", createComparisonRule({ type: "string", value: "Hello" }), {
			invalid: [
				{ code: "check('Hello');", errors: [{ messageId: "match" }] },
				{ code: "check('World');", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});
	});

	describe("enum and infinity matching", () => {
		ts.run(
			"no-useless-default enum defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ enumType: "FrameStyle", type: "Enum", value: "Custom" }),
			{
				invalid: [
					{ code: "check(Enum.FrameStyle.Custom);", errors: [{ messageId: "match" }] },
					{ code: "check(Enum.FrameStyle.RobloxRound);", errors: [{ messageId: "mismatch" }] },
					{ code: "check(FrameStyle.Custom);", errors: [{ messageId: "mismatch" }] },
					{ code: "check(Enum['FrameStyle'].Custom);", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);

		ts.run(
			"no-useless-default positive infinity defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ type: "number", value: "inf" }),
			{
				invalid: [
					{ code: "check(math.huge);", errors: [{ messageId: "match" }] },
					{ code: "check(-math.huge);", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);

		ts.run(
			"no-useless-default negative infinity defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ type: "number", value: "-inf" }),
			{
				invalid: [
					{ code: "check(-math.huge);", errors: [{ messageId: "match" }] },
					{ code: "check(math.huge);", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);
	});

	describe("vector and dimension constructor matching", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default vector2 defaults", createComparisonRule({ type: "Vector2", value: [0, 0] }), {
			invalid: [
				{ code: "check(new Vector2());", errors: [{ messageId: "match" }] },
				{ code: "check(new Vector2(0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(Vector2.zero);", errors: [{ messageId: "match" }] },
				{ code: "check(Vector2.one);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector2(0, 1));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector2(0, value));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new UDim());", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default vector3 defaults", createComparisonRule({ type: "Vector3", value: [0, 0, 0] }), {
			invalid: [
				{ code: "check(new Vector3());", errors: [{ messageId: "match" }] },
				{ code: "check(new Vector3(0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector3(0, ...rest, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(Vector3.zero);", errors: [{ messageId: "match" }] },
				{ code: "check(Vector3.one);", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector3(0, 0, 1));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector3(0, value, 0));", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default udim2 defaults", createComparisonRule({ type: "UDim2", value: [0, 0, 0, 0] }), {
			invalid: [
				{ code: "check(new UDim2());", errors: [{ messageId: "match" }] },
				{ code: "check(new UDim2(0, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new UDim2(foo, 0, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(UDim2.fromScale(0, 0));", errors: [{ messageId: "match" }] },
				{ code: "check(UDim2.fromScale(value, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(UDim2.fromScale(0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(UDim2.identity(0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(UDim2.fromOffset(0, 50));", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		ts.run(
			"no-useless-default udim2 offset defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ type: "UDim2", value: [0, 0, 0, 50] }),
			{
				invalid: [
					{ code: "check(UDim2.fromOffset(0, 50));", errors: [{ messageId: "match" }] },
					{ code: "check(UDim2.fromOffset(50, 0));", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default udim defaults", createComparisonRule({ type: "UDim", value: [0, 0] }), {
			invalid: [
				{ code: "check(new UDim(0, 0));", errors: [{ messageId: "match" }] },
				{ code: "check(new UDim());", errors: [{ messageId: "match" }] },
				{ code: "check(new UDim(0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new UDim(0, value));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new UDim(1, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector2());", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});
	});

	describe("roblox value object matching", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default color3 defaults", createComparisonRule({ type: "Color3", value: [0, 0, 0] }), {
			invalid: [
				{ code: "check(new Color3());", errors: [{ messageId: "match" }] },
				{ code: "check(new Color3(0, 0, 0));", errors: [{ messageId: "match" }] },
				{ code: "check(Color3.fromRGB(255, 128));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(Color3.fromRGB(value, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Color3(foo, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Color3(0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector3());", errors: [{ messageId: "mismatch" }] },
				{ code: "check(Color3.fromRGB(255, 128, 0));", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		ts.run(
			"no-useless-default color3 normalized defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ type: "Color3", value: [1, Math.fround(128 / 255), 0] }),
			{
				invalid: [
					{ code: "check(Color3.fromRGB(255, 128, 0));", errors: [{ messageId: "match" }] },
					{ code: "check(Color3.fromRGB(128, 255, 0));", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("no-useless-default rect defaults", createComparisonRule({ type: "Rect", value: [0, 0, 0, 0] }), {
			invalid: [
				{ code: "check(new Rect());", errors: [{ messageId: "match" }] },
				{ code: "check(new Rect(0, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Rect(foo, 0, 0, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Rect(0, 0, 1, 0));", errors: [{ messageId: "mismatch" }] },
				{ code: "check(new Vector2());", errors: [{ messageId: "mismatch" }] },
			],
			valid: [],
		});

		ts.run(
			"no-useless-default cframe defaults",
			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			createComparisonRule({ type: "CFrame", value: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] }),
			{
				invalid: [
					{ code: "check(new CFrame());", errors: [{ messageId: "match" }] },
					{ code: "check(new CFrame(1, 0, 0));", errors: [{ messageId: "mismatch" }] },
					{ code: "check(new CFrame(0, value, 0));", errors: [{ messageId: "mismatch" }] },
					{ code: "check(new Vector3());", errors: [{ messageId: "mismatch" }] },
				],
				valid: [],
			},
		);
	});

	describe("unsupported canonical values", () => {
		ts.run(
			"no-useless-default unsupported defaults",
			// @ts-expect-error Deliberately exercises the runtime fallback for unknown canonical types.
			createComparisonRule({ type: "unsupported", value: "x" }),
			{
				invalid: [{ code: "check('x');", errors: [{ messageId: "mismatch" }] }],
				valid: [],
			},
		);
	});
});

describe("no-useless-default JSX detection", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-useless-default JSX defaults", rule, {
		invalid: [
			{
				code: "const view = <uiaspectratioconstraint AspectRatio={1} />;",
				errors: [
					{
						data: { className: "UIAspectRatioConstraint", propertyName: "AspectRatio" },
						messageId: "uselessDefault",
					},
				],
				output: "const view = <uiaspectratioconstraint />;",
			},
			{
				code: "const view = <frame BackgroundTransparency={0} Size={size} />;",
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: "const view = <frame Size={size} />;",
			},
			{
				code: "const view = <frame {...spreadProps} BackgroundTransparency={0} />;",
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: JSON.parse("null"),
			},
			{
				code: 'const view = <textlabel Text="" />;',
				errors: [{ data: { className: "TextLabel", propertyName: "Text" }, messageId: "uselessDefault" }],
				output: "const view = <textlabel />;",
			},
			{
				code: "const view = <uicorner CornerRadius={new UDim(0, 0)} />;",
				errors: [
					{ data: { className: "UICorner", propertyName: "CornerRadius" }, messageId: "uselessDefault" },
				],
				output: "const view = <uicorner />;",
			},
			{
				code: "const view = <FRAME BackgroundTransparency={0} />;",
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: "const view = <FRAME />;",
			},
			{
				code: "const view = <frame backgroundtransparency={0} />;",
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: "const view = <frame />;",
			},
			{
				code: "const view = <billboardgui Enabled />;",
				errors: [{ data: { className: "BillboardGui", propertyName: "Enabled" }, messageId: "uselessDefault" }],
				output: "const view = <billboardgui />;",
			},
			{
				code: "const view = <frame /* keep */ BackgroundTransparency={0} />;",
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: JSON.parse("null"),
			},
		],
		valid: [
			{ code: 'const view = <uiaspectratioconstraint key="my-key" />;' },
			{ code: "const view = <uiaspectratioconstraint AspectRatio={2} />;" },
			{ code: 'const view = <frame Name="MyFrame" />;' },
			{ code: "const view = <frame Parent={someParent} />;" },
			{ code: "const view = <frame BackgroundTransparency={getValue()} />;" },
			{ code: "const view = <frame {...spreadProps} />;" },
			{ code: "const view = <Frame BackgroundTransparency={0} />;" },
			{ code: "const view = <billboardgui Enabled={false} />;" },
			{ code: "const view = <frame:slot BackgroundTransparency={0} />;" },
			{ code: "const view = <Root.frame BackgroundTransparency={0} />;" },
			{ code: "const view = <frame roblox:BackgroundTransparency={0} />;" },
			{ code: "const view = <frame>{/* empty */}</frame>;" },
		],
	});
});

describe("no-useless-default imperative detection", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("no-useless-default imperative defaults", rule, {
		invalid: [
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MinSize = new Vector2(); c.Name = "x";',
				errors: [
					{
						data: { className: "UISizeConstraint", propertyName: "MinSize" },
						messageId: "uselessDefault",
					},
				],
				output: 'const c = new Instance("UISizeConstraint"); c.Name = "x";',
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MinSize = Vector2.zero;',
				errors: [
					{
						data: { className: "UISizeConstraint", propertyName: "MinSize" },
						messageId: "uselessDefault",
					},
				],
				output: 'const c = new Instance("UISizeConstraint");',
			},
			{
				code: 'const c = new Instance("UISizeConstraint");\n/* keep */\nc.MinSize = new Vector2();\nc.Name = "x";',
				errors: [
					{
						data: { className: "UISizeConstraint", propertyName: "MinSize" },
						messageId: "uselessDefault",
					},
				],
				output: JSON.parse("null"),
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MinSize = new Vector2(); /* keep */ c.Name = "x";',
				errors: [
					{
						data: { className: "UISizeConstraint", propertyName: "MinSize" },
						messageId: "uselessDefault",
					},
				],
				output: JSON.parse("null"),
			},
			{
				code: 'const f = new Instance("Frame"); f.BackgroundTransparency = 0; f.Size = new UDim2(0, 100, 0, 200);',
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: 'const f = new Instance("Frame"); f.Size = new UDim2(0, 100, 0, 200);',
			},
			{
				code: 'const f = new Instance("Frame"); f.backgroundtransparency = 0; f.Size = new UDim2(0, 100, 0, 200);',
				errors: [
					{
						data: { className: "Frame", propertyName: "BackgroundTransparency" },
						messageId: "uselessDefault",
					},
				],
				output: 'const f = new Instance("Frame"); f.Size = new UDim2(0, 100, 0, 200);',
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); [alias] = [c]; c.MinSize = new Vector2();',
				errors: [
					{
						data: { className: "UISizeConstraint", propertyName: "MinSize" },
						messageId: "uselessDefault",
					},
				],
				output: 'const c = new Instance("UISizeConstraint"); [alias] = [c];',
			},
		],
		valid: [
			{ code: 'const frame = new Instance("Frame"); frame.Name = "Container";' },
			{ code: 'const frame = new Instance("Frame"); frame.Parent = workspace;' },
			{ code: 'const c = new Instance("UISizeConstraint"); c.MinSize = new Vector2(10, 0);' },
			{ code: 'const c = new Instance("UISizeConstraint"); c["MinSize"] = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); register(c); c.MinSize = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); register(other, c); c.MinSize = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); register([c]); c.MinSize = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); register(...args, c); c.MinSize = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); cache.values.push(c); c.MinSize = new Vector2();' },
			{ code: 'const c = new Instance("UISizeConstraint"); let alias; alias = c; c.MinSize = new Vector2();' },
			{
				code: 'function createConstraint() { const c = new Instance("UISizeConstraint"); return c; c.MinSize = new Vector2(); }',
			},
			{
				code: 'function createConstraint() { const c = new Instance("UISizeConstraint"); return; }',
			},
			{ code: 'const part = new Instance("Part"); part.Size = new Vector3(4, 5, 6);' },
			{
				code: 'const className = "UISizeConstraint"; const c = new Instance(className); c.MinSize = new Vector2();',
			},
		],
	});
});
