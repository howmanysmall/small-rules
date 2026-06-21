import { describe } from "vitest";
import noRecursive from "$oxc-rules/no-recursive";

import { js } from "./rule-testers";

describe("no-recursive", () => {
	// @ts-expect-error -- RuleTester types are permissive
	js.run("no-recursive", noRecursive, {
		invalid: [
			// Direct recursion — factorial
			{
				code: `function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }`,
				errors: [{ messageId: "noRecursive" }],
			},
			// Direct recursion — fibonacci (two recursive call sites)
			{
				code: `function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }`,
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Mutual recursion (two functions calling each other)
			{
				code: [
					`function isEven(n) { if (n === 0) return true; return isOdd(n - 1); }`,
					`function isOdd(n) { if (n === 0) return false; return isEven(n - 1); }`,
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Three+ function cycle
			{
				code: [
					`function a() { return b(); }`,
					`function b() { return c(); }`,
					`function c() { return a(); }`,
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Async function recursion
			{
				code: `async function fetchData(url) { if (url == null) return null; return fetchData(url); }`,
				errors: [{ messageId: "noRecursive" }],
			},
			// Generator recursion
			{
				code: `function* count(n) { if (n > 0) { yield n; yield* count(n - 1); } }`,
				errors: [{ messageId: "noRecursive" }],
			},
			// Arrow function variable recursion
			{
				code: `const factorial = (n) => { if (n <= 1) return 1; return n * factorial(n - 1); };`,
				errors: [{ messageId: "noRecursive" }],
			},
			// Class method recursion via `this.method()`
			{
				code: `class Calculator { factorial(n) { if (n <= 1) return 1; return n * this.factorial(n - 1); } }`,
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: `const factorial = function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); };`,
				errors: [{ messageId: "noRecursive" }],
			},
		],
		valid: [
			// Non-recursive function
			`function foo() { return 1; }`,
			// No self-reference
			`function greet() { console.log("hello"); }`,
			// Arrow function with no recursion
			`const add = (a, b) => a + b;`,
			// Callback to external function is not flagged
			`const result = [1, 2, 3].map(x => x * x);`,
			`function foo() { return external(); }`,
			// Function named after a global that doesn't recurse
			`function Array() { return [1, 2, 3]; }`,
			// Shadowing — inner function shadows outer, inner doesn't call itself
			`function foo(id) { function bar() { return id; } return bar; }`,
			// Empty function
			`function empty() {}`,
			// Non-recursive method
			`class Greeter { sayHi() { return "hi"; } }`,
			// Non-recursive async
			`async function noop() { return null; }`,
			// Non-recursive generator
			`function* range() { yield 1; }`,
			// Anonymous class expressions should not be treated as local this-recursion
			`const Greeter = class { sayHi() { return this.sayHiOutside(); } sayHiOutside() { return "hi"; } };`,
		],
	});
});
