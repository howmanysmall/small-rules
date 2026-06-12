import { describe } from "vitest";
import rule from "$oxc-rules/require-switch-case-braces";

import { js } from "./rule-testers";

const case1Input = ["switch (value) {", "  case 1:", "    doFirst();", "    break;", "}"].join("\n");
const case1Output = ["switch (value) {", "  case 1:", "    {", "doFirst();", "    break;", "}", "}"].join("\n");

const case3Input = [
	"switch (value) {",
	"  case 1:",
	"    doFirst();",
	"    doSecond();",
	"    doThird();",
	"    break;",
	"}",
].join("\n");
const case3Output = [
	"switch (value) {",
	"  case 1:",
	"    {",
	"doFirst();",
	"    doSecond();",
	"    doThird();",
	"    break;",
	"}",
	"}",
].join("\n");

const singleLineStatementsInput = "switch (value) { case 1: doFirst(); break; }";
const singleLineStatementsOutput = "switch (value) { case 1: {\ndoFirst(); break;\n} }";

const caseAndDefaultInput = [
	"switch (value) {",
	"  case 1:",
	"    doThing();",
	"    break;",
	"  default:",
	"    doDefault();",
	"    break;",
	"}",
].join("\n");
const caseAndDefaultOutput = [
	"switch (value) {",
	"  case 1:",
	"    {",
	"doThing();",
	"    break;",
	"}",
	"  default:",
	"    {",
	"doDefault();",
	"    break;",
	"}",
	"}",
].join("\n");

const multilineSingleInput = [
	"switch (value) {",
	"  case 1:",
	"    doThing()",
	"      .chain()",
	"      .end();",
	"}",
].join("\n");
const multilineSingleOutput = [
	"switch (value) {",
	"  case 1:",
	"    {",
	"doThing()",
	"      .chain()",
	"      .end();",
	"}",
	"}",
].join("\n");

const defaultOnlyInput = ["switch (value) {", "  default:", "    first();", "    second();", "}"].join("\n");
const defaultOnlyOutput = ["switch (value) {", "  default:", "    {", "first();", "    second();", "}", "}"].join("\n");

const statementsMode3Input = [
	"switch (value) {",
	"  case 1:",
	"    first();",
	"    second();",
	"    third();",
	"}",
].join("\n");
const statementsMode3Output = [
	"switch (value) {",
	"  case 1:",
	"    {",
	"first();",
	"    second();",
	"    third();",
	"}",
	"}",
].join("\n");

const fallthroughInput = [
	"switch (value) {",
	"  case 1:",
	"  case 2:",
	"    doFirst();",
	"    doSecond();",
	"    break;",
	"}",
].join("\n");
const fallthroughOutput = [
	"switch (value) {",
	"  case 1:",
	"  case 2:",
	"    {",
	"doFirst();",
	"    doSecond();",
	"    break;",
	"}",
	"}",
].join("\n");

describe("require-switch-case-braces", () => {
	// @ts-expect-error - RuleTester types are stricter than the runtime rule shape
	js.run("require-switch-case-braces", rule, {
		invalid: [
			{
				code: case1Input,
				errors: [{ messageId: "wrapCaseBody" }],
				output: case1Output,
			},
			{
				code: case3Input,
				errors: [{ messageId: "wrapCaseBody" }],
				output: case3Output,
			},
			{
				code: singleLineStatementsInput,
				errors: [{ messageId: "wrapCaseBody" }],
				options: [{ metric: "statements" }],
				output: singleLineStatementsOutput,
			},
			{
				code: caseAndDefaultInput,
				errors: [{ messageId: "wrapCaseBody" }, { messageId: "wrapCaseBody" }],
				output: caseAndDefaultOutput,
			},
			{
				code: multilineSingleInput,
				errors: [{ messageId: "wrapCaseBody" }],
				output: multilineSingleOutput,
			},
			{
				code: defaultOnlyInput,
				errors: [{ messageId: "wrapCaseBody" }],
				output: defaultOnlyOutput,
			},
			{
				code: statementsMode3Input,
				errors: [{ messageId: "wrapCaseBody" }],
				options: [{ metric: "statements" }],
				output: statementsMode3Output,
			},
			{
				code: fallthroughInput,
				errors: [{ messageId: "wrapCaseBody" }],
				output: fallthroughOutput,
			},
		],
		valid: [
			"switch (value) { case 1: }",
			"switch (value) { case 1: doThing(); }",
			"switch (value) { case 1: { doThing(); break; } }",
			"switch (value) { case 1: break; default: doDefault(); }",
			"switch (value) { case 1: doFirst(); break; }",
			{
				code: "switch (value) { case 1: doThing(); }",
				options: [{ metric: "statements" }],
			},
			{
				code: ["switch (value) {", "  case 1:", "    doThing()", "      .chain();", "}"].join("\n"),
				options: [{ metric: "statements" }],
			},
			{
				code: ["switch (value) {", "  case 1:", "    break;", "  default:", "    doDefault();", "}"].join("\n"),
			},
			{
				code: [
					"switch (value) {",
					"  case 1:",
					"    break;",
					"  case 2:",
					"    break;",
					"  default:",
					"    break;",
					"}",
				].join("\n"),
			},
		],
	});
});
