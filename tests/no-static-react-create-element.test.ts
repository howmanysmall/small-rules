import { describe } from "vitest";
import rule from "$oxc-rules/no-static-react-create-element";

import { tsx } from "./rule-testers";

describe("no-static-react-create-element", () => {
	tsx.run("no-static-react-create-element", rule, {
		invalid: [
			{
				code: `
import * as React from "@rbxts/react";

const element = React.createElement("frame");
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement("frame");
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import { createElement } from "@rbxts/react";

const element = createElement("textlabel");
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import { createElement } from "react";

const element = createElement("div");
`,
				errors: [{ messageId: "useJsx" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { createElement as create } from "@rbxts/roact";

const element = create("frame");
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";
import Button from "./button";

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";
import * as Components from "./components";

const element = React.createElement(Components.Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";
import * as Components from "./components";

const element = React.createElement(Components.Button.Icon);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Button() {
	return <frame />;
}

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

class Button extends React.Component {
	render() {
		return <frame />;
	}
}

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

const Button = () => <frame />;

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

const Button = function Button() {
	return <frame />;
};

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

const Button = class extends React.Component {
	render() {
		return <frame />;
	}
};

const element = React.createElement(Button);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(React.Fragment);
`,
				errors: [{ messageId: "useJsx" }],
			},
			{
				code: `
import { Fragment, createElement } from "@rbxts/react";

const element = createElement(Fragment);
`,
				errors: [{ messageId: "useJsx" }],
			},
		],
		valid: [
			{
				code: `
import React from "@rbxts/react";

const element = React["createElement"]("frame");
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = factory.React.createElement("frame");
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(config.component);
`,
			},
			{
				code: `
import React from "@rbxts/react";

function renderComponent(component: React.ElementType) {
	return React.createElement(component);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

interface Properties {
	readonly component: React.ElementType;
}

function renderComponent(properties: Properties) {
	const StackItemComponent = properties.component;

	return React.createElement(StackItemComponent);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";
import DefaultItem from "./default-item";

function renderComponent(itemComponent: React.ElementType | undefined) {
	const StackItemComponent = itemComponent ?? DefaultItem;

	return React.createElement(StackItemComponent);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function getComponent(): React.ElementType {
	return config.component;
}

const element = React.createElement(getComponent());
`,
			},
			{
				code: `
import { createElement } from "./factory";

const element = createElement("frame");
`,
			},
			{
				code: `
import createElement from "@rbxts/react";

const element = createElement("frame");
`,
			},
			{
				code: `
import { jsx as createElement } from "@rbxts/react";

const element = createElement("frame");
`,
			},
			{
				code: `
import React from "@rbxts/react";

import helper from "./helper";

const element = React.createElement(helper);
`,
			},
			{
				code: `
import React from "@rbxts/react";

const helper = () => <frame />;

const element = React.createElement(helper);
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = createElementFactory()("frame");
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(Button);
`,
			},
			{
				code: `
import React from "@rbxts/react";

let Button;

const element = React.createElement(Button);
`,
			},
			{
				code: `
import React from "@rbxts/react";

function renderComponent(React: { readonly createElement: (component: string) => unknown }) {
	return React.createElement("frame");
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(components[name]);
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement();
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(...args);
`,
			},
			{
				code: `
import React from "@rbxts/react";

const Button = getButton();

const element = React.createElement(Button);
`,
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement(getComponents().Button);
`,
			},
			{
				code: `
import React from "@rbxts/react";
import * as Components from "./components";

const element = React.createElement(Components[group].Button);
`,
			},
			{
				code: `
import React from "@rbxts/react";
import * as Components from "./components";

const element = React.createElement(Components.Button["Icon"]);
`,
			},
		],
	});
});
