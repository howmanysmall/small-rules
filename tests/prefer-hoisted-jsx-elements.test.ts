import { describe } from "vitest";
import rule from "$oxc-rules/prefer-hoisted-jsx-elements";

import { tsx } from "./rule-testers";

describe("prefer-hoisted-jsx-elements", () => {
	tsx.run("prefer-hoisted-jsx-elements", rule, {
		invalid: [
			{
				code: `
function View() {
	return <staticbadge />;
}
`,
				documentation: { id: "fail", title: "Inline static JSX element" },
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "roblox-ts" }],
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
function View() {
	return <roundedpanel>{/* stable */}</roundedpanel>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <borderstroke color={null} />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
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
			{
				code: `
function View() {
	return <div>Hello</div>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { EmptyState } from "./empty-state";

function View() {
	return <EmptyState />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as Icons from "./icons";

function View() {
	return <Icons.Empty />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
function View() {
	return <><div>Ready</div><span /></>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
function View() {
	return <frame>{<roundedpanel radius={8} />}</frame>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <my-widget Event="ready" Change={undefined} />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
declare function consume(value: JSX.Element): void;

while (Math.random() > 0.5) consume(<div />);
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
function FunctionComponent({ label }: { readonly label: string }) {
	return label;
}

function View() {
	return <FunctionComponent label="ready" />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
class ClassComponent extends React.Component<{ readonly label: string }> {
	public render() {
		return this.props.label;
	}
}

function View() {
	return <ClassComponent label="ready" />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
const ConstantComponent = ({ label }: { readonly label: string }) => label;

function View() {
	return <ConstantComponent label="ready" />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as Icons from "./icons";

function View() {
	return <Icons.Empty />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
				options: [{ additionalHoistableComponents: ["Icons"] }],
			},
			{
				code: `
const CONTENT = <><frame /><frame /></>;

function View() {
	return <folder>{CONTENT}</folder>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <frame color={Color3.fromRGB(255, 0, 0)} />;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
let FRAME = <frame />;
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
function View() {
	return <frame>{1 + 2}</frame>;
}
`,
				errors: [{ messageId: "hoistableJsxElement" }],
			},
			{
				code: `
const LABEL = "ready";

function View() {
	return <frame>{LABEL}</frame>;
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
				documentation: { id: "pass", title: "Dynamic component element" },
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
function View() {
	return <borderstroke>{...children}</borderstroke>;
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
const CORNER = <roundedpanel radius={8} />;

function View({ visible }: { readonly visible: boolean }) {
	return <layoutframe visible={visible}>{CORNER}</layoutframe>;
}
`,
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
const LABEL = "ready";

function View({ visible }: { readonly visible: boolean }) {
	return <layoutframe visible={visible}>{LABEL}</layoutframe>;
}
`,
			},
			{
				code: `
const FRAME = (
	<>
		{<roundedpanel radius={8} />}
	</>
);

function View() {
	return FRAME;
}
`,
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
			{
				code: `
function View() {
	return <div>Hello</div>;
}
`,
			},
			{
				code: `
function View() {
	const Empty = ({ label }: { readonly label: string }) => <div>{label}</div>;
	return <Empty label="none" />;
}
`,
				options: [{ additionalHoistableComponents: ["Empty"], environment: "standard" }],
			},
			{
				code: `
const FRAME = (<frame /> as React.ReactNode);
const PANEL = (<roundedpanel /> satisfies React.ReactNode);

function FrameView() {
	return FRAME;
}

function PanelView() {
	return PANEL;
}
`,
			},
			{
				code: `
function View() {
	const props = { opacity: 0 };
	return <frame {...props} />;
}
`,
			},
			{
				code: `
declare function First(): JSX.Element;
declare function Second(): JSX.Element;

let Current = First;

function View() {
	return <Current />;
}

Current = Second;
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
declare function First(): JSX.Element;
declare function Second(): JSX.Element;

let Components = { Current: First };

function View() {
	return <Components.Current />;
}

Components = { Current: Second };
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { randomUUID } from "node:crypto";

function View() {
	return <div id={randomUUID()} />;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
const LOOP = <frame>{LOOP}</frame>;

function View() {
	return <folder>{LOOP}</folder>;
}
`,
			},
			{
				code: `
function View() {
	return <div value={(function getValue() { return 1; })()} />;
}
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
