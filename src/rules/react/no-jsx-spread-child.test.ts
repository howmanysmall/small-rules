import { describe } from "vitest";
import { tsx } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/react/no-jsx-spread-child";

const SPREAD_CHILD_ERROR = [{ messageId: "noJsxSpreadChild" }];

describe("no-jsx-spread-child", () => {
	tsx.run("no-jsx-spread-child", rule, {
		invalid: [
			{
				code: "const list = <List>{...items.map(render)}</List>;",
				errors: [{ messageId: "noJsxSpreadChild" }],
				documentation: { id: "fail", title: "Spread between JSX tags" },
			},
			{ code: "const list = <List>{...items}</List>;", errors: SPREAD_CHILD_ERROR },
			{
				code: "const list = <><frame>{...rows}</frame><frame>{...columns}</frame></>;",
				errors: [...SPREAD_CHILD_ERROR, ...SPREAD_CHILD_ERROR],
			},
		],
		valid: [
			{
				code: "const list = <List>{items.map(render)}</List>;",
				documentation: { id: "pass", title: "Array child without a spread" },
			},
			"const list = <List {...properties} />;",
			"const list = <List>{items}{footer}</List>;",
			"const merged = [...items];",
			"const call = render(...items);",
		],
	});
});
