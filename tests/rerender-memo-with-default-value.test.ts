import { describe } from "vitest";
import rule from "$oxc-rules/rerender-memo-with-default-value";

import { ts } from "./rule-testers";

describe("rerender-memo-with-default-value", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
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
		],
	});
});
