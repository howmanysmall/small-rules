import { describe } from "vitest";
import rule from "$oxc-rules/ban-react-fc";

import { tsx } from "./rule-testers";

describe("ban-react-fc", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("ban-react-fc", rule, {
		invalid: [
			{
				code: "const Component: React.FC = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.FC<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.FC<Readonly<Props>> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.FC<{ children: React.ReactNode }> = ({ children }) => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "export const Component: React.FC<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.FunctionComponent<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: FC = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: FC<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: FunctionComponent<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.VFC<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: VFC<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: React.VoidFunctionComponent<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Component: VoidFunctionComponent<Props> = () => {};",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: `const UIInputProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <div>{children}</div>;
};`,
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "const Button: FC<ButtonProps> = ({ label }) => <button>{label}</button>;",
				errors: [{ messageId: "banReactFC" }],
			},
			{
				code: "export const Modal: React.FC = () => <div>Modal</div>;",
				errors: [{ messageId: "banReactFC" }],
			},
		],
		valid: [
			"function Component() {}",
			"function Component(props: Props) {}",
			"export function Component(props: Props) {}",
			"const Component = () => {};",
			"const Component = (props: Props) => {};",
			"const Component: (props: Props) => JSX.Element = () => {};",
			"const Component: () => void = () => {};",
			"class Component extends React.Component {}",
			"const Component = function() {};",
			"const x: React.FC = null;",
			"let isFC: React.FC = null;",
			"const mapper = { Component: React.FC };",
			"const Component: SomeOtherType = () => {};",
		],
	});
});
