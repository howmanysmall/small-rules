import nodePath from "node:path";
import { describe } from "vitest";

import rule from "$oxc-rules/react/prefer-local-portal-component";

import { tsx } from "./rule-testers";

const FIXTURES = nodePath.join(import.meta.dirname, "fixtures", "prefer-local-portal-component");
const WITH_PORTAL = nodePath.join(FIXTURES, "with-portal");
const AMBIGUOUS_PORTAL = nodePath.join(FIXTURES, "ambiguous-portal");
const FIXTURE_ONLY_PORTAL = nodePath.join(FIXTURES, "fixture-only");

describe("prefer-local-portal-component", () => {
	tsx.run("prefer-local-portal-component", rule, {
		invalid: [
			{
				filename: "tests/fixtures/prefer-local-portal-component/with-portal/src/screens/example.tsx",
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return <Portal target={target}><frame /></Portal>;
}`,
				errors: [{ messageId: "preferPortalComponent" }],
				documentation: { id: "fail", title: "Direct portal call with local component" },
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "aliased.tsx"),
				code: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return mountPortal(content, target);
}`,
				output: `import PortalComponent from "../components/portal";
import { createPortal as mountPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <PortalComponent target={target}>{content}</PortalComponent>;
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "standard.tsx"),
				code: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
				output: `import Portal from "../components/portal";
import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return <Portal target={container}><div /></Portal>;
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "report-only.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "report-only.js"),
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "expression-child.tsx"),
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return createPortal(content, target);
}`,
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <Portal target={target}>{content}</Portal>;
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "fragment.tsx"),
				code: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return createPortal(<>{content}</>, target);
}`,
				output: `import Portal from "../components/portal";
import { createPortal } from "@rbxts/react-roblox";

export function Example(content: React.ReactNode, target: Instance) {
    return <Portal target={target}><>{content}</></Portal>;
}`,
				errors: [{ messageId: "preferPortalComponent" }],
			},
		],
		valid: [
			{
				filename: nodePath.join(WITH_PORTAL, "src", "components", "portal.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export default function Portal({ target, children }: PortalProperties) {
    return target === undefined ? undefined : createPortal(children, target);
}`,
			},
			{
				filename: "",
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
			},
			{
				filename: "tests/fixtures/prefer-local-portal-component/without-portal/src/screens/example.tsx",
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
				documentation: { id: "pass", title: "Portal call without local component" },
			},
			{
				filename: nodePath.join(AMBIGUOUS_PORTAL, "src", "screens", "example.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "shadowed.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
        function createPortal() {
            return target;
        }

                    return createPortal();
    }`,
			},
			{
				filename: nodePath.join(FIXTURE_ONLY_PORTAL, "src", "screens", "example.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "computed-standard.tsx"),
				code: `import * as ReactDOM from "react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM["createPortal"](<div />, container);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "local-factory.tsx"),
				code: `import { createPortal } from "./portal-factory";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "local-namespace.tsx"),
				code: `import * as ReactDOM from "./react-dom";

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "missing-target.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "default-import.tsx"),
				code: `import createPortal from "@rbxts/react-roblox";

export function Example(target: Instance) {
    return createPortal(<frame />, target);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "local-object.tsx"),
				code: `import { createPortal } from "@rbxts/react-roblox";

const ReactDOM = getReactDom();

export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
			},
			{
				filename: nodePath.join(WITH_PORTAL, "src", "screens", "global-object.tsx"),
				code: `export function Example(container: HTMLElement) {
    return ReactDOM.createPortal(<div />, container);
}`,
			},
		],
	});
});
