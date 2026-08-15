import { describe } from "vitest";
import rule from "$oxc-rules/naming/consistent-compound-words";

import { js, ts } from "./rule-testers";

describe("consistent-compound-words", () => {
	js.run("consistent-compound-words", rule, {
		invalid: [
			{
				code: "const passWord = 'secret';",
				documentation: { id: "fail", title: "Split compound word" },
				errors: [{ data: { name: "passWord", replacement: "password" }, messageId: "error" }],
			},
			{
				code: "const isInViewPort = true;",
				errors: [{ data: { name: "isInViewPort", replacement: "isInViewport" }, messageId: "error" }],
			},
			{
				code: "function unSubscribe() {}",
				errors: [{ data: { name: "unSubscribe", replacement: "unsubscribe" }, messageId: "error" }],
			},
			{
				code: "const timeOut = 1000;",
				errors: [{ data: { name: "timeOut", replacement: "timeout" }, messageId: "error" }],
			},
			{
				code: "const userName = 'logan';",
				errors: [{ data: { name: "userName", replacement: "username" }, messageId: "error" }],
			},
			{
				code: "function ViewPort() {}",
				errors: [{ data: { name: "ViewPort", replacement: "Viewport" }, messageId: "error" }],
			},
			{
				code: "const { passWord } = object;",
				errors: [{ messageId: "error" }],
				options: [{ checkShorthandProperties: true }],
			},
			{
				code: "({ passWord: 1 });",
				errors: [{ messageId: "error" }],
				options: [{ checkProperties: true }],
			},
			{
				code: "class Box { passWord = 1; }",
				errors: [{ messageId: "error" }],
				options: [{ checkProperties: true }],
			},
			{
				code: "class Box { passWord() {} }",
				errors: [{ messageId: "error" }],
				options: [{ checkProperties: true }],
			},
			{
				code: "const x = { passWord };",
				errors: [{ messageId: "error" }],
				options: [{ checkProperties: true, checkVariables: false }],
			},
			{
				code: "const fooBar = 1;",
				errors: [{ data: { name: "fooBar", replacement: "foobar" }, messageId: "error" }],
				options: [{ extendDefaultReplacements: false, replacements: { fooBar: "foobar" } }],
			},
			{
				code: "const timeOutMs = 1;",
				errors: [{ data: { name: "timeOutMs", replacement: "timeoutMs" }, messageId: "error" }],
			},
			{
				code: "const FooBar = 1;",
				errors: [{ data: { name: "FooBar", replacement: "Foobar" }, messageId: "error" }],
				options: [{ extendDefaultReplacements: false, replacements: { fooBar: "foobar" } }],
			},
			{
				code: "const x = { PassWord: 1 };",
				errors: [{ messageId: "error" }],
				options: [{ checkProperties: true, checkVariables: false }],
			},
		],
		valid: [
			{
				code: "const password = 'secret';",
				documentation: { id: "pass", title: "Consistent compound spelling" },
			},
			"const isInViewport = true;",
			"function unsubscribe() {}",
			"const fileName = 'index.js';",
			"const setUp = () => {};",
			"const VIEW_PORT = 1;",
			"({ passWord: 1 });",
			"foo.userName = 1;",
			"export { userName };",
			"const __proto__ = 1;",
			{
				code: "const userName = 1;",
				options: [{ allowList: { userName: true } }],
			},
			{
				code: "const passWord = 1;",
				options: [{ replacements: { passWord: false } }],
			},
			{
				code: "const passWord = 1;",
				options: [{ checkVariables: false }],
			},
			{
				code: "const ok = 1;",
				options: [{ extendDefaultReplacements: false, replacements: {} }],
			},
			{
				code: "({ [passWord]: 1 });",
				options: [{ checkProperties: true }],
			},
			{
				code: "export { userName };",
				options: [{ checkProperties: true }],
			},
			{
				code: "const object = { __proto__: null };",
				options: [{ checkProperties: true }],
			},
			{
				code: "const password = 1;",
				options: [{ replacements: { passWord: "" } }],
			},
			{
				code: "const password = 1;",
				options: [{ replacements: { passWord: 1 } }],
			},
			{
				code: "const password = 1;",
				options: [{ allowList: true }],
			},
			{
				code: "foo.userName = 1;",
				options: [{ checkProperties: true }],
			},
			{
				code: "const { password } = object;",
				options: [{ checkShorthandProperties: false }],
			},
		],
	});

	ts.run("consistent-compound-words typescript", rule, {
		invalid: [
			{
				code: "const callBack: () => void = () => {};",
				errors: [{ messageId: "error" }],
			},
		],
		valid: ["const callback: () => void = () => {};"],
	});
});
