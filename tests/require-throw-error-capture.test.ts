import { describe } from "vitest";
import rule from "$oxc-rules/general/require-throw-error-capture";

import { ts } from "./rule-testers";

const error = {
	messageId: "missingCaptureStackTrace" as const,
};

describe("require-throw-error-capture", () => {
	ts.run("require-throw-error-capture", rule, {
		invalid: [
			// Named function declaration
			{
				code: ["function foo() {", "	throw new Error('bad');", "}"].join("\n"),
				output: [
					"function foo() {",
					"	const error = new Error('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				errors: [{ messageId: "missingCaptureStackTrace" }],
				documentation: { id: "fail", title: "Missing stack trace capture" },
			},
			// TypeError subclass
			{
				code: ["function bar() {", "	throw new TypeError('invalid');", "}"].join("\n"),
				output: [
					"function bar() {",
					"	const error = new TypeError('invalid');",
					"Error.captureStackTrace(error, bar);",
					"throw error;",
					"}",
				].join("\n"),
				errors: [error],
			},
			// NewExpression without arguments
			{
				code: ["function baz() {", "	throw new Error();", "}"].join("\n"),
				output: [
					"function baz() {",
					"	const error = new Error();",
					"Error.captureStackTrace(error, baz);",
					"throw error;",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Method in a class
			{
				code: ["class Foo {", "	doThing() {", "		throw new Error('oops');", "	}", "}"].join("\n"),
				output: [
					"class Foo {",
					"	doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Private method in a class
			{
				code: ["class Foo {", "	#doThing() {", "		throw new Error('oops');", "	}", "}"].join("\n"),
				output: [
					"class Foo {",
					"	#doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.#doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Arrow function assigned to class property
			{
				code: ["class Foo {", "	doThing = () => {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				output: [
					"class Foo {",
					"	doThing = () => {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Static method in a class
			{
				code: ["class Foo {", "	static doThing() {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				output: [
					"class Foo {",
					"	static doThing() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Arrow function assigned to variable
			{
				code: ["const myFn = () => {", "	throw new Error('oops');", "};"].join("\n"),
				output: [
					"const myFn = () => {",
					"	const error = new Error('oops');",
					"Error.captureStackTrace(error, myFn);",
					"throw error;",
					"};",
				].join("\n"),
				errors: [error],
			},
			// Function expression assigned to variable
			{
				code: ["const myFn2 = function() {", "	throw new Error('nope');", "};"].join("\n"),
				output: [
					"const myFn2 = function() {",
					"	const error = new Error('nope');",
					"Error.captureStackTrace(error, myFn2);",
					"throw error;",
					"};",
				].join("\n"),
				errors: [error],
			},
			{
				code: ["const myFn3 = function Inner() {", "	throw new Error('nope');", "};"].join("\n"),
				output: [
					"const myFn3 = function Inner() {",
					"	const error = new Error('nope');",
					"Error.captureStackTrace(error, Inner);",
					"throw error;",
					"};",
				].join("\n"),
				errors: [error],
			},
			{
				code: [
					"class Foo {",
					"	doThing = function() {",
					"		throw new Error('oops');",
					"	}",
					"}",
				].join("\n"),
				output: [
					"class Foo {",
					"	doThing = function() {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.doThing);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			{
				code: ["class Foo {", "	#handle = () => {", "		throw new Error('oops');", "	}", "}"].join(
					"\n",
				),
				output: [
					"class Foo {",
					"	#handle = () => {",
					"		const error = new Error('oops');",
					"Error.captureStackTrace(error, this.#handle);",
					"throw error;",
					"	}",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Custom error class ending with Error
			{
				code: ["function handler() {", "	throw new CustomError('fail');", "}"].join("\n"),
				output: [
					"function handler() {",
					"	const error = new CustomError('fail');",
					"Error.captureStackTrace(error, handler);",
					"throw error;",
					"}",
				].join("\n"),
				errors: [error],
			},
			// Single-line if body must be wrapped in braces
			{
				// oxlint-disable-next-line no-template-curly-in-string -- this is fine.
				code: "function fetchModels() { if (!response.ok) throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`); }",
				// oxlint-disable-next-line no-template-curly-in-string -- this is fine.
				output: "function fetchModels() { if (!response.ok) {\nconst error = new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);\nError.captureStackTrace(error, fetchModels);\nthrow error;\n} }",
				errors: [error],
			},
			// File specifier with path that does not match <input> still reports
			{
				code: ["function foo() {", "\tthrow new ValidationError('bad');", "}"].join("\n"),
				output: [
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "file", name: "ValidationError", path: "src/errors.ts" }] }],
				errors: [error],
			},
			// Non-allowed error still reports when allow option is present
			{
				code: ["function foo() {", "\tthrow new Error('bad');", "}"].join("\n"),
				output: [
					"function foo() {",
					"\tconst error = new Error('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: ["ValidationError"] }],
				errors: [error],
			},
			{
				code: ["const TypeError = Error;", "function foo() {", "\tthrow new TypeError('bad');", "}"].join("\n"),
				output: [
					"const TypeError = Error;",
					"function foo() {",
					"\tconst error = new TypeError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "library", name: "TypeError" }] }],
				errors: [error],
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
				errors: [error],
			},
			// Package-aware specifier does not match a different import source
			{
				code: [
					"import { ValidationError } from 'other-package';",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				output: [
					"import { ValidationError } from 'other-package';",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "package", name: "ValidationError", package: "@cliffy/command" }] }],
				errors: [error],
			},
			{
				code: [
					"import { ValidationError } from '@cliffy/command';",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				output: [
					"import { ValidationError } from '@cliffy/command';",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "package", name: "ValidationError" }] }],
				errors: [error],
			},
			{
				code: [
					"const ValidationError = makeError();",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				output: [
					"const ValidationError = makeError();",
					"function foo() {",
					"\tconst error = new ValidationError('bad');",
					"Error.captureStackTrace(error, foo);",
					"throw error;",
					"}",
				].join("\n"),
				options: [{ allow: [{ from: "file", name: "ValidationError", path: "src/errors.ts" }] }],
				errors: [error],
			},
		],
		valid: [
			// Already using `captureStackTrace` pattern
			{
				code: [
					"function good() {",
					"	const err = new Error('msg');",
					"	Error.captureStackTrace(err, good);",
					"	throw err;",
					"}",
				].join("\n"),
				documentation: { id: "pass", title: "Captured stack trace before throw" },
			},
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
			// Anonymous function expression in object literal — property key is
			// not a variable
			["const handlers = {", "\tload: function() {", "\t\tthrow new Error('oops');", "\t},", "};"].join("\n"),
			// Arrow function in object literal — same reason
			[
				"const x = {",
				"\tvalidateAsync: async () => {",
				"\t\tthrow new Error('schema mismatch');",
				"\t},",
				"};",
			].join("\n"),
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
				options: [{ allow: [{ name: "ValidationError", from: "package", package: "@cliffy/command" }] }],
			},
			// File-local allowlist skips locally declared errors
			{
				code: [
					"class ValidationError extends Error {}",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				options: [{ allow: [{ name: "ValidationError", from: "file" }] }],
			},
			{
				filename: "src/errors.ts",
				code: [
					"class ValidationError extends Error {}",
					"function foo() {",
					"\tthrow new ValidationError('bad');",
					"}",
				].join("\n"),
				options: [{ allow: [{ name: "ValidationError", from: "file", path: "src/errors.ts" }] }],
			},
			// Library allowlist skips global errors
			{
				code: ["function foo() {", "\tthrow new TypeError('bad');", "}"].join("\n"),
				options: [{ allow: [{ name: "TypeError", from: "library" }] }],
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
