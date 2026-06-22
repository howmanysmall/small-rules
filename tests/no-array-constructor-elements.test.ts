import { describe } from "vitest";
import rule from "$oxc-rules/no-array-constructor-elements";

import { ts, tsx } from "./rule-testers";

describe("no-array-constructor-elements", () => {
	// @ts-expect-error -- Shut up.
	tsx.run("no-array-constructor-elements", rule, {
		invalid: [
			{
				code: 'const values = new Array("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const values = new Array<string>("a", "b");',
				errors: [{ messageId: "avoidConstructorEnumeration" }],
				output: 'const values = ["a", "b"];',
			},
			{
				code: 'const value = new Array("a");',
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: 'const value = ["a"];',
			},
			{
				code: "const value = new Array(size);",
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
				options: [{ environment: "standard" }],
				output: null,
			},
			{
				code: "const value = new Array(3);",
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
				options: [{ environment: "standard" }],
				output: null,
			},
			{
				code: "const value = new Array(256, -1);",
				errors: [
					{
						messageId: "avoidConstructorEnumeration",
					},
				],
				options: [{ environment: "standard" }],
				output: "const value = [256, -1];",
			},
			{
				code: "const value = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value = new Array(...items);",
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
				output: null,
			},
			{
				code: 'const value = new Array("a", ...items);',
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
				output: null,
			},
			{
				code: "const value = new Array(() => value);",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [() => value];",
			},
			{
				code: "const value = new Array({ value });",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [{ value }];",
			},
			{
				code: "const value = new Array(class Value {});",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [class Value {}];",
			},
			{
				code: "const value = new Array(`static`);",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [`static`];",
			},
			{
				code: "const value = new Array(void value);",
				errors: [{ messageId: "avoidSingleArgumentConstructor" }],
				output: "const value = [void value];",
			},
			{
				code: `
const array = new Array<string>();
array.push("a");
array.push("b");
array.push("c", "d", "e", "f");
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = ["a", "b", "c", "d", "e", "f"];
`,
			},
			{
				code: `
const array = new Array<string>();
array.push(this.value, item.value, item[key], +value, value ? first : second, \`\${value}\`, [value], { value }, (first, second));
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = [this.value, item.value, item[key], +value, value ? first : second, \`\${value}\`, [value], { value }, first, second];
`,
			},
			{
				code: `
const array = new Array<string>();
array.push(getValue());
array.push("b");
`,
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
				output: null,
			},
			{
				code: `
const array = new Array<string>();
array.push(...items);
array.push("b");
`,
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
				output: null,
			},
			{
				code: `
const array = new Array<string>();
	array.push("a");
	array.push("b");
`,
				errors: [{ messageId: "collapseArrayPushInitialization" }],
				output: `
const array = ["a", "b"];
`,
			},
			{
				code: "const { values }: { values: string } = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "consume(new Array());",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value = new Array() as unknown;",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value: Promise<string> = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value: readonly string[] = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value: Array = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
			{
				code: "const value: Collections.Array<string> = new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
		],
		valid: [
			"const value = new Set();",
			"const value = new Array<string>();",
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

	// @ts-expect-error -- Shut up.
	ts.run("no-array-constructor-elements-ts", rule, {
		invalid: [
			{
				code: "const value = <unknown>new Array();",
				errors: [{ messageId: "requireExplicitGenericOnNewArray" }],
				output: null,
			},
		],
		valid: ["const value = <Array<string>>new Array();"],
	});
});
