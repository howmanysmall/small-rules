import { describe } from "vitest";
import rule from "$oxc-rules/no-identity-map";

import { ts } from "./rule-testers";

describe("no-identity-map", () => {
	ts.run("no-identity-map", rule, {
		invalid: [
			{
				code: "scaleBinding.map(v => v)",
				errors: [{ messageId: "identityBindingMap" }],
				output: "scaleBinding",
			},
			{
				code: "const result = shadowTransparencyBinding.map((trans: number) => trans);",
				errors: [{ messageId: "identityBindingMap" }],
				output: "const result = shadowTransparencyBinding;",
			},
			{
				code: "myBinding.map(v => { return v; })",
				errors: [{ messageId: "identityBindingMap" }],
				output: "myBinding",
			},

			{
				code: `
const [binding] = useBinding(0);
binding.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const [binding] = useBinding(0);
binding;
`,
			},
			{
				code: `
const [b] = React.useBinding(0);
b.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const [b] = React.useBinding(0);
b;
`,
			},
			{
				code: `
const mapped = source.map(x => x + 1);
mapped.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const mapped = source.map(x => x + 1);
mapped;
`,
			},

			{
				code: "React.joinBindings({ a, b }).map(v => v)",
				errors: [{ messageId: "identityBindingMap" }],
				output: "React.joinBindings({ a, b })",
			},
			{
				code: "joinBindings({ a }).map(x => x)",
				errors: [{ messageId: "identityBindingMap" }],
				output: "joinBindings({ a })",
			},

			{
				code: "binding.map(x => x + 1).map(y => y)",
				errors: [{ messageId: "identityBindingMap" }],
				output: "binding.map(x => x + 1)",
			},

			{
				code: "items.map(v => v)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "items",
			},
			{
				code: `
    const [x] = foo(0);
    x.map(v => v);
    `,
				errors: [{ messageId: "identityArrayMap" }],
				output: `
    const [x] = foo(0);
    x;
    `,
			},
			{
				code: `
    const x = foo["useBinding"](0);
    x.map(v => v);
    `,
				errors: [{ messageId: "identityArrayMap" }],
				output: `
    const x = foo["useBinding"](0);
    x;
    `,
			},
			{
				code: "array.map((v) => v)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "array",
			},

			{
				code: "data.map((v: number) => v)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "data",
			},
			{
				code: "items.map((item: Readonly<T>) => item)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "items",
			},

			{
				code: "list.map(v => { return v; })",
				errors: [{ messageId: "identityArrayMap" }],
				output: "list",
			},
			{
				code: "arr.map((x: string) => { return x; })",
				errors: [{ messageId: "identityArrayMap" }],
				output: "arr",
			},

			{
				code: "data.map(function(v) { return v; })",
				errors: [{ messageId: "identityArrayMap" }],
				output: "data",
			},
			{
				code: "items.map(function foo(v) { return v; })",
				errors: [{ messageId: "identityArrayMap" }],
				output: "items",
			},

			{
				code: "arr.map((x = 0) => x)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "arr",
			},

			{
				code: `
const joined = joinBindings({ a, b });
joined.map(v => v);
`,
				errors: [{ messageId: "identityBindingMap" }],
				output: `
const joined = joinBindings({ a, b });
joined;
`,
			},

			{
				code: `
<frame
    BackgroundTransparency={shadowTransparency.map((trans: number) => {
        return trans;
    })}
/>
`,
				errors: [{ messageId: "identityArrayMap" }],
				language: "tsx",
				output: `
<frame
    BackgroundTransparency={shadowTransparency}
/>
`,
			},
			{
				code: `
<component
    gap={glowWidthBinding.map((value: number) => {
        return value;
    })}
/>
`,
				errors: [{ messageId: "identityBindingMap" }],
				language: "tsx",
				output: `
<component
    gap={glowWidthBinding}
/>
`,
			},
			{
				code: "function store() {} store.map(v => v)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "function store() {} store",
			},
			{
				code: "const store = 1; store.map(v => v)",
				errors: [{ messageId: "identityArrayMap" }],
				output: "const store = 1; store",
			},
		],
		valid: [
			"binding.map(v => v + 1)",
			"binding.map(v => v * 2)",
			"array.map(x => x - 1)",

			"binding.map(v => v.toString())",
			"items.map(item => item.toUpperCase())",

			"binding.map(v => v.x)",
			"items.map(item => item.name)",

			"items.map(v => ({ ...v }))",
			"binding.map(v => ({ value: v }))",

			"binding.map(v => [v])",

			"binding.map(v => String(v))",
			"items.map(v => transform(v))",

			"binding.map((v, i) => v)",
			"array.map((item, index) => item)",
			"array.map(function(v, i) { return v; })",

			"binding.map(({ x }) => x)",
			"items.map(([first]) => first)",
			"array.map(function({ x }) { return x; })",

			"array.map((...args) => args[0])",

			"binding.map(v => { console.log(v); return v; })",
			"items.map(v => { doSomething(); return v; })",

			"binding.map(v => { const x = v; return x; })",

			"items.map(v => { v; })",

			"array.map(v => {})",

			"binding.filter(v => v)",
			"binding.forEach(v => v)",
			"binding.find(v => v)",
			"binding.reduce(v => v)",

			"map(v => v)",

			'binding["map"](v => v)',

			"array.map()",

			"array.map(v => v, thisArg)",

			"array.map(...callbacks)",
			"items.map(identity)",
			"items.map((value = 0) => value + 1)",
		],
	});
});
