import { describe } from "vitest";
import rule from "$oxc-rules/no-useless-constants";

import { ts, tsx } from "./rule-testers";

describe("no-useless-constants", () => {
	describe("autofix coverage", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("inlines an adjacent plain-expression constant", rule, {
			invalid: [
				{
					code: "const TITLE_OFFSET = 225;\nconst TEXT_NATIVE = { Offset: TITLE_OFFSET };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const TEXT_NATIVE = { Offset: 225 };",
				},
			],
			valid: ["const TEXT_NATIVE = { Offset: 225 };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("remains idempotent after autofix", rule, {
			invalid: [],
			valid: ["const TEXT_NATIVE = { Offset: 225 };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("remains idempotent after JSX autofix", rule, {
			invalid: [],
			valid: [
				"const TITLE_CHILDREN = { child: <uigradient Color={new ColorSequence(Color3.fromRGB(191, 88, 255), Color3.fromRGB(191, 88, 255))} Rotation={90} /> };",
			],
		});
	});

	describe("guards and report-only cases", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent primitive literal constant", rule, {
			invalid: [
				{
					code: "const TITLE_OFFSET = 225;\nconst MIDDLE = 42;\nconst TEXT_NATIVE = { Offset: TITLE_OFFSET };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const MIDDLE = 42;\nconst TEXT_NATIVE = { Offset: 225 };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent primitive literal across function", rule, {
			invalid: [
				{
					code: "const REWARDS_GRID_CAPACITY = 32;\nconst BASE_ITEM_BOX_NATIVE_PROPERTIES_CONFIG_2 = { LayoutOrder: 3 };\nfunction renderAutoFillReward() { return null; }\nconst REWARDS_AUTO_FILL_CONFIGURATION = {\n  capacity: REWARDS_GRID_CAPACITY,\n  renderEmpty: renderAutoFillReward,\n};",
					errors: [{ messageId: "uselessConstant" }],
					output: "const BASE_ITEM_BOX_NATIVE_PROPERTIES_CONFIG_2 = { LayoutOrder: 3 };\nfunction renderAutoFillReward() { return null; }\nconst REWARDS_AUTO_FILL_CONFIGURATION = {\n  capacity: 32,\n  renderEmpty: renderAutoFillReward,\n};",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent static Roblox factory initializer", rule, {
			invalid: [
				{
					code: "const TITLE_TEXT_GRADIENT = new ColorSequence([\n  new ColorSequenceKeypoint(0, Color3.fromRGB(255, 255, 255)),\n  new ColorSequenceKeypoint(1, Color3.fromRGB(251, 120, 255)),\n]);\nconst MIDDLE = 42;\nexport const STYLE = {\n  title: { Color: TITLE_TEXT_GRADIENT },\n};",
					errors: [{ messageId: "uselessConstant" }],
					output: "const MIDDLE = 42;\nexport const STYLE = {\n  title: { Color: new ColorSequence([\n  new ColorSequenceKeypoint(0, Color3.fromRGB(255, 255, 255)),\n  new ColorSequenceKeypoint(1, Color3.fromRGB(251, 120, 255)),\n]) },\n};",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent static factory with binary argument", rule, {
			invalid: [
				{
					code: "const TITLE_PADDING = new UDim(0, 1 + 2);\nconst MIDDLE = 42;\nconst STYLE = { padding: TITLE_PADDING };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const MIDDLE = 42;\nconst STYLE = { padding: new UDim(0, 1 + 2) };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent static factory with conditional argument", rule, {
			invalid: [
				{
					code: "const TITLE_COLOR = Color3.fromRGB(true ? 255 : 128, 120, 255);\nconst MIDDLE = 42;\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const MIDDLE = 42;\nconst STYLE = { color: Color3.fromRGB(true ? 255 : 128, 120, 255) };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes non-adjacent static factory with object argument", rule, {
			invalid: [
				{
					code: "const TWEEN_INFO = new TweenInfo({ Time: 1, DelayTime: 0 });\nconst MIDDLE = 42;\nconst STYLE = { tween: TWEEN_INFO };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const MIDDLE = 42;\nconst STYLE = { tween: new TweenInfo({ Time: 1, DelayTime: 0 }) };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes wrapped static factory initializers", rule, {
			invalid: [
				{
					code: "const TITLE_COLOR = (Color3.fromRGB(255, 120, 80));\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const STYLE = { color: Color3.fromRGB(255, 120, 80) };",
				},
				{
					code: "const TITLE_COLOR = Color3.fromRGB(255, 120, 80) as Color3;\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const STYLE = { color: Color3.fromRGB(255, 120, 80) as Color3 };",
				},
				{
					code: "const TITLE_COLOR = Color3.fromRGB(255, 120, 80)!;\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const STYLE = { color: Color3.fromRGB(255, 120, 80)! };",
				},
				{
					code: "const TITLE_COLOR = Color3.fromRGB(255, 120, 80) satisfies Color3;\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const STYLE = { color: Color3.fromRGB(255, 120, 80) satisfies Color3 };",
				},
			],
			valid: [],
		});

		{
			const templateExpression = String.raw({ raw: ["`", "{Color3.fromRGB(255, 120, 80)}`"] }, "$");

			// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
			ts.run("auto-fixes static factory expression containers", rule, {
				invalid: [
					{
						code: `const TITLE_TEXT = ${templateExpression};\nconst STYLE = { text: TITLE_TEXT };`,
						errors: [{ messageId: "uselessConstant" }],
						output: `const STYLE = { text: ${templateExpression} };`,
					},
					{
						code: "const TITLE_SIZE = +UDim2.fromOffset(1, 2).X.Offset;\nconst STYLE = { size: TITLE_SIZE };",
						errors: [{ messageId: "uselessConstant" }],
						output: "const STYLE = { size: +UDim2.fromOffset(1, 2).X.Offset };",
					},
				],
				valid: [],
			});
		}

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes static factory arrays with safe elements", rule, {
			invalid: [
				{
					code: "const COLOR_SEQUENCE = new ColorSequence([ColorSequenceKeypoint.new(0, Color3.fromRGB(0, 0, 0))]);\nconst STYLE = { color: COLOR_SEQUENCE };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const STYLE = { color: new ColorSequence([ColorSequenceKeypoint.new(0, Color3.fromRGB(0, 0, 0))]) };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports unsafe inline expression shapes without autofix", rule, {
			invalid: [
				{
					code: "const TITLE_COLOR = (Color3.fromRGB(255, 120, 80), Color3.fromRGB(90, 90, 90));\nconst STYLE = { color: TITLE_COLOR };",
					errors: [{ messageId: "uselessConstantNoFix" }],
					output: JSON.parse("null"),
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("auto-fixes multiple same-scope constants in one pass", rule, {
			invalid: [
				{
					code: "const TITLE_TEXT_GRADIENT = new ColorSequence(Color3.fromRGB(255, 255, 255));\nconst OUTLINE_GRADIENT = new ColorSequence(Color3.fromRGB(252, 178, 255));\nexport const STYLE = {\n  title: { Color: TITLE_TEXT_GRADIENT },\n  outline: { Color: OUTLINE_GRADIENT },\n};",
					errors: [{ messageId: "uselessConstants" }],
					output: "export const STYLE = {\n  title: { Color: new ColorSequence(Color3.fromRGB(255, 255, 255)) },\n  outline: { Color: new ColorSequence(Color3.fromRGB(252, 178, 255)) },\n};",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports non-adjacent non-literal constant without autofix", rule, {
			invalid: [
				{
					code: "const TITLE_OFFSET = getOffset();\nconst MIDDLE = 42;\nconst TEXT_NATIVE = { Offset: TITLE_OFFSET };",
					errors: [{ messageId: "uselessConstantNoFix" }],
					output: JSON.parse("null"),
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports non-adjacent imported factory call without autofix", rule, {
			invalid: [
				{
					code: 'import { makeGradient } from "styles";\nconst TITLE_GRADIENT = makeGradient(1);\nconst MIDDLE = 42;\nconst STYLE = { gradient: TITLE_GRADIENT };',
					errors: [{ messageId: "uselessConstantNoFix" }],
					output: JSON.parse("null"),
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports comment-attached constant without autofix", rule, {
			invalid: [
				{
					code: "// important note\nconst TITLE_OFFSET = 225;\nconst TEXT_NATIVE = { Offset: TITLE_OFFSET };",
					errors: [{ messageId: "uselessConstantNoFix" }],
					output: JSON.parse("null"),
				},
				{
					code: "const TITLE_OFFSET = 225;\n// keep with offset\nconst TEXT_NATIVE = { Offset: TITLE_OFFSET };",
					errors: [{ messageId: "uselessConstantNoFix" }],
					output: JSON.parse("null"),
				},
			],
			valid: [],
		});
	});

	describe("local scope handling", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports local ALL_CAPS constant inside function body", rule, {
			invalid: [
				{
					code: "function render() {\n  const OFFSET_X = 42;\n  const CONFIG = { x: OFFSET_X };\n  return CONFIG;\n}",
					errors: [{ messageId: "uselessConstant" }],
					output: "function render() {\n  const CONFIG = { x: 42 };\n  return CONFIG;\n}",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips local ALL_CAPS constant referenced outside const initializer", rule, {
			invalid: [],
			valid: ["function render() {\n  const OFFSET_X = 42;\n  console.log(OFFSET_X);\n}"],
		});
	});

	describe("cross-scope guard", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips module-level constant used inside function body", rule, {
			invalid: [],
			valid: [
				"const SPRING_OPTIONS = { dampingRatio: 0.6, frequency: 10 };\nfunction render() {\n  const CONFIG = { spring: SPRING_OPTIONS };\n  return CONFIG;\n}",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("skips module-level spring config used inside React component body", rule, {
			invalid: [],
			valid: [
				"const SPRING_CONFIG = { dampingRatio: 0.55, frequency: 0.154 };\nexport default function Component() {\n  const positionY = useEasyRippleSpring(0.037, SPRING_CONFIG);\n  return positionY;\n}",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("skips module-level constant used inside React component", rule, {
			invalid: [],
			valid: [
				"const POSITION_SPRING_OPTIONS = { dampingRatio: 0.6, frequency: 10 };\nexport default function HudLeft() {\n  const result = useSpring(POSITION_SPRING_OPTIONS);\n  return <frame />;\n}",
			],
		});
	});

	describe("no-false-positive guards", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips exported constants", rule, {
			invalid: [],
			valid: [
				"export const TITLE_GRADIENT = new ColorSequence(Color3.fromRGB(225, 225, 128), Color3.fromRGB(196, 196, 64));",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips constants referenced more than once", rule, {
			invalid: [],
			valid: [
				"const TITLE_GRADIENT = new ColorSequence(Color3.fromRGB(225, 225, 128), Color3.fromRGB(196, 196, 64));\nconst FIRST_USE = { Color: TITLE_GRADIENT };\nconst SECOND_USE = { Color: TITLE_GRADIENT };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips non-ALL_CAPS names", rule, {
			invalid: [],
			valid: [
				"const titleGradient = new ColorSequence(Color3.fromRGB(225, 225, 128), Color3.fromRGB(196, 196, 64));\nconst wrapper = { Color: titleGradient };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips destructuring patterns", rule, {
			invalid: [],
			valid: ["const { TITLE_GRADIENT } = getStyles();\nconst WRAPPER = { Color: TITLE_GRADIENT };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips multi-declarator declarations", rule, {
			invalid: [],
			valid: [
				"const TITLE_GRADIENT = new ColorSequence(Color3.fromRGB(225, 225, 128), Color3.fromRGB(196, 196, 64)), OTHER = 42;\nconst WRAPPER = { Color: TITLE_GRADIENT };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("skips reused JSX element constants", rule, {
			invalid: [],
			valid: [
				"const UI_GRADIENT = <uigradient Color={new ColorSequence(Color3.fromRGB(191, 88, 255))} />;\nconst FIRST_SLOT = { child: UI_GRADIENT };\nconst SECOND_SLOT = { child: UI_GRADIENT };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips function initializer constants", rule, {
			invalid: [],
			valid: ["const HANDLER = () => {};\nconst WRAPPER = { callback: HANDLER };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips class initializer constants", rule, {
			invalid: [],
			valid: ["const HANDLER = class { render() {} };\nconst WRAPPER = { value: HANDLER };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips shadowed constants", rule, {
			invalid: [],
			valid: [
				"const TITLE_GRADIENT = new ColorSequence(Color3.fromRGB(225, 225, 128), Color3.fromRGB(196, 196, 64));\nfunction render() { const TITLE_GRADIENT = new ColorSequence(Color3.fromRGB(0, 0, 0)); return { Color: TITLE_GRADIENT }; }",
			],
		});
	});

	describe("object allocation guard", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips object literal constant", rule, {
			invalid: [],
			valid: [
				"const POSITION_SPRING_OPTIONS = { dampingRatio: 0.6, frequency: 10 };\nconst CONFIG = { spring: POSITION_SPRING_OPTIONS };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips array literal constant", rule, {
			invalid: [],
			valid: ["const EMPTY_MOB_IDS = [];\nconst HIDDEN = { mobIds: EMPTY_MOB_IDS };"],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips new Array constant", rule, {
			invalid: [],
			valid: [
				"const EMPTY_MOB_IDS: ReadonlyArray<MobId> = new Array<MobId>();\nconst HIDDEN = { mobIds: EMPTY_MOB_IDS };",
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports same-scope Roblox datatype constructor constant", rule, {
			invalid: [
				{
					code: "const SHADOW_POSITION = UDim2.fromScale(-0.7, 0.7);\nconst SHADOW_NATIVE_PROPERTIES = { Position: SHADOW_POSITION };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const SHADOW_NATIVE_PROPERTIES = { Position: UDim2.fromScale(-0.7, 0.7) };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("reports same-scope Roblox datatype member constant", rule, {
			invalid: [
				{
					code: "const SHADOW_ANCHOR = Vector2.yAxis;\nconst SHADOW_NATIVE_PROPERTIES = { AnchorPoint: SHADOW_ANCHOR };",
					errors: [{ messageId: "uselessConstant" }],
					output: "const SHADOW_NATIVE_PROPERTIES = { AnchorPoint: Vector2.yAxis };",
				},
			],
			valid: [],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		ts.run("skips configured call pattern", rule, {
			invalid: [],
			valid: [
				{
					code: "const SHADOW_POSITION = UDim2.fromScale(-0.7, 0.7);\nconst SHADOW_NATIVE_PROPERTIES = { Position: SHADOW_POSITION };",
					options: [{ ignoreCallPatterns: [String.raw`^UDim2\b`] }],
				},
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("skips JSX element constant", rule, {
			invalid: [],
			valid: [
				"const UI_CORNER = <uicorner CornerRadius={new UDim(1, 0)} />;\nconst FILL_FRAME = <frame>{UI_CORNER}</frame>;",
			],
		});
	});
});
