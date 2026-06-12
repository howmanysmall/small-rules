import { describe } from "vitest";
import rule from "$oxc-rules/prefer-hoisted-jsx-elements";

import { tsx } from "./rule-testers";

describe("prefer-hoisted-jsx-elements", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("prefer-hoisted-jsx-elements", rule, {
		invalid: [
			{
				code: `
function View() {
	return <staticbadge />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <roundedpanel radius={8} />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return (
		<layoutframe opacity={0}>
			<roundedpanel radius={8} />
			<staticbadge ratio={1} />
		</layoutframe>
	);
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View({ visible }: { readonly visible: boolean }) {
	return (
		<layoutframe visible={visible}>
			<roundedpanel radius={8} />
			<staticbadge ratio={1} />
		</layoutframe>
	);
}
`,
				errors: [{ messageId: "hoistableJsxElement" }, { messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <IconSprite variant="label"><staticgradient /></IconSprite>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ additionalHoistableComponents: ["IconSprite"] }],
			},
			{
				code: `
function View() {
	return <IconSprite
		variant="label"
		icon={createIconToken("App", "Lock")}
	>
		<staticgradient />
	</IconSprite>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [
					{
						additionalHoistableComponents: ["IconSprite"],
						additionalStaticFactories: ["createIconToken"],
					},
				],
			},
			{
				code: `
const CORNER = <roundedpanel radius={8} />;
function View() {
	return <layoutframe opacity={0}>{CORNER}</layoutframe>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
		],
		valid: [
			{
				code: `
function View() {
	return <Component enabled={true} />;
}
`,
			},
			{
				code: `
function View() {
	return <svg:path />;
}
`,
			},
			{
				code: `
function View({ visible }: { readonly visible: boolean }) {
	return <layoutframe visible={visible} />;
}
`,
			},
			{
				code: `
function handleActivate() {}

function View() {
	return <layoutframe Event={{ Activate: handleActivate }} />;
}
`,
			},
			{
				code: `
function handleValueChange() {}

function View() {
	return <inputfield Change={{ Value: handleValueChange }} />;
}
`,
			},
			{
				code: `
function View() {
	return <layoutframe {...FRAME_PROPERTIES} />;
}
`,
			},
			{
				code: `
function View({ title }: { readonly title: string }) {
	return <layoutframe>{title}</layoutframe>;
}
`,
			},
			{
				code: `
function View() {
	return <borderstroke color={undefined} />;
}
`,
			},
			{
				code: `
function FirstView() {
	return <borderstroke color={undefined} />;
}

function SecondView() {
	return <borderstroke color={undefined} />;
}
`,
			},
			{
				code: `
function View() {
	return <borderstroke color={void 0} />;
}
`,
			},
			{
				code: `
function View() {
	return <borderstroke color={MISSING_COLOR} />;
}
`,
			},
			{
				code: `
const EMPTY_COLOR = void 0;

function View() {
	return <borderstroke color={EMPTY_COLOR} />;
}
`,
			},
			{
				code: `
const EMPTY_COLOR = EMPTY_COLOR;

function View() {
	return <borderstroke color={EMPTY_COLOR} />;
}
`,
			},
			{
				code: `
function View() {
	const radius = 8;

	return <roundedpanel radius={radius} />;
}
`,
			},
			{
				code: `
const STATIC_BADGE = <staticbadge ratio={1} />;

function View() {
	return STATIC_BADGE;
}
`,
			},
			{
				code: `
const ROUNDED_PANEL = <roundedpanel radius={8} />;

function FirstView() {
	return ROUNDED_PANEL;
}

function SecondView() {
	return ROUNDED_PANEL;
}
`,
			},
			{
				code: `
const LOCK_ICON = (
	<IconSprite variant="label">
		<staticbadge />
		<staticgradient />
	</IconSprite>
);

function View() {
	return LOCK_ICON;
}
`,
			},
			{
				code: `
const LOCK_ICON = (
	<IconSprite variant="label">
		<staticbadge />
		<staticgradient />
	</IconSprite>
);

function View() {
	return LOCK_ICON;
}
`,
				options: [{ additionalHoistableComponents: ["IconSprite"] }],
			},
			{
				code: `
const EXTRA_ICON_LAYERS = (
	<>
		<InlineIcon
			key="left-icon"
			style={{ anchor: [0.5, 0.5] }}
			icon="icon-1"
		/>
		<InlineIcon
			key="right-icon"
			style={{ anchor: [0.5, 0.5] }}
			icon="icon-2"
		/>
	</>
);

function View() {
	return EXTRA_ICON_LAYERS;
}
`,
				options: [{ additionalHoistableComponents: ["InlineIcon"] }],
			},
			{
				code: `
function View() {
	return <IconSprite
		variant="label"
		icon={createIconToken("App", "Lock")}
	/>;
}
`,
				options: [{ additionalHoistableComponents: ["IconSprite"] }],
			},
			{
				code: `
const LOCK_ICON = (
	<IconSprite
		variant="label"
		icon={createIconToken("App", "Lock")}
	>
		<staticgradient />
	</IconSprite>
);

function View() {
	return LOCK_ICON;
}
`,
				options: [
					{
						additionalHoistableComponents: ["IconSprite"],
						additionalStaticFactories: ["createIconToken"],
					},
				],
			},
			{
				code: `
const CORNER = <roundedpanel radius={8} />;
const FRAME = <layoutframe opacity={0}>{CORNER}</layoutframe>;

function View() {
	return FRAME;
}
`,
			},
		],
	});
});
