import { describe } from "vitest";

import rule from "$oxc-rules/roblox/no-array-constructor-elements";

import { ts, tsx } from "./rule-testers";

describe("no-array-constructor-elements", () => {
	tsx.run("no-array-constructor-elements", rule, {
		invalid: [
			{
				code: 'const values = new Array("a", "b");',
				output: 'const values = ["a", "b"];',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				documentation: { id: "fail", title: "array constructor with elements" },
			},
			{
				code: 'const values = new Array<string>("a", "b");',
				output: 'const values = ["a", "b"];',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
			},
			{
				code: 'const value = new Array("a");',
				output: 'const value = ["a"];',
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: "const value = new Array(size);",
				output: null,
				options: [{ environment: "standard" }],
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: size });",
							},
						],
					},
				],
			},
			{
				code: "const value = new Array(3);",
				output: null,
				options: [{ environment: "standard" }],
				errors: [
					{
						messageId: "avoidLengthConstructorInStandard",
						suggestions: [
							{
								messageId: "suggestArrayFromLength",
								output: "const value = Array.from({ length: 3 });",
							},
						],
					},
				],
			},
			{
				code: "const value = new Array(256, -1);",
				output: "const value = [256, -1];",
				options: [{ environment: "standard" }],
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
					},
				],
			},
			{
				code: "const value = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value = new Array(...items);",
				output: null,
				errors: [
					{
						messageId: "avoidSingleArgumentConstructor",
						suggestions: [
							{
								messageId: "suggestArrayLiteral",
								output: "const value = [...items];",
							},
						],
					},
				],
			},
			{
				code: 'const value = new Array("a", ...items);',
				output: null,
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
						suggestions: [
							{
								messageId: "suggestArrayLiteral",
								output: 'const value = ["a", ...items];',
							},
						],
					},
				],
			},
			{
				code: "const value = new Array(() => value);",
				output: "const value = [() => value];",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: "const value = new Array({ value });",
				output: "const value = [{ value }];",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: "const value = new Array(class Value {});",
				output: "const value = [class Value {}];",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: "const value = new Array(`static`);",
				output: "const value = [`static`];",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: "const value = new Array(void value);",
				output: "const value = [void value];",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
			},
			{
				code: `
const array = new Array<string>();
array.push("a");
array.push("b");
array.push("c", "d", "e", "f");
`,
				output: `
const array = ["a", "b", "c", "d", "e", "f"];
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
			},
			{
				code: `
const array = new Array<string>();
array.push(this.value, item.value, item[key], +value, value ? first : second, \`\${value}\`, [value], { value }, (first, second));
`,
				output: `
const array = [this.value, item.value, item[key], +value, value ? first : second, \`\${value}\`, [value], { value }, (first, second)];
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
			},
			{
				code: `
const array = new Array<string>();
array.push(getValue());
array.push("b");
`,
				output: null,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [getValue(), "b"];
`,
							},
						],
					},
				],
			},
			{
				code: `
const array = new Array<string>();
array.push(...items);
array.push("b");
`,
				output: null,
				errors: [
					{
						messageId: "collapseArrayPushInitialization",
						suggestions: [
							{
								messageId: "suggestCollapseArrayPushInitialization",
								output: `
const array = [...items, "b"];
`,
							},
						],
					},
				],
			},
			{
				code: `
const array = new Array<string>();
	array.push("a");
	array.push("b");
`,
				output: `
const array = ["a", "b"];
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
			},
			{
				code: "const { values }: { values: string } = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "consume(new Array());",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value = new Array() as unknown;",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value: Promise<string> = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value: readonly string[] = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value: Array = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
			{
				code: "const value: Collections.Array<string> = new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
		],
		valid: [
			"const value = new Set();",
			{
				code: "const value = new Array<string>();",
				documentation: { id: "pass", title: "empty generic array constructor" },
			},
			"const value: Array<string> = new Array();",
			"const value: ReadonlyArray<string> = new Array();",
			"const [first]: Array<string> = new Array();",
			`
class Store {
	public values: Array<string> = new Array();
}
`,
			`
function collect(values: Array<string> = new Array()): Array<string> {
	return values;
}
`,
			"const value = new Array() as Array<string>;",
			"const sized = new Array(10);",
			{
				code: "const sized = new Array(10);",
				options: [{ environment: "roblox-ts" }],
			},
			`
type ColorSequenceKeypoint = { time: number };
declare const length: number;
const keypoints = new Array<ColorSequenceKeypoint>(length);
`,
			`
type ColorSequenceKeypoint = { time: number };
const keypoints = new Array<ColorSequenceKeypoint>(256, -1);
`,
			`
function multiplyByTwo(array: ReadonlyArray<number>): ReadonlyArray<number> {
    const newArray = new Array<number>(array.size());
    let size = 0;

    for (const value of array) newArray[size++] = value * 2;
    return newArray;
}
`,
			{
				code: "const value = new Array();",
				options: [{ requireExplicitGenericOnNewArray: false }],
			},
			`
const values: ReadonlyArray<string> = new Array();
values.push("a");
`,
			`
var array = new Array<string>();
array.push("a");
`,
			`
const first = new Array<string>(), second = new Array<string>();
first.push("a");
`,
			`
const array = new Array<string>();
array.push();
`,
			`
const array = new Array<string>();
other.push("a");
`,
			`
const array = new Array<string>();
array?.push("a");
`,
			`
const array = new Array<string>();
array.push?.("a");
`,
			`
const array = new Array<string>();
array.pop();
`,
			`
const array = new Array<string>();
if (ready) array.push("a");
`,
			`
class Array<TValue> {
    constructor(..._arguments: Array<TValue>) {}
}
const value = new Array("a");
`,
			`
const array = new Array<string>();
array.push("a");
const separator = true;
array.push("b");
`,
			`
const array = new Array<string>();
array.push("a");
doSomething(array);
array.push("b");
`,
		],
	});

	ts.run("no-array-constructor-elements-ts", rule, {
		invalid: [
			{
				code: "const value = <unknown>new Array();",
				output: null,
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
			},
		],
		valid: ["const value = <Array<string>>new Array();"],
	});
});
