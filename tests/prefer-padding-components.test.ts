import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/prefer-padding-components";

import { tsx } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "prefer-padding-components");
const WITH_COMPONENTS = join(FIXTURES, "with-components");
const WITHOUT_COMPONENTS = join(FIXTURES, "without-components");
const FIXTURE_ONLY_COMPONENTS = join(FIXTURES, "fixture-only");

describe("prefer-padding-components", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	tsx.run("prefer-padding-components", rule, {
		invalid: [
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "equal.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={padding} />;
}`,
			},
			{
				code: `import { DirectionalPadding as AxisPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={horizontal} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "directional.tsx"),
				output: `import { DirectionalPadding as AxisPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <AxisPadding horizontal={horizontal} vertical={vertical} />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding as UDim} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "normalized.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={padding} />;
}`,
			},
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "report-only.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";
import { EqualPadding as LegacyEqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "ambiguous-equal.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={horizontal} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "directional-report-only.js"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft="wide" PaddingRight="wide" PaddingTop={horizontal} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "directional-literals.tsx"),
				output: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <DirectionalPadding horizontal={horizontal} vertical="wide" />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop="large" />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "literal-values.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <EqualPadding padding="large" />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={{ padding }} PaddingLeft={{ padding }} PaddingRight={{ padding }} PaddingTop={{ padding }} />;
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "object-values.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <EqualPadding padding={{ padding }} />;
}`,
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={{ padding }} PaddingRight={{ padding }} PaddingTop={padding} />;
}`,
				errors: [{ messageId: "preferDirectionalPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "directional-object-values.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return (
        <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding}>
        </uipadding>
    );
}`,
				errors: [{ messageId: "preferEqualPadding" }],
				filename: join(WITH_COMPONENTS, "src", "screens", "whitespace-child.tsx"),
				output: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return (
        <EqualPadding padding={padding} />
    );
}`,
			},
		],
		valid: [
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: "",
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "missing-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "missing-side.tsx"),
			},
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITHOUT_COMPONENTS, "src", "screens", "missing.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding Name="Padding" PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "extra-props.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim, other: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={other} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "mismatch.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={[horizontal]} PaddingLeft={[vertical]} PaddingRight={[vertical]} PaddingTop={horizontal} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "array-vs-identifier.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={horizontal} PaddingLeft={vertical} PaddingRight={vertical} PaddingTop={[horizontal]} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "identifier-vs-array.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={[horizontal, vertical]} PaddingLeft={[vertical]} PaddingRight={[vertical]} PaddingTop={[horizontal]} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "array-length-mismatch.tsx"),
			},
			{
				code: `import { DirectionalPadding } from "../ui/directional-padding";

export function Example(horizontal: UDim, vertical: UDim) {
    return <uipadding PaddingBottom={[horizontal]} PaddingLeft={[vertical]} PaddingRight={[vertical]} PaddingTop={[vertical]} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "array-element-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={[padding]} PaddingLeft={[padding]} PaddingRight={[padding]} PaddingTop={[padding, padding]} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "record-length-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop={<frame />} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "jsx-expression-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop={Symbol("large")} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "symbol-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop=<frame /> />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "direct-jsx-attribute-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom={null} PaddingLeft={{}} PaddingRight={{}} PaddingTop={{}} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "object-shape-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={{ bottom: padding }} PaddingLeft={{ padding }} PaddingRight={{ padding }} PaddingTop={{ padding }} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "object-key-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={{ padding }} PaddingLeft={null} PaddingRight={{}} PaddingTop={{ padding }} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "object-vs-null.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={{ padding }} PaddingLeft={{ padding }} PaddingRight={{}} PaddingTop={{ padding }} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "nested-object-key-mismatch.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop={<>large</>} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "jsx-fragment-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example() {
    return <uipadding PaddingBottom="large" PaddingLeft="large" PaddingRight="large" PaddingTop={} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "empty-expression-value.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding}>content</uipadding>;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "meaningful-text-child.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding}>{content}</uipadding>;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "meaningful-expression-child.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding}>{}</uipadding>;
}`,
				filename: join(WITHOUT_COMPONENTS, "src", "screens", "empty-expression-child.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <Padding.uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "member-name.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

export function Example(padding: UDim) {
    return <roblox:uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "namespaced-name.tsx"),
			},
			{
				code: `import { EqualPadding } from "../ui/equal-padding";

const attributes = { PaddingBottom: padding };

export function Example(padding: UDim) {
    return <uipadding {...attributes} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(WITH_COMPONENTS, "src", "screens", "spread.tsx"),
			},
			{
				code: `export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
				filename: join(FIXTURE_ONLY_COMPONENTS, "src", "screens", "fixture.tsx"),
			},
			`export function Example(padding: UDim) {
    return <uipadding PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} PaddingTop={padding} />;
}`,
		],
	});
});
