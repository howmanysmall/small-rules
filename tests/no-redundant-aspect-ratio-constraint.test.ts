import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/no-redundant-aspect-ratio-constraint";

import { tsx } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "no-redundant-aspect-ratio-constraint");
const WITH_CONSTRAINT = join(FIXTURES, "with-constraint");
const WITHOUT_CONSTRAINT = join(FIXTURES, "without-constraint");

describe("no-redundant-aspect-ratio-constraint", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-redundant-aspect-ratio-constraint", rule, {
		invalid: [
			{
				code: `
const UI_ASPECT_RATIO_CONSTRAINT = <uiaspectratioconstraint AspectRatio={1.5} />;

function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon">
		{UI_ASPECT_RATIO_CONSTRAINT}
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
			},
			{
				code: `
const LabelSpritesheet = ({ children }: { children?: React.ReactNode }) => (
	<imagelabel>
		{children}
		<uiaspectratioconstraint AspectRatio={1.5} />
	</imagelabel>
);

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
			},
			{
				code: `
import { LabelSpritesheet } from "../components/label-spritesheet";

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { LabelSpritesheet } from "../components/label-spritesheet";

const UI_ASPECT_RATIO_CONSTRAINT = <uiaspectratioconstraint AspectRatio={1.5} />;

const view = (
	<LabelSpritesheet sprite="icon">
		<uigradient Color={gradient} />
		{UI_ASPECT_RATIO_CONSTRAINT}
		<textlabel Text="hello" />
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { GenericSpritesheet } from "../components/generic-spritesheet";

const view = (
	<GenericSpritesheet imageType={0}>
		<uiaspectratioconstraint AspectRatio={1.5} />
	</GenericSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
				filename: join(WITHOUT_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon" scaled={true}>
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
				errors: [{ messageId: "redundantAspectRatioConstraint" }],
			},
		],
		valid: [
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uigradient Color={gradient} />
		<textlabel Text="hello" />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
const LabelSpritesheet = ({ children }: { children?: React.ReactNode }) => {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
};

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	const ratio = 1.5;
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={ratio} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return;
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
function LabelSpritesheet() {
	return null;
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
const LabelSpritesheet = ({ children }: { children?: React.ReactNode }) => (
	<imagelabel>{children}</imagelabel>
);

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return <imagelabel>{children}</imagelabel>;
}

const view = (
	<LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
import { LabelSpritesheet } from "../components/label-spritesheet";

const view = (
	<LabelSpritesheet sprite="icon">
		<uigradient Color={gradient} />
		<textlabel Text="hello" />
	</LabelSpritesheet>
);
`,
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { RegularLabel } from "../components/label-spritesheet";

const view = (
	<RegularLabel sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</RegularLabel>
);
`,
				filename: join(WITHOUT_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { RegularLabel } from "@components/label-spritesheet";

const view = (
	<RegularLabel sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</RegularLabel>
);
`,
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { MissingSpritesheet } from "../components/missing-spritesheet";

const view = (
	<MissingSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</MissingSpritesheet>
);
`,
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
const UI_ASPECT_RATIO_CONSTRAINT = <uiaspectratioconstraint AspectRatio={1.5} />;

const view = (
	<SomeOtherComponent>
		{UI_ASPECT_RATIO_CONSTRAINT}
	</SomeOtherComponent>
);
`,
			},
			{
				code: `
const view = (
	<Layout.LabelSpritesheet sprite="icon">
		<uiaspectratioconstraint AspectRatio={1.5} />
	</Layout.LabelSpritesheet>
);
`,
			},
			{
				code: `
import { GenericSpritesheet } from "../components/generic-spritesheet";

const view = (
	<GenericSpritesheet imageType={0}>
		<textlabel Text="hello" />
	</GenericSpritesheet>
);
`,
				filename: join(WITHOUT_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
function LabelSpritesheet({ children }: { children?: React.ReactNode }) {
	return (
		<imagelabel>
			{children}
			<uiaspectratioconstraint AspectRatio={1.5} />
		</imagelabel>
	);
}

const view = (
	<LabelSpritesheet sprite="icon" scaled={false}>
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
			},
			{
				code: `
import { LabelSpritesheet } from "../components/label-spritesheet";

const view = (
	<LabelSpritesheet sprite="icon" scaled={false}>
		<uiaspectratioconstraint AspectRatio={1.5} />
	</LabelSpritesheet>
);
`,
				filename: join(WITH_CONSTRAINT, "src", "screens", "example.tsx"),
			},
			{
				code: `
import { GenericSpritesheet } from "../components/generic-spritesheet";

const view = (
	<GenericSpritesheet imageType={0} scaled={false}>
		<uiaspectratioconstraint AspectRatio={1.5} />
	</GenericSpritesheet>
);
`,
				filename: join(WITHOUT_CONSTRAINT, "src", "screens", "example.tsx"),
			},
		],
	});
});
