import { describe } from "vitest";
import rule from "$oxc-rules/require-throw-error-capture";

import { ts } from "./rule-testers";

const error = {
	messageId: "missingCaptureStackTrace" as const,
};

describe("require-throw-error-capture", () => {
	// @ts-expect-error - RuleTester types are stricter than the runtime rule shape
	ts.run("require-throw-error-capture", rule, {
		invalid: [
			// Named function declaration
			{
				code: ["function foo() {", "	throw new Error('bad');", "}"].join("\n"),
				errors: [error],
				output: [
					"function foo() {",
					"	const error = new Error('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// TypeError subclass
			{
				code: ["function bar() {", "	throw new TypeError('invalid');", "}"].join("\n"),
				errors: [error],
				output: [
					"function bar() {",
					"	const error = new TypeError('invalid');",
					"Error.captureStackTrace(error, bar);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// NewExpression without arguments
			{
				code: ["function baz() {", "	throw new Error();", "}"].join("\n"),
				errors: [error],
				output: [
					"function baz() {",
					"	const error = new Error();",
					"Error.captureStackTrace(error, baz);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// Method in a class
			{
				code: ["class Foo {", "	doThing() {", "		throw new Error('oops');", "	}", "}"].join("\n"),
				errors: [error],
				output: [
					"class Foo {",
					"	doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
			},
			// Arrow function assigned to variable
			{
				code: ["const myFn = () => {", "	throw new Error('oops');", "};"].join("\n"),
				errors: [error],
				output: [
					"const myFn = () => {",
					"	const error = new Error('oops');",
					"Error.captureStackTrace(error, myFn);",
					"throw error;",
					"};",
				].join("\n"),
			},
			// Function expression assigned to variable
			{
				code: ["const myFn2 = function() {", "	throw new Error('nope');", "};"].join("\n"),
				errors: [error],
				output: [
					"const myFn2 = function() {",
					"	const error = new Error('nope');",
					"Error.captureStackTrace(error, myFn2);",
					"throw error;",
					"};",
				].join("\n"),
			},
			// Custom error class ending with Error
			{
				code: ["function handler() {", "	throw new CustomError('fail');", "}"].join("\n"),
				errors: [error],
				output: [
					"function handler() {",
					"	const error = new CustomError('fail');",
					"Error.captureStackTrace(error, handler);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// Top-level throw — no fix (no enclosing function name)
			{
				code: "throw new Error('top level');",
				errors: [error],
			},
			// Anonymous callback — no fix
			{
				code: "setTimeout(function() { throw new Error('async'); }, 100);",
				errors: [error],
			},
		],
		valid: [
			// Already using captureStackTrace pattern
			[
				"function good() {",
				"	const err = new Error('msg');",
				"	Error.captureStackTrace(err, good);",
				"	throw err;",
				"}",
			].join("\n"),
			// Throw with identifier (not a NewExpression)
			["function rethrow(e: Error) {", "	throw e;", "}"].join("\n"),
			// Throw with non-Error new expression
			["function other() {", "	throw new Foo();", "}"].join("\n"),
			// Throw with call expression
			["function factory() {", "	throw createError();", "}"].join("\n"),
			// Throw with string (not new Error)
			["function legacy() {", "	throw 'bad';", "}"].join("\n"),
		],
	});
});
