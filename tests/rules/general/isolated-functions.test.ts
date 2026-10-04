import { describe } from "vitest";

import rule from "$oxc-rules/general/isolated-functions";

import { js, ts } from "./rule-testers";

describe("isolated-functions", () => {
	js.run("isolated-functions", rule, {
		invalid: [
			{
				code: ["const foo = 'hi';", "makeSynchronous(() => {", "  return foo.slice();", "});"].join("\n"),
				errors: [
					{
						data: { name: "foo", reason: 'callee of function named "makeSynchronous"' },
						messageId: "externallyScopedVariable",
					},
				],
				documentation: { id: "fail", title: "Outer variable in isolated callback" },
			},
			{
				code: "const foo = 'hi';\nworkerize(() => foo.slice());",
				errors: [
					{
						data: { name: "foo", reason: 'callee of function named "workerize"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "const foo = 'hi';\nbrowser.execute(() => foo.slice());",
				errors: [
					{
						data: { name: "foo", reason: 'callee of method named "browser.execute"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "const foo = 'hi';\npage.evaluate(() => foo.slice());",
				errors: [
					{
						data: { name: "foo", reason: 'callee of method named "page.evaluate"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: [
					"const foo = 'hi';",
					"chrome.scripting.executeScript({",
					"  target: { tabId: 1 },",
					"  func: () => foo.slice(),",
					"});",
				].join("\n"),
				errors: [
					{
						data: {
							name: "foo",
							reason: 'property "func" passed to "chrome.scripting.executeScript"',
						},
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: [
					"const foo = 'hi';",
					"browser.scripting.executeScript({",
					"  func: () => foo.slice(),",
					"});",
				].join("\n"),
				errors: [
					{
						data: {
							name: "foo",
							reason: 'property "func" passed to "browser.scripting.executeScript"',
						},
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: [
					"const foo = 'hi';",
					"chrome.scripting.executeScript({",
					"  'func': () => foo.slice(),",
					"});",
				].join("\n"),
				errors: [
					{
						data: {
							name: "foo",
							reason: 'property "func" passed to "chrome.scripting.executeScript"',
						},
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: ["const foo = 'hi';", "/** @isolated */", "function abc() {", "  return foo.slice();", "}"].join(
					"\n",
				),
				errors: [
					{
						data: { name: "foo", reason: 'follows comment "@isolated"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: ["const foo = 'hi';", "// @isolated - worker", "const abc = () => foo.slice();"].join("\n"),
				errors: [
					{
						data: { name: "foo", reason: 'follows comment "@isolated"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: ["const foo = 'hi';", "// @isolated -- worker", "function abc() { return foo; }"].join("\n"),
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: [
					"const object = {",
					"  /** @isolated */",
					"  method() {",
					"    return this.foo;",
					"  },",
					"};",
				].join("\n"),
				errors: [{ data: { reason: 'follows comment "@isolated"' }, messageId: "thisExpression" }],
			},
			{
				code: [
					"const foo = 'hi';",
					"makeSynchronous(function factory() {",
					"  return function nested() {",
					"    return foo.slice();",
					"  };",
					"});",
				].join("\n"),
				errors: [
					{
						data: { name: "foo", reason: 'callee of function named "makeSynchronous"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "const foo = 'hi';\nserialize(() => foo.slice());",
				options: [{ functions: ["serialize"] }],
				errors: [
					{
						data: { name: "foo", reason: 'callee of function named "serialize"' },
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "makeSynchronous(() => { console = 1; });",
				options: [{ overrideGlobals: { console: "readonly" } }],
				errors: [
					{
						data: {
							name: "console",
							reason: 'callee of function named "makeSynchronous" (global variable is not writable)',
						},
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "makeSynchronous(() => { process = 1; });",
				options: [{ overrideGlobals: { process: "off" } }],
				errors: [
					{
						data: {
							name: "process",
							reason: 'callee of function named "makeSynchronous"',
						},
						messageId: "externallyScopedVariable",
					},
				],
			},
			{
				code: "makeSynchronous(() => { foo = 1; });",
				options: [{ overrideGlobals: { foo: "readable" } }],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const Outer = class {};\n/** @isolated */\nfunction make() {\n  class Child extends Outer {}\n  return Child;\n}",
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: [
					"const key = 'k';",
					"/** @isolated */",
					"function make() {",
					"  class Child {",
					"    [key]() {}",
					"  }",
					"  return Child;",
					"}",
				].join("\n"),
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const foo = 1;\nfunction handler() { return foo; }",
				options: [{ selectors: ["FunctionDeclaration[id.name='handler']"] }],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: [
					"class Base { method() { return 1; } }",
					"class Child extends Base {",
					"  /** @isolated */",
					"  method() { return super.method(); }",
					"}",
				].join("\n"),
				errors: [{ messageId: "super" }],
			},
			{
				code: [
					"const Outer = class {};",
					"/** @isolated */",
					"function wrap() {",
					"  class Child extends Outer {}",
					"  return Child;",
					"}",
				].join("\n"),
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const local = 1;\nmakeSynchronous(() => { local = 2; });",
				options: [{ overrideGlobals: { local: "writable" } }],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const foo = 1;\n/** @worker */\nfunction run() { return foo; }",
				options: [{ comments: ["@worker"] }],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const foo = 1;\nmakeSynchronous(() => foo);\nfunction handler() { return foo; }",
				options: [{ selectors: ["FunctionDeclaration[id.name='handler']"] }],
				errors: [{ messageId: "externallyScopedVariable" }, { messageId: "externallyScopedVariable" }],
			},
			{
				code: "makeSynchronous(() => { foo = 1; });",
				options: [{ overrideGlobals: { foo: "nope" } }],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const foo = 1;\nmakeSynchronous(() => foo);",
				options: [
					{
						functions: ["makeSynchronous"],
						selectors: ["ArrowFunctionExpression"],
					},
				],
				errors: [{ messageId: "externallyScopedVariable" }],
			},
			{
				code: "const foo = 1;\nmakeSynchronous(extra, () => foo);",
				errors: [{ messageId: "externallyScopedVariable" }],
			},
		],
		valid: [
			{
				code: ["makeSynchronous(() => {", "  const foo = 'hi';", "  return foo.slice();", "});"].join("\n"),
				documentation: { id: "pass", title: "Locals defined inside isolated callback" },
			},
			"makeSynchronous(foo => foo.slice());",
			"makeSynchronous(() => new Array());",
			"makeSynchronous(() => new Map());",
			[
				"/** @isolated */",
				"function abc() {",
				"  const foo = 'hi';",
				"  const slice = () => foo.slice();",
				"  return slice();",
				"}",
			].join("\n"),
			["const foo = 'hi';", "memoize(() => foo.slice());", "serialize(() => foo.slice());"].join("\n"),
			[
				"const foo = 'hi';",
				"chrome.scripting.executeScript({",
				"  target: { tabId: 1 },",
				"  [func]: () => foo.slice(),",
				"});",
			].join("\n"),
			["const foo = 'hi';", "const func = () => foo.slice();", "chrome.scripting.executeScript({ func });"].join(
				"\n",
			),
			"makeSynchronous(() => { console.log('ok'); });",
			{
				code: "makeSynchronous(() => { foo = 1; });",
				options: [{ overrideGlobals: { foo: "writable" } }],
			},
			{
				code: "makeSynchronous(() => { foo = 1; });",
				options: [{ overrideGlobals: { foo: "writeable" } }],
			},
			{
				code: "makeSynchronous(() => { bar = 1; });",
				options: [{ overrideGlobals: { bar: true } }],
			},
			{
				code: "const foo = 'hi';\nrun(() => foo.slice());",
				options: [{ comments: [], functions: [] }],
			},
			{
				code: "const foo = 1;\nmakeSynchronous(function factory(foo) { return foo; }, extra);",
			},
			{
				code: "const foo = 1;\nother.execute(() => foo);",
			},
			{
				code: "const foo = 1;\nwindow.scripting.executeScript({ func: () => foo });",
			},
			{
				code: "const foo = 1;\nchrome.scripting.run({ func: () => foo });",
			},
			{
				code: "const foo = 1;\n/** not-isolated */\nfunction abc() { return foo; }",
			},
			"(() => {})();",
			"((x) => x)(1);",
			"(function (x) { return x; })(1);",
			{
				code: "const foo = 1;\nsomething({ func: () => foo });",
			},
			{
				code: "const foo = 1;\nobj.executeScript({ func: () => foo });",
			},
			{
				code: "const foo = 1;\nchrome.other.executeScript({ func: () => foo });",
			},
			{
				code: "const foo = 1;\nconst options = { func: () => foo };",
			},
			{
				code: "const foo = 1;\nchrome.scripting.executeScript({ 1: () => foo });",
			},
			{
				code: "const foo = 1;\nchrome.scripting?.executeScript({ func: () => foo });",
			},
			{
				code: "const foo = 1;\nchrome?.scripting.executeScript({ func: () => foo });",
			},
			{
				code: [
					"/** @isolated */",
					"function wrap() {",
					"  class Child { method() { return 1; } }",
					"  return Child;",
					"}",
				].join("\n"),
			},
			{
				code: "const foo = 1;\nconst bar = foo;",
				options: [{ selectors: ["Identifier"] }],
			},
			{
				code: "export default function abc() { return 1; }",
				options: [{ comments: ["@isolated"] }],
			},
		],
	});

	ts.run("isolated-functions typescript", rule, {
		invalid: [
			{
				code: ["const outer = 1;", "makeSynchronous(() => {", "  return outer;", "});"].join("\n"),
				errors: [{ messageId: "externallyScopedVariable" }],
			},
		],
		valid: [
			[
				"const a = 1;",
				"type MyType = { foo: string };",
				"makeSynchronous(() => {",
				"  const b: typeof a = 1;",
				"  let myType: MyType = { foo: 'bar' };",
				"  myType = { foo: 'bar' } as MyType;",
				"  type X = typeof myType extends MyType ? true : false;",
				"  return b;",
				"});",
			].join("\n"),
		],
	});
});
