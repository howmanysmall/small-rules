import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";

import noRecursive from "$oxc-rules/general/no-recursive";

describe("no-recursive", () => {
	js.run("no-recursive", noRecursive, {
		invalid: [
			// A local function that shares a name with an import elsewhere is
			// still recursion when it calls itself
			{
				code: "function walk(node) { return node ? walk(node.next) : undefined; }",
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: "const descend = function descend(depth) { return depth > 0 ? descend(depth - 1) : 0; };",
				errors: [{ messageId: "noRecursive" }],
			},
			// Direct recursion — factorial
			{
				code: [
					"function factorial(n) {",
					"  if (n <= 1) return 1;",
					"  return n * factorial(n - 1);",
					"}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }],
				documentation: { id: "fail", title: "Direct recursive function call" },
			},
			// Direct recursion — fibonacci (two recursive call sites)
			{
				code: "function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }",
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Mutual recursion (two functions calling each other)
			{
				code: [
					"function isEven(n) { if (n === 0) return true; return isOdd(n - 1); }",
					"function isOdd(n) { if (n === 0) return false; return isEven(n - 1); }",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Three+ function cycle
			{
				code: [
					"function a() { return b(); }",
					"function b() { return c(); }",
					"function c() { return a(); }",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// A cycle through 5,001 functions is searched without a deep stack
			{
				code: Array.from(
					{ length: 5001 },
					(_, index) => `function f${index}() { f${(index + 1) % 5001}(); }`,
				).join("\n"),
				errors: Array.from({ length: 5001 }, () => ({ messageId: "noRecursive" })),
			},
			// Only the functions on the cycle are marked, not the tail
			{
				code: [
					"function a() { b(); }",
					"function b() { c(); a(); }",
					"function c() { d(); }",
					"function d() {}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Async function recursion
			{
				code: "async function fetchData(url) { if (url == null) return null; return fetchData(url); }",
				errors: [{ messageId: "noRecursive" }],
			},
			// Generator recursion
			{
				code: "function* count(n) { if (n > 0) { yield n; yield* count(n - 1); } }",
				errors: [{ messageId: "noRecursive" }],
			},
			// Arrow function variable recursion
			{
				code: "const factorial = (n) => { if (n <= 1) return 1; return n * factorial(n - 1); };",
				errors: [{ messageId: "noRecursive" }],
			},
			// Class method recursion via `this.method()`
			{
				code: "class Calculator { factorial(n) { if (n <= 1) return 1; return n * this.factorial(n - 1); } }",
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: "const factorial = function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); };",
				errors: [{ messageId: "noRecursive" }],
			},
			// Mutual recursion through `this` where the callee is declared later
			{
				code: ["class Walker {", "  first() { this.second(); }", "  second() { this.first(); }", "}"].join(
					"\n",
				),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			{
				code: [
					"class Walker {",
					"  first() { this.second(); }",
					"  second() { this.third(); }",
					"  third() { this.first(); }",
					"}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// Existing reports stay when a later method is called but not part of
			// a cycle
			{
				code: "class Counter { first() { this.first(); this.second(); } second() {} }",
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: [
					"class Counter {",
					"  first() { this.first(); }",
					"  second() { this.first(); this.third(); }",
					"  third() {}",
					"}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: [
					"function loop() { loop(); }",
					"class Counter { run() { this.helper(); loop(); } helper() {} }",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }],
			},

			// A method keeps its report when another class has a method of the
			// same name
			{
				code: "class First { run() { this.run(); } } class Second { run() {} }",
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: "class First { run() { this.run(); } } class Second { run() { this.run(); } }",
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// A method and a plain function of the same name stay one function
			{
				code: "function run() {} class Runner { run() { run(); } }",
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: "const run = make(); class Runner { run() { run(); } }",
				errors: [{ messageId: "noRecursive" }],
			},
			// A `this` call and a bare call can close a cycle together
			{
				code: "class Looper { step() { const again = () => this.step(); again(); } }",
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// A subclass method shares its node with the ancestor method it
			// overrides, so `super` calls close a cycle across the classes
			{
				code: [
					"class Parent {",
					"  update() {}",
					"  render() { this.update(); }",
					"}",
					"class Child extends Parent {",
					"  render() { super.render(); }",
					"  update() { this.render(); }",
					"}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			{
				code: [
					"class Grand {",
					"  update() {}",
					"  render() { this.update(); }",
					"}",
					"class Middle extends Grand {}",
					"class Leaf extends Middle {",
					"  render() { super.render(); }",
					"  update() { this.render(); }",
					"}",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }, { messageId: "noRecursive" }],
			},
			// A class that extends itself in a cycle still ends the search
			{
				code: [
					"class First extends Second { run() { this.run(); } }",
					"class Second extends First { run() {} }",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }],
			},
			{
				code: [
					"class First extends Second { run() { this.run(); } }",
					"class Second extends Third { run() {} }",
					"class Third extends Second { run() {} }",
				].join("\n"),
				errors: [{ messageId: "noRecursive" }],
			},
			// A function that reaches a cycle through a finished one is part
			// of it too
			{
				code: "function a() { b(); c(); } function b() { a(); } function c() { b(); }",
				errors: [
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
				],
			},
			// A call from one cycle into another is not part of either
			{
				code: "function a() { b(); } function b() { a(); c(); } function c() { d(); } function d() { c(); }",
				errors: [
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
					{ messageId: "noRecursive" },
				],
			},
		],
		valid: [
			// A call to a binding that is not a function adds no cycle
			"const helper = make(); function start() { helper(); }",
			// A bare call to an import or a parameter of the same name does
			// not call the method it sits in
			'import { log } from "./logger"; export class Logger { log(message) { log(message); } }',
			"class Runner { run(run) { run(); } }",
			"class Walker { first() { this.second(); } second() {} }",
			"class Walker { run() { this.missing(); } }",
			// Same-named methods of different classes are different functions
			[
				"export class Parent {",
				"  update() {}",
				"  render() { this.update(); }",
				"}",
				"export class Child {",
				"  render() {}",
				"  update() { this.render(); }",
				"}",
			].join("\n"),
			"class First { run() { this.helper(); } helper() {} } class Second { helper() { this.run(); } run() {} }",
			"export default class { first() { this.second(); } second() { this.first(); } }",
			// Siblings of a base that is not declared here stay apart
			[
				'import { Base } from "./base";',
				"class First extends Base { run() { this.helper(); } helper() {} }",
				"class Second extends Base { helper() { this.run(); } run() {} }",
			].join("\n"),
			// Non-recursive function
			{
				code: "function foo() { return 1; }",
				documentation: { id: "pass", title: "Simple non-recursive function" },
			},
			// No self-reference
			'function greet() { console.log("hello"); }',
			// Arrow function with no recursion
			"const add = (a, b) => a + b;",
			// Callback to external function is not flagged
			"const result = [1, 2, 3].map(x => x * x);",
			"function foo() { return external(); }",
			// Function named after a global that doesn't recurse
			"function Array() { return [1, 2, 3]; }",
			// Shadowing — inner function shadows outer, inner doesn't call itself
			"function foo(id) { function bar() { return id; } return bar; }",
			// Empty function
			"function empty() {}",
			// Non-recursive method
			'class Greeter { sayHi() { return "hi"; } }',
			// Calls that cannot be `this`-method recursion
			"function foo() { helper.method(); getHandler()(); this[0](); }",
			// Non-recursive async
			"async function noop() { return null; }",
			// Non-recursive generator
			"function* range() { yield 1; }",
			// Anonymous class expressions should not be treated as local
			// this-recursion
			'const Greeter = class { sayHi() { return this.sayHiOutside(); } sayHiOutside() { return "hi"; } };',
			// A chain of 5,000 calls is searched without a deep stack
			[
				...Array.from({ length: 5000 }, (_, index) => `function f${index}() { f${index + 1}(); }`),
				"function f5000() {}",
			].join("\n"),
		],
	});
});
