import { describe } from "vitest";
import rule from "$oxc-rules/no-underscore-react-properties";

import { tsx } from "./rule-testers";

describe("no-underscore-react-props", () => {
	tsx.run("no-underscore-react-props", rule, {
		invalid: [
			{
				code: `
<InventoryItemTooltip
    key="inventory-tooltip"
    _tooltipGradient={tooltipGradient}
/>;
`,
				documentation: { id: "fail", title: "Underscored React prop" },
				errors: [{ data: { propName: "_tooltipGradient" }, messageId: "noUnderscoreReactProperty" }],
			},
			{
				code: `
function Component() {
    return <Widget _private mode="enabled" _version={1} />;
}
`,
				errors: [
					{ data: { propName: "_private" }, messageId: "noUnderscoreReactProperty" },
					{ data: { propName: "_version" }, messageId: "noUnderscoreReactProperty" },
				],
			},
			{
				code: `
const view = <panel _ />;
`,
				errors: [{ data: { propName: "_" }, messageId: "noUnderscoreReactProperty" }],
			},
		],
		valid: [
			{
				code: `
<InventoryItemTooltip
	    key="inventory-tooltip"
	    tooltipGradient={tooltipGradient}
/>;
`,
				documentation: { id: "pass", title: "Regular React prop" },
			},
			{
				code: `
function Component() {
    return <Widget tooltipGradient={tooltipGradient} />;
}
`,
			},
			{
				code: `
const view = <Widget {...props} />;
`,
			},
			{
				code: `
const view = <Widget tooltip_gradient={gradient} />;
`,
			},
			{
				code: `
const _tooltipGradient = "gradient";
const view = <Widget tooltipGradient={_tooltipGradient} />;
`,
			},
			{
				code: `
const view = <Widget xml:lang="en" />;
`,
			},
		],
	});
});
