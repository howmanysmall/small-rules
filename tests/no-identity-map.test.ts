import { describe } from "vitest";
import rule from "$oxc-rules/general/no-identity-map";

import { ts } from "./rule-testers";

describe("no-identity-map", () => {
	ts.run("no-identity-map", rule, {
		invalid: [
			{
				code: "scaleBinding.map(v => v)",
				output: "scaleBinding",
				errors: [{ messageId: "identityBindingMap" }],
				documentation: { id: "fail", title: "Identity binding map" },
			},
			{
				code: "const result = shadowTransparencyBinding.map((trans: number) => trans);",
				output: "const result = shadowTransparencyBinding;",
				errors: [{ messageId: "identityBindingMap" }],
			},
			{
				code: "myBinding.map(v => { return v; })",
				output: "myBinding",
				errors: [{ messageId: "identityBindingMap" }],
			},

			{
				code: `
const [binding] = useBinding(0);
binding.map(v => v);
`,
				output: `
const [binding] = useBinding(0);
binding;
`,
				errors: [{ messageId: "identityBindingMap" }],
			},
			{
				code: `
const [b] = React.useBinding(0);
b.map(v => v);
`,
				output: `
const [b] = React.useBinding(0);
b;
`,
				errors: [{ messageId: "identityBindingMap" }],
			},
			{
				code: `
const mapped = source.map(x => x + 1);
mapped.map(v => v);
`,
				output: `
const mapped = source.map(x => x + 1);
mapped;
`,
				errors: [{ messageId: "identityBindingMap" }],
			},

			{
				code: "React.joinBindings({ a, b }).map(v => v)",
				output: "React.joinBindings({ a, b })",
				errors: [{ messageId: "identityBindingMap" }],
			},
			{
				code: "joinBindings({ a }).map(x => x)",
				output: "joinBindings({ a })",
				errors: [{ messageId: "identityBindingMap" }],
			},

			{
				code: "binding.map(x => x + 1).map(y => y)",
				output: "binding.map(x => x + 1)",
				errors: [{ messageId: "identityBindingMap" }],
			},

			{
				code: "items.map(v => v)",
				output: "items",
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: `
    const [x] = foo(0);
    x.map(v => v);
    `,
				output: `
    const [x] = foo(0);
    x;
    `,
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: `
    const x = foo["useBinding"](0);
    x.map(v => v);
    `,
				output: `
    const x = foo["useBinding"](0);
    x;
    `,
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: "array.map((v) => v)",
				output: "array",
				errors: [{ messageId: "identityArrayMap" }],
			},

			{
				code: "data.map((v: number) => v)",
				output: "data",
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: "items.map((item: Readonly<T>) => item)",
				output: "items",
				errors: [{ messageId: "identityArrayMap" }],
			},

			{
				code: "list.map(v => { return v; })",
				output: "list",
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: "arr.map((x: string) => { return x; })",
				output: "arr",
				errors: [{ messageId: "identityArrayMap" }],
			},

			{
				code: "data.map(function(v) { return v; })",
				output: "data",
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: "items.map(function foo(v) { return v; })",
				output: "items",
				errors: [{ messageId: "identityArrayMap" }],
			},

			{
				code: "arr.map((x = 0) => x)",
				output: "arr",
				errors: [{ messageId: "identityArrayMap" }],
			},

			{
				code: `
const joined = joinBindings({ a, b });
joined.map(v => v);
`,
				output: `
const joined = joinBindings({ a, b });
joined;
`,
				errors: [{ messageId: "identityBindingMap" }],
			},

			{
				code: `
<frame
    BackgroundTransparency={shadowTransparency.map((trans: number) => {
        return trans;
    })}
/>
`,
				output: `
<frame
    BackgroundTransparency={shadowTransparency}
/>
`,
				errors: [{ messageId: "identityArrayMap" }],
				language: "tsx",
			},
			{
				code: `
<component
    gap={glowWidthBinding.map((value: number) => {
        return value;
    })}
/>
`,
				output: `
<component
    gap={glowWidthBinding}
/>
`,
				errors: [{ messageId: "identityBindingMap" }],
				language: "tsx",
			},
			{
				code: "function store() {} store.map(v => v)",
				output: "function store() {} store",
				errors: [{ messageId: "identityArrayMap" }],
			},
			{
				code: "const store = 1; store.map(v => v)",
				output: "const store = 1; store",
				errors: [{ messageId: "identityArrayMap" }],
			},
		],
		valid: [
			{ code: "binding.map(v => v + 1)", documentation: { id: "pass", title: "Transforming map callback" } },
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
