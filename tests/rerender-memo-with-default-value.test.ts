import { describe } from "vitest";
import rule from "$oxc-rules/rerender-memo-with-default-value";

import { ts } from "./rule-testers";

describe("rerender-memo-with-default-value", () => {
	ts.run("rerender-memo-with-default-value", rule, {
		invalid: [
			{
				code: `
function Component({ options = {} }) {
    return options;
}
`,
				errors: [{ messageId: "emptyObjectDefault" }],
			},
			{
				code: `
function Component({ items = [] } = {}) {
    return items;
}
`,
				errors: [{ messageId: "emptyArrayDefault" }, { messageId: "emptyObjectDefault" }],
			},
			{
				code: `
const Component = ({ options = {} } = {}) => {
    return options;
};
`,
				errors: [{ messageId: "emptyObjectDefault" }, { messageId: "emptyObjectDefault" }],
			},
			{
				code: `
const Component = ({ items = [] }) => {
    return items;
};
`,
				errors: [{ messageId: "emptyArrayDefault" }],
			},
			{
				code: `
function Component({ items = [], ...props }) {
    return props;
}
`,
				errors: [{ messageId: "emptyArrayDefault" }],
			},
		],
		valid: [
			{
				code: `
function component({ options = {} }) {
    return options;
}
`,
			},
			{
				code: `
const component = ({ options = {} } = {}) => {
    return options;
};
`,
			},
			{
				code: `
function Component({ options = { enabled: true } }) {
    return options;
}
`,
			},
			{
				code: `
const EMPTY_ITEMS = [];
const EMPTY_OPTIONS = {};

const Component = ({ items = EMPTY_ITEMS } = EMPTY_OPTIONS) => {
    return items;
};
`,
			},
			{
				code: `
function Component({ options }) {
    return options;
}
`,
			},
			{
				code: `
function Component(props) {
    return props;
}
`,
			},
			{
				code: `
const Component = notAComponentFactory();
`,
			},
			{
				code: `
const Component = function ({ options = { enabled: true } }) {
    return options;
};
`,
			},
		],
	});
});
