import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/prefer-local-portal-component";

import { tsx } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "prefer-local-portal-component");
const WITH_PORTAL = join(FIXTURES, "with-portal");
const AMBIGUOUS_PORTAL = join(FIXTURES, "ambiguous-portal");
const FIXTURE_ONLY_PORTAL = join(FIXTURES, "fixture-only");

describe("prefer-local-portal-component", () => {
	tsx.run("prefer-local-portal-component", rule, {
		invalid: [
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				documentation: { id: "fail", title: "Direct portal call with local component" },
				errors: [{ messageId: "preferPortalComponent" }],
				filename: "tests/fixtures/prefer-local-portal-component/with-portal/src/screens/example.tsx",
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
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "report-only.js"),
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return createPortal(content, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "expression-child.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <Portal target={target}>{content}</Portal>;
}`,
			},
			{
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return createPortal(<>{content}</>, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				filename: join(WITH_PORTAL, "src", "screens", "fragment.tsx"),
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <Portal target={target}><>{content}</></Portal>;
}`,
			},
		],
		valid: [
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				documentation: { id: "pass", title: "Portal call without local component" },
				filename: "tests/fixtures/prefer-local-portal-component/without-portal/src/screens/example.tsx",
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
			{
				code: `import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM["createPortal"](<div />, container);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "computed-standard.tsx"),
			},
			{
				code: `import { createPortal } from "./portal-factory";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "local-factory.tsx"),
			},
			{
				code: `import * as ReactDOM from "./react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "local-namespace.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "missing-target.tsx"),
			},
			{
				code: `import createPortal from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "default-import.tsx"),
			},
			{
				code: `import { createPortal } from "@rbxts/react-roblox";

const ReactDOM = getReactDom();

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "local-object.tsx"),
			},
			{
				code: `export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				filename: join(WITH_PORTAL, "src", "screens", "global-object.tsx"),
			},
		],
	});
});
