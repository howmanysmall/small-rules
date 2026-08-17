import { describe } from "vitest";
import rule from "$oxc-rules/general/require-switch-case-braces";

import { js } from "./rule-testers";

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
	js.run("require-switch-case-braces", rule, {
		invalid: [
			{
				code: ["switch (value) {", "  case 1:", "    doFirst();", "    break;", "}"].join("\n"),
				output: ["switch (value) {", "  case 1:", "    {", "doFirst();", "    break;", "}", "}"].join("\n"),
				errors: [{ messageId: "wrapCaseBody" }],
				documentation: { id: "fail", title: "Unbraced switch case body" },
			},
			{
				code: case3Input,
				output: case3Output,
				errors: [{ messageId: "wrapCaseBody" }],
			},
			{
				code: singleLineStatementsInput,
				output: singleLineStatementsOutput,
				options: [{ metric: "statements" }],
				errors: [{ messageId: "wrapCaseBody" }],
			},
			{
				code: caseAndDefaultInput,
				output: caseAndDefaultOutput,
				errors: [{ messageId: "wrapCaseBody" }, { messageId: "wrapCaseBody" }],
			},
			{
				code: multilineSingleInput,
				output: multilineSingleOutput,
				errors: [{ messageId: "wrapCaseBody" }],
			},
			{
				code: defaultOnlyInput,
				output: defaultOnlyOutput,
				errors: [{ messageId: "wrapCaseBody" }],
			},
			{
				code: statementsMode3Input,
				output: statementsMode3Output,
				options: [{ metric: "statements" }],
				errors: [{ messageId: "wrapCaseBody" }],
			},
			{
				code: fallthroughInput,
				output: fallthroughOutput,
				errors: [{ messageId: "wrapCaseBody" }],
			},
		],
		valid: [
			"switch (value) { case 1: }",
			"switch (value) { case 1: doThing(); }",
			{
				code: ["switch (value) {", "  case 1: {", "    doThing();", "    break;", "  }", "}"].join("\n"),
				documentation: { id: "pass", title: "Braced switch case body" },
			},
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
