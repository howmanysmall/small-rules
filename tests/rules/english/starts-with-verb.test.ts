import { describe } from "vitest";

import rule from "$oxc-rules/english/starts-with-verb";
import { ts } from "$test/rule-testers";

const notVerbErrors = [{ messageId: "notVerb" }];

describe("starts-with-verb", () => {
	ts.run("starts-with-verb", rule, {
		invalid: [
			{
				code: ["function userProfile(id: string): string {", "\treturn id;", "}"].join("\n"),
				errors: [{ data: { name: "userProfile", prefix: "user" }, messageId: "notVerb" }],
				documentation: { id: "fail", title: "Noun function name" },
			},
			{
				code: "const data = (): number => 1;",
				errors: [{ data: { name: "data", prefix: "data" }, messageId: "notVerb" }],
			},
			{
				code: "const amount = function (): number { return 1; };",
				errors: notVerbErrors,
			},
			{
				code: ["class Store {", "\tpublic amount(): number {", "\t\treturn 1;", "\t}", "}"].join("\n"),
				errors: notVerbErrors,
			},
			{
				code: ["class Store {", "\t#internalValue(): number {", "\t\treturn 1;", "\t}", "}"].join("\n"),
				errors: [{ data: { name: "internalValue", prefix: "internal" }, messageId: "notVerb" }],
			},
			{
				code: ["class Store {", "\tpublic item = (): number => 1;", "}"].join("\n"),
				errors: notVerbErrors,
			},
			{
				code: ["const handlers = {", "\titem(): number {", "\t\treturn 1;", "\t},", "};"].join("\n"),
				errors: notVerbErrors,
			},
			{
				code: ["const handlers = {", "\titem: (): number => 1,", "};"].join("\n"),
				errors: notVerbErrors,
			},
			{
				code: ["const handlers = {", "\titem: function (): number {", "\t\treturn 1;", "\t},", "};"].join("\n"),
				errors: notVerbErrors,
			},
			{
				code: "function fileName(): string { return ''; }",
				errors: [{ data: { name: "fileName", prefix: "file" }, messageId: "notVerb" }],
			},
			{
				code: "function fileName(): string { return ''; }",
				options: [{ allowList: ["file"] }],
				errors: notVerbErrors,
			},
			{
				code: "function getValue(): number { return 1; }",
				options: [{ denyList: ["get"] }],
				errors: [{ data: { name: "getValue", prefix: "get" }, messageId: "notVerb" }],
			},
			{
				code: "function userName(): string { return ''; }",
				options: [{ allowList: ["user"], denyList: ["user"] }],
				errors: notVerbErrors,
			},
			{
				code: [
					"function payload(input: string): string;",
					"function payload(input: number): number;",
					"function payload(input: unknown): unknown {",
					"\treturn input;",
					"}",
				].join("\n"),
				errors: notVerbErrors,
			},
		],
		valid: [
			{
				code: ["function getUserProfile(id: string): string {", "\treturn id;", "}"].join("\n"),
				documentation: { id: "pass", title: "Verb function name" },
			},
			"const handleClick = (): void => {};",
			"const isVisible = function (): boolean { return true; };",
			"function shouldRender(): boolean { return true; }",
			"function doesExist(): boolean { return true; }",
			"const wasCancelled = (): boolean => true;",
			["class Store {", "\tpublic needsUpdate(): boolean {", "\t\treturn true;", "\t}", "}"].join("\n"),
			"function UserProfile(): undefined { return undefined; }",
			"export default function (): void {}",
			"const amount = 1;",
			"let callback: () => void;",
			"const { length } = (): void => {};",
			"declare function amount(): void;",
			["class Store {", "\tpublic constructor() {}", "}"].join("\n"),
			["class Store {", "\tpublic get amount(): number {", "\t\treturn 1;", "\t}", "}"].join("\n"),
			["class Store {", "\tpublic set amount(next: number) {}", "}"].join("\n"),
			["class Store {", "\tpublic amount = 1;", "}"].join("\n"),
			["class Store {", "\tpublic createItem = (): number => 1;", "}"].join("\n"),
			[
				"class Child extends Base {",
				"\tpublic override amount(): number {",
				"\t\treturn 1;",
				"\t}",
				"\tpublic override item = (): number => 1;",
				"}",
			].join("\n"),
			["const key = 'value';", "class Store {", "\tpublic [key](): number {", "\t\treturn 1;", "\t}", "}"].join(
				"\n",
			),
			["const key = 'value';", "class Store {", "\tpublic [key] = (): number => 1;", "}"].join("\n"),
			["const handlers = {", "\t'amount'(): number {", "\t\treturn 1;", "\t},", "};"].join("\n"),
			["const handlers = {", "\tamount: 1,", "};"].join("\n"),
			["const store = {", "\tget amount(): number {", "\t\treturn 1;", "\t},", "};"].join("\n"),
			["const key = 'value';", "const handlers = {", "\t[key]: (): number => 1,", "};"].join("\n"),
			["defineVisitor({", "\titem(): number {", "\t\treturn 1;", "\t},", "});"].join("\n"),
			["new Visitor({", "\titem: (): number => 1,", "});"].join("\n"),
			["const visitor = {", "\titem(): number {", "\t\treturn 1;", "\t},", "} satisfies Visitor;"].join("\n"),
			{
				code: "function userName(): string { return ''; }",
				options: [{ allowList: ["user"] }],
			},
		],
	});
});
