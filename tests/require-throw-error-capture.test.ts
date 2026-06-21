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
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
			},
			// Private method in a class
			{
				code: ["class Foo {", "	#doThing() {", "		throw new Error('oops');", "	}", "}"].join("\n"),
				errors: [error],
				output: [
					"class Foo {",
					"	#doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.#doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
			},
			// Arrow function assigned to class property
			{
				code: ["class Foo {", "	doThing = () => {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				errors: [error],
				output: [
					"class Foo {",
					"	doThing = () => {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
			},
			// Static method in a class
			{
				code: ["class Foo {", "	static doThing() {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				errors: [error],
				output: [
					"class Foo {",
					"	static doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
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
			{
				code: ["const myFn3 = function Inner() {", "	throw new Error('nope');", "};"].join("\n"),
				errors: [error],
				output: [
					"const myFn3 = function Inner() {",
					"	const error = new Error('nope');",
					"Error.captureStackTrace(error, Inner);",
					"throw error;",
					"};",
				].join("\n"),
			},
			{
				code: [
					"const handlers = {",
					"	load: function() {",
					"		throw new Error('oops');",
					"	},",
					"};",
				].join("\n"),
				errors: [error],
				output: [
					"const handlers = {",
					"	load: function() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, load);",
					"throw error;",
					"	},",
					"};",
				].join("\n"),
			},
			{
				code: [
					"class Foo {",
					"	doThing = function() {",
					"		throw new Error('oops');",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
				output: [
					"class Foo {",
					"	doThing = function() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
			},
			{
				code: ["class Foo {", "	#handle = () => {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				errors: [error],
				output: [
					"class Foo {",
					"	#handle = () => {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.#handle);",
					"throw error;",
					"	}",
					"}",
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
			// Single-line if body must be wrapped in braces
			{
				// oxlint-disable-next-line no-template-curly-in-string -- this is fine.
				code: "function fetchModels() { if (!response.ok) throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`); }",
				errors: [error],
				// oxlint-disable-next-line no-template-curly-in-string -- this is fine.
				output: "function fetchModels() { if (!response.ok) {\nconst error = new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);\nError.captureStackTrace(error, fetchModels);\nthrow error;\n} }",
			},
			// File specifier with path that does not match <input> still reports
			{
				code: ["function foo() {", "\tthrow new ValidationError('bad');", "}"].join("\n"),
				errors: [error],
				options: [{ allow: [{ from: "file", name: "ValidationError", path: "src/errors.ts" }] }],
				output: [
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// Non-allowed error still reports when allow option is present
			{
				code: ["function foo() {", "\tthrow new Error('bad');", "}"].join("\n"),
				errors: [error],
				options: [{ allow: ["ValidationError"] }],
				output: [
					"function foo() {",
					"\tconst error = new Error('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			{
				code: ["const TypeError = Error;", "function foo() {", "\tthrow new TypeError('bad');", "}"].join("\n"),
				errors: [error],
				options: [{ allow: [{ from: "library", name: "TypeError" }] }],
				output: [
					"const TypeError = Error;",
					"function foo() {",
					"\tconst error = new TypeError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			// Throw in catch block doesn't collide with catch param name
			{
				code: [
					"async function runJsonAsync() {",
					"\ttry {",
					"\t\treturn JSON.parse(raw);",
					"\t} catch (error) {",
					'\t\tthrow new Error("failed: " + error);',
					"\t}",
					"}",
				].join("\n"),
				errors: [error],
				output: [
					"async function runJsonAsync() {",
					"\ttry {",
					"\t\treturn JSON.parse(raw);",
					"\t} catch (error) {",
					'\t\tconst error2 = new Error("failed: " + error);',
					"Error.captureStackTrace(error2, runJsonAsync);",
					"throw error2;",
					"\t}",
					"}",
				].join("\n"),
			},
			// Package-aware specifier does not match a different import source
			{
				code: [
					"import { ValidationError } from 'other-package';",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				errors: [error],
				options: [{ allow: [{ from: "package", name: "ValidationError", package: "@cliffy/command" }] }],
				output: [
					"import { ValidationError } from 'other-package';",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			{
				code: [
					"import { ValidationError } from '@cliffy/command';",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				errors: [error],
				options: [{ allow: [{ from: "package", name: "ValidationError" }] }],
				output: [
					"import { ValidationError } from '@cliffy/command';",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
			{
				code: [
					"const ValidationError = makeError();",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				errors: [error],
				options: [{ allow: [{ from: "file", name: "ValidationError", path: "src/errors.ts" }] }],
				output: [
					"const ValidationError = makeError();",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
			},
		],
		valid: [
			// Already using `captureStackTrace` pattern
			[
				"function good() {",
				"	const err = new Error('msg');",
				"	Error.captureStackTrace(err, good);",
				"	throw err;",
				"}",
			].join("\n"),
			// Throw with identifier (not a `NewExpression`)
			["function rethrow(e: Error) {", "	throw e;", "}"].join("\n"),
			// Throw with non-Error new expression
			["function other() {", "	throw new Foo();", "}"].join("\n"),
			// Throw with call expression
			["function factory() {", "	throw createError();", "}"].join("\n"),
			// Throw with string (not new Error)
			["function legacy() {", "	throw 'bad';", "}"].join("\n"),
			// Top-level throw has no enclosing function to capture
			"throw new Error('top level');",
			// Top-level throw in a script with a shebang
			["#!/usr/bin/env bun", 'if (!Bun.which("opencode")) throw new Error("opencode is not installed");'].join(
				"\n",
			),
			// Anonymous callback has no name to capture
			"setTimeout(function() { throw new Error('async'); }, 100);",
			// String allowlist skips matching errors
			{
				code: ["function foo() {", "\tthrow new ValidationError('bad');", "}"].join("\n"),
				options: [{ allow: ["ValidationError"] }],
			},
			// Package-aware allowlist skips matching imports
			{
				code: [
					"import { ValidationError } from '@cliffy/command';",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "package", name: "ValidationError", package: "@cliffy/command" }] }],
			},
			// File-local allowlist skips locally declared errors
			{
				code: [
					"class ValidationError extends Error {}",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "file", name: "ValidationError" }] }],
			},
			{
				code: [
					"class ValidationError extends Error {}",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				filename: "src/errors.ts",
				options: [{ allow: [{ from: "file", name: "ValidationError", path: "src/errors.ts" }] }],
			},
			// Library allowlist skips global errors
			{
				code: ["function foo() {", "\tthrow new TypeError('bad');", "}"].join("\n"),
				options: [{ allow: [{ from: "library", name: "TypeError" }] }],
			},
			{
				code: ["function foo() {", "\tthrow new ValidationError('bad');", "}"].join("\n"),
				options: [{ allow: [{ name: "ValidationError" }] }],
			},
			// Array of names in a single specifier
			{
				code: ["function foo() {", "\tthrow new ValidationError('bad');", "}"].join("\n"),
				options: [{ allow: [{ name: ["ValidationError", "CommandError"] }] }],
			},
		],
	});
});
