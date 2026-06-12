import { describe } from "vitest";
import rule from "$oxc-rules/no-commented-code";

import { jsx } from "./rule-testers";

describe("no-commented-code", () => {
	// @ts-expect-error -- Shut up
	jsx.run("no-commented-code", rule, {
		invalid: [
			{
				code: "// if (something) {}",
				errors: [
					{
						column: 1,
						endColumn: 21,
						endLine: 1,
						line: 1,
						message:
							"Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `// // nested comment
// foo(a, function(){
//     doSmth();
// });`,
				errors: [
					{
						column: 1,
						endColumn: 7,
						endLine: 4,
						line: 1,
						message:
							"Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `/* // nested comment
@annotation
class MyClass {}

foo(a, function(){
   doSmth();
   const a = <bv></bv>
});*/`,
				errors: [
					{
						column: 1,
						endColumn: 6,
						endLine: 8,
						line: 1,
						message:
							"Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: "// return foo().bar();",
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `// foo();
// bar();`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `/* foo();
bar(); */
const a = 1;`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [
							{
								desc: "Remove this commented out code",
								output: `
const a = 1;`,
							},
						],
					},
				],
			},
			{
				code: "/* throw foo().bar(); */",
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `// if (condition) {
//   while (condition) {
//     doSomething();`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `//   while (condition) {
//     doSomething();
//   }
// }`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: "// }}",
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: "// {{",
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: `//   }
// }`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "" }],
					},
				],
			},
			{
				code: "let x = /* let x = 42; */ 0;",
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [{ desc: "Remove this commented out code", output: "let x =  0;" }],
					},
				],
			},
			{
				code: `// if (value == 42) {
//   value++
let x = 0;`,
				errors: [
					{
						messageId: "commentedCode",
						suggestions: [
							{
								desc: "Remove this commented out code",
								output: `
let x = 0;`,
							},
						],
					},
				],
			},
		],
		valid: [
			// Empty and whitespace comments
			{
				code: `
        //

        //

        /* */

        //
        //  // nested comment
        //

        /**
         * // this should be ignored
         * if (something) { return true;}
         */

        /*jslint bitwise: false, browser: true, continue: false, devel: true, eqeq: false, evil: false, forin: false, newcap: false, nomen: false, plusplus: true, regexp: true, stupid: false, sub: false, undef: false, vars: false */

        /*jshint bitwise: false, curly: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, noarg: true, noempty: false, nonew: true, plusplus: false, regexp: false, undef: true, strict: true, trailing: true, expr: true, regexdash: true, browser: true, jquery: true, onevar: true, nomen: true */

        /*global myGlobal: true */

        // ====

        // ----

        // ++++

        // some text with semicolon at the end;

        // http://www.example.com/ = http://www.example.com/

        // labelName : id

        // foo(), bar();

        // continue

        // return blabla

        // break something

        // throw exception

        // throw exception;

        // labelName : id;

        const a = 1; // TODO: $ReadOnlyArray
        const b = 2; // TODO: Not in spec

        //\t\t\t\tbreak;

        // foo.bar

        // a + b

        // foo (see [123])

        // IE

        // shift

        // reduce

        //Object;

        //+ 10;

        // '\\r\\n'
        const c = 1; // '\\n'

        // "abc";

        // 42;

        //"gradientunscaled";

        // some text with some code is ok
        // if (condition) {
        // }


        /*
         some text with some code is ok
         if (condition) {
         }
        */

        // }
        `,
			},
			// FN since 2-step implementation
			{
				code: `
            // return foo().bar()
        `,
			},
			// FN since 2-step implementation
			{
				code: `
            // throw foo().bar()
        `,
			},
			// FN since 2-step implementation
			{
				code: `
            // YUI().use('*'); // Comment following ';'
        `,
			},
		],
	});
});
