import { describe } from "vitest";
import rule from "$oxc-rules/no-render-helper-functions";

import { tsx } from "./rule-testers";

describe("no-render-helper-functions", () => {
	tsx.run("no-render-helper-functions", rule, {
		invalid: [
			{
				code: "function createLabel() { return <div />; }",
				documentation: { id: "fail", title: "Lowercase render helper" },
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createLeftLabel(text: string) { return <TextLabel text={text} />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function renderHeader() { return <header>Header</header>; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = () => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = (): React.ReactNode => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel: React.ReactNode = () => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const createLabel = (): ReactNode => <div />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderItem = (item: string) => <div>{item}</div>;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createRightLabel(text: string, gradient: ColorSequence, rotation: number | undefined): React.ReactNode { return <TextLabel />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const buildElement = () => { return <div><span>Nested</span></div>; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function makeFragment() { return <>Fragment Content</>; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const get_label = () => <label />;",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): JSX.Element { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): React.ReactElement { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): React.ReactNode { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): Foo.Bar { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function createButton(): ReactElement { return <button />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "export function createLayout() { return <div />; }",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: `function createLabel(text: string): React.ReactNode {
    return (
        <TextLabel
            nativeProperties={{ Text: text }}
            strokeEnabled={true}
        />
    );
}`,
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "const renderPanel = function() { return <div />; };",
				errors: [{ messageId: "noRenderHelper" }],
			},
			{
				code: "function renderEmpty(): React.ReactNode { return <div />; } const value = { autoFill: { renderEmpty } }; renderEmpty();",
				errors: [{ messageId: "noRenderHelper" }],
			},
		],
		valid: [
			{
				code: "function Component() { return <div />; }",
				documentation: { id: "pass", title: "Named component function" },
			},
			"function MyComponent() { return <div />; }",
			"function MyComponent(props: Props) { return <div>{props.children}</div>; }",
			"const Component = () => <div />;",
			"const Component = (): JSX.Element => <div />;",
			"const Component = function() { return <div />; };",
			"export function HeaderComponent() { return <header />; }",
			"function useCustomHook() { return <div />; }",
			"function useFetchData(): React.ReactNode { return <div />; }",
			"const useData = () => <div />;",
			"function createUser(name: string) { return { name }; }",
			"const createId = () => Math.random();",
			"function buildConfig() { return { setting: true }; }",
			"const renderString = () => 'text';",
			"function getNumber() { return 42; }",
			{
				code: "items.map(item => <div key={item.id}>{item.name}</div>)",
			},
			{
				code: "const Component = () => { const inline = () => <span />; return <div />; };",
			},
			{
				code: "array.filter(x => x.active).map(x => <Item key={x.id} data={x} />)",
			},
			{
				code: "<Button onClick={() => <Modal />} />",
			},
			{
				code: "foo(function helper() { return <div />; });",
			},
			"class MyClass { render() { return <div />; } }",
			"class MyClass { renderItem() { return <div />; } }",
			{
				code: "function Component() { function helper() { return 'text'; } return <div>{helper()}</div>; }",
			},
			{
				code: "const List = () => { const renderItem = (item: string) => item.toUpperCase(); return <div />; };",
			},
			{
				code: "function renderEmpty(): React.ReactNode { return <div />; } const value = { autoFill: { renderEmpty } };",
			},
			{
				code: "const renderEmpty = () => <div />; const value = { autoFill: { renderEmpty: (renderEmpty) } };",
			},
			{
				code: "const renderEmpty = () => <div />; const value = { autoFill: { renderEmpty: renderEmpty as () => React.ReactNode } };",
			},
			{
				code: "let renderEmpty = () => <div />; renderEmpty = otherRenderer; const value = { autoFill: { renderEmpty } };",
			},
			{
				code: "const value = { renderEmpty: function(): React.ReactNode { return <div />; } };",
			},
			{
				code: "const [renderEmpty = () => <div />] = values;",
			},
			{
				code: "const value = { renderEmpty: (function renderEmpty(): React.ReactNode { return <div />; }) };",
			},
			{
				code: "function createPortal(): React.ReactPortal { return portal; }",
			},
			{
				code: "declare function createNode(): React.ReactNode;",
			},
			{
				code: "export default function(): JSX.Element { return <div />; }",
			},
		],
	});
});
