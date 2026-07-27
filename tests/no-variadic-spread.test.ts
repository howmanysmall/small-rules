import { describe } from "vitest";
import rule from "$oxc-rules/no-variadic-spread";

import { ts } from "./rule-testers";

describe("no-variadic-spread", () => {
	ts.run("no-variadic-spread", rule, {
		invalid: [
			{
				code: "target.push(...source);",
				documentation: { id: "fail", title: "Spreading an array into push()" },
				errors: [{ data: { method: "push" }, messageId: "noVariadicSpread" }],
			},
			{
				code: "target.unshift(...source);",
				errors: [{ data: { method: "unshift" }, messageId: "noVariadicSpread" }],
			},
			{
				code: "const largest = Math.max(...numbers);",
				errors: [{ data: { method: "Math.max" }, messageId: "noVariadicSpread" }],
			},
			{
				code: "const smallest = Math.min(...numbers);",
				errors: [{ data: { method: "Math.min" }, messageId: "noVariadicSpread" }],
			},
			{
				code: "target.push(first, ...source);",
				errors: [{ messageId: "noVariadicSpread" }],
			},
			{
				code: "target.push(...first, ...second);",
				errors: [{ messageId: "noVariadicSpread" }, { messageId: "noVariadicSpread" }],
			},
			{
				code: "this.items.push(...source);",
				errors: [{ messageId: "noVariadicSpread" }],
			},
			{
				code: 'target["push"](...source);',
				errors: [{ data: { method: "push" }, messageId: "noVariadicSpread" }],
			},
			{
				code: "target?.push(...source);",
				errors: [{ messageId: "noVariadicSpread" }],
			},
			{
				code: "Math.max(...numbers.map((value) => value.score));",
				errors: [{ data: { method: "Math.max" }, messageId: "noVariadicSpread" }],
			},
		],
		valid: [
			{
				code: "for (const item of source) target.push(item);",
				documentation: { id: "pass", title: "Pushing elements one at a time" },
			},
			{ code: "const copy = [...source];" },
			{ code: "target.push(...[1, 2, 3]);" },
			{ code: "const largest = Math.max(...[1, 2, 3]);" },
			{ code: "foo(...source);" },
			{ code: "push(...source);" },
			{ code: "const largest = Math.max(1, 2);" },
			{ code: "target[method](...source);" },
			{ code: "target.concat(...source);" },
			{ code: "const rounded = Math.round(...source);" },
			{ code: "const largest = notMath.max(...source);" },
			{ code: "const largest = utility.math.max(...source);" },
			{ code: "target.push(item);" },
			{ code: "const values = new Array(...source);" },
		],
	});
});
