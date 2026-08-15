import { describe } from "vitest";
import rule from "$oxc-rules/general/no-filter-map-chain";

import { ts } from "./rule-testers";

describe("no-filter-map-chain", () => {
	ts.run("no-filter-map-chain", rule, {
		invalid: [
			{
				code: `
const baseArray = [1, 2, 3, 4, 5, 6, 7];
const array = baseArray
	.filter((value) => value % 2 === 0)
	.map((value) => value * 2);
`,
				documentation: { id: "fail", title: "filter followed by map" },
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: 'const result = values["filter"](predicate)["map"](transform);',
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: "const result = (values.filter(predicate) satisfies number[]).map(transform);",
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: "const result = values.filter(predicate)!.map(transform);",
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: "const result = values?.filter(predicate).map(transform);",
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: "const result = values.filter?.(predicate)?.map(transform);",
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: 'const result = values?.["filter"](predicate)?.["map"](transform);',
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: `
const query = {
	filter: (_predicate: (value: number) => boolean) => ({ map: (transform: (value: number) => number) => transform(1) }),
};
const result = query.filter(predicate).map(transform);
`,
				errors: [{ messageId: "avoidFilterMapChain" }],
			},
			{
				code: `
const first = values.filter(predicate).map(transform);
const second = otherValues.filter(otherPredicate).map(otherTransform);
`,
				errors: [{ messageId: "avoidFilterMapChain" }, { messageId: "avoidFilterMapChain" }],
			},
		],
		valid: [
			"const result = values.filter(predicate);",
			"const result = values.map(transform);",
			"const result = values.map(transform).filter(predicate);",
			`
const filtered = values.filter(predicate);
const result = filtered.map(transform);
`,
			"const result = values.filter(predicate).slice().map(transform);",
			"const result = values[filterMethod](predicate).map(transform);",
			"const result = values.filter(predicate)[mapMethod](transform);",
			"const result = values.filterMap(predicate, transform);",
			"const result = values.flatMap(transform);",
			"const result = values.filter.map(transform);",
			"const result = values.filter(predicate).map;",
			"const result = Array.prototype.filter.call(values, predicate).map(transform);",
			{
				code: `
const baseArray = [1, 2, 3, 4, 5, 6, 7];
const filteredArray = new Array<number>();
for (const value of baseArray) {
	if (value % 2 !== 0) continue;
	filteredArray.push(value * 2);
}
`,
				documentation: { id: "pass", title: "single-pass filtering and mapping" },
			},
		],
	});
});
