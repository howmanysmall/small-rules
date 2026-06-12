import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/prefer-local-portal-component";

import { tsx } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "prefer-local-portal-component");
const WITH_PORTAL = join(FIXTURES, "with-portal");
const WITHOUT_PORTAL = join(FIXTURES, "without-portal");
const AMBIGUOUS_PORTAL = join(FIXTURES, "ambiguous-portal");
const FIXTURE_ONLY_PORTAL = join(FIXTURES, "fixture-only");

describe("prefer-local-portal-component", () => {
	// @ts-expect-error RuleTester types incompatible with runtime rule shape
	tsx.run("prefer-local-portal-component", rule, {
		invalid: [
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "example.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <Portal target={target}><frame /></Portal>;
}`,
			},
			{
				code: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return mountPortal(content, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "aliased.tsx"),
				output: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <PortalComponent target={target}>{content}</PortalComponent>;
}`,
			},
			{
				code: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "standard.tsx"),
				output: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return <Portal target={container}><div /></Portal>;
}`,
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "report-only.tsx"),
			},
		],
		valid: [
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: join(WITHOUT_PORTAL, "src", "screens", "example.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: join(AMBIGUOUS_PORTAL, "src", "screens", "example.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
        function createPortal() {
            return target;
        }

                    return createPortal();
    }`,
				filename: join(WITH_PORTAL, "src", "screens", "shadowed.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: join(FIXTURE_ONLY_PORTAL, "src", "screens", "example.tsx"),
			},
		],
	});
});
