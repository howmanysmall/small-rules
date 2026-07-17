import { describe } from "vitest";
import rule from "$oxc-rules/prefer-hoisted-jsx-object-properties";

import { tsx } from "./rule-testers";

describe("prefer-hoisted-jsx-object-properties", () => {
	tsx.run("prefer-hoisted-jsx-object-properties", rule, {
		invalid: [
			{
				code: `
function View() {
	return <Component options={{ enabled: true, count: 5 }} />;
}
`,
				documentation: { id: "fail", title: "Inline JSX object property" },
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component scrollingProperties={{ anchor: [0, 0], axis: "x" }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
import { center, fill, fullSize } from "utils";

function View() {
	return <Panel rootProperties={{ anchor: center, position: fill, size: fullSize }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component config={{ inner: { value: 1 } }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component size={{ value: { width: 100, height: 200 } }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component color={{ value: "red" }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component sequence={{ value: [0] }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component textProperties={{ text: "Equip", scaled: true }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component options={/* stable */ { enabled: true }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
function View() {
	return <Component config={{ nested: { items: [{ value: 1 }] } }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
const ANCHOR = { x: 0.5, y: 0.5 };

function View() {
	return <Component config={{ anchor: ANCHOR }} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
			{
				code: `
import { center, HIGHLIGHT_COLOR } from "utils";

function View({ isOpen }: { readonly isOpen: boolean }) {
	return <Component decorArrowsProperties={{
		glowProperties: { style: { color: HIGHLIGHT_COLOR } },
		isOpen,
		style: {
			anchor: center,
			position: { x: 0.7, y: 0.125 },
			size: { width: 0.08, height: 0.097 },
		},
	}} />;
}
`,
				errors: [{ messageId: "hoistableObjectProp" }, { messageId: "hoistableObjectProp" }],
			},
			{
				code: `
import { center } from "utils";

function View({ isOpen }: { readonly isOpen: boolean }) {
	return <Component frameProperties={{
		aspectRatio: 0.95,
		glowProperties: { style: { visible: false } },
		visible: isOpen,
		style: {
			anchor: center,
			position: { x: 0.5, y: 0.484 },
			size: { width: 1, height: 0.85 },
			zIndex: 5001,
		},
		outlineProperties: { visible: false },
	}} />;
}
`,
				errors: [
					{ messageId: "hoistableObjectProp" },
					{ messageId: "hoistableObjectProp" },
					{ messageId: "hoistableObjectProp" },
				],
			},
			{
				code: `
const [view] = [<Component options={{ enabled: true }} />];
`,
				errors: [{ messageId: "hoistableObjectProp" }],
			},
		],
		valid: [
			{
				code: `
const PROPS = { enabled: true };

const view = <Component options={PROPS} />;
`,
				documentation: { id: "pass", title: "Hoisted JSX property object" },
			},
			{
				code: `
const ICON = <IconSprite style={{ anchor: center, opacity: 0 }} />;
`,
			},
			{
				code: `
const STATIC_ICON_LAYERS = (
	<React.Fragment key="icon-layers">
		<InlineIcon
			key="brand-mark"
			style={{
				anchor: center,
				opacity: 0,
				position: LOGO_POSITION,
				size: LOGO_SIZE,
				zIndex: 201,
			}}
			highlighted={true}
			icon={createIconToken("App", "BrandMark")}
		/>
	</React.Fragment>
);
`,
			},
			{
				code: `
function MyComponent({ title }: { title: string }) {
	return <Component textProperties={{ text: title, scaled: true }} />;
}
`,
			},
			{
				code: `
function MyComponent() {
	const [count, setCount] = useState(0);

	return <Component data={{ count }} />;
}
`,
			},
			{
				code: `
const base = { a: 1 };

const view = <Component options={{ ...base, b: 2 }} />;
`,
			},
			{
				code: `
const key = "dynamic";

const view = <Component options={{ [key]: 1 }} />;
`,
			},
			{
				code: `
const view = <Component handlers={{ onClick: () => console.log("clicked") }} />;
`,
			},
			{
				code: `
const view = <Component layout={{ fallback: <div /> }} />;
`,
			},
			{
				code: `
function MyComponent({ title }: { title: string }) {
	return <Component options={{ enabled: true, label: title }} />;
}
`,
			},
			{
				code: `
const view = <Component name="hello" />;
`,
			},
			{
				code: `
const view = <Component options />;
`,
			},
			{
				code: `
const view = <Component options={undefined} />;
`,
			},
			{
				code: `
const view = <Component count={5} />;
`,
			},
			{
				code: `
const view = <Component items={[1, 2, 3]} />;
`,
			},
			{
				code: `
const ELEMENTS = [<Component options={{ enabled: true }} />];
`,
			},
			{
				code: `
const VIEW = (
	<>
		<Component options={{ enabled: true }} />
	</>
);
`,
			},
		],
	});
});
