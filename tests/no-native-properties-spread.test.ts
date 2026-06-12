import { describe } from "vitest";
import rule from "$oxc-rules/no-native-properties-spread";

import { tsx } from "./rule-testers";

describe("no-native-properties-spread", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-native-properties-spread", rule, {
		invalid: [
			{
				code: 'const SOME_CONSTANT = {}; const view = <Frame nativeProperties={{ ...SOME_CONSTANT, Text: "hello" }} />;',
				errors: [
					{
						data: { prop: "nativeProperties", source: "SOME_CONSTANT" },
						messageId: "noNativePropertiesSpread",
					},
				],
			},
			{
				code: "const INFO_BOX_GRADIENT_NATIVE_PROPERTIES = {}; function Component(gradientNativeProperties) { return <Frame gradientNativeProperties={{ ...INFO_BOX_GRADIENT_NATIVE_PROPERTIES, ...gradientNativeProperties }} />; }",
				errors: [
					{
						data: { prop: "gradientNativeProperties", source: "INFO_BOX_GRADIENT_NATIVE_PROPERTIES" },
						messageId: "noNativePropertiesSpread",
					},
				],
			},
			{
				code: 'const BASE_NATIVE_PROPERTIES = {}; function Component() { const mergedNativeProperties = { ...BASE_NATIVE_PROPERTIES, Text: "hello" }; return <Frame nativeProperties={mergedNativeProperties} />; }',
				errors: [
					{
						data: { prop: "nativeProperties", source: "BASE_NATIVE_PROPERTIES" },
						messageId: "noNativePropertiesSpread",
					},
				],
			},
			{
				code: "const DEFAULT = {}; function Component(props) { const merge = { ...DEFAULT, ...props }; return <frame {...merge} />; }",
				errors: [
					{
						data: { source: "DEFAULT" },
						messageId: "noElementSpread",
					},
				],
			},
			{
				code: "const DEFAULT = {}; function Component(props) { return <frame {...{ ...DEFAULT, ...props }} />; }",
				errors: [
					{
						data: { source: "DEFAULT" },
						messageId: "noElementSpread",
					},
				],
			},
		],
		valid: [
			{
				code: "const view = <Frame nativeProperties={SOME_CONSTANT} />;",
			},
			{
				code: "const view = <Frame nativeProperties={{ Size: UDim2.fromScale(1, 1) }} />;",
			},
			{
				code: "const view = <Frame strokeNativeProperties={{ ...strokeNativeProperties }} />;",
			},
			{
				code: "const view = <TextLabel textGradientNativeProperties={{ ...props?.nativeProperties, Rotation: 90 }} />;",
			},
			{
				code: "const view = <Frame someOtherProp={{ ...SOME_CONSTANT }} />;",
			},
			{
				code: "const view = <Frame nativeProperties={{ ...entry.frameStyle.nativeProperties, LayoutOrder: entry.layoutOrder }} />;",
			},
			{
				code: "const mergedNativeProperties = { Size: UDim2.fromScale(1, 1) }; const view = <Frame nativeProperties={mergedNativeProperties} />;",
			},
			{
				code: "const view = <Frame nativeProperties={createNativeProperties()} />;",
			},
			{
				code: "const nativeProperties = SOME_CONSTANT; const view = <Frame nativeProperties={nativeProperties} />;",
			},
			{
				code: 'const BASE_NATIVE_PROPERTIES = {}; const MERGED_NATIVE_PROPERTIES = { ...BASE_NATIVE_PROPERTIES, Text: "hello" }; const view = <Frame nativeProperties={MERGED_NATIVE_PROPERTIES} />;',
			},
			{
				code: "function Component(props) { return <frame {...props} />; }",
			},
			{
				code: "function Component(nativeProperties) { return <Frame nativeProperties={{ ...nativeProperties }} />; }",
			},
			{
				code: "const DEFAULT = {}; const view = <frame {...DEFAULT} />;",
			},
			{
				code: "function Component(props) { return <frame {...{ ...props, extra: true }} />; }",
			},
		],
	});
});
