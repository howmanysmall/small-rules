import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { createUtilitiesIndexLoader, indexUtilities } from "./utilities-index";

const UTILITIES_SOURCE = [
	'export const ROBLOX_TS = "roblox-ts" as const;',
	'export const STANDARD = "standard";',
	'export const IDENTIFIER = "Identifier" as const satisfies NodeType;',
	'const PRIVATE = "private";',
	'export let MUTABLE = "mutable";',
	"export const COUNT = 1;",
	"export const [DESTRUCTURED] = values;",
	"export function isStringLiteral(node?: ESTree.Node | null): node is ESTree.StringLiteral {",
	"\treturn isAnyLiteral(node) && Predicate.isString(node.value);",
	"}",
	"export function isIdentifierNamed(node: ESTree.Node, name: string): boolean {",
	'\treturn node.type === "Identifier" && node.name === name;',
	"}",
	"export function isSingle(node: ESTree.Node): boolean {",
	"\treturn isAnyLiteral(node);",
	"}",
	"export function isDefaulted(node: ESTree.Node = fallback): boolean {",
	"\treturn first(node) && second(node);",
	"}",
	"export function isLonger(node: ESTree.Node): boolean {",
	"\tconst value = node;",
	"\treturn first(value) && second(value);",
	"}",
	"export function isEmpty(node: ESTree.Node): void {",
	"\treturn;",
	"}",
	"export function isDeclared(node: ESTree.Node): boolean;",
	"function isPrivate(node: ESTree.Node): boolean {",
	"\treturn first(node) && second(node);",
	"}",
	"export default function (node: ESTree.Node): boolean {",
	"\treturn first(node) && second(node);",
	"}",
	"export type Alias = string;",
	"export { isPrivate };",
].join("\n");

describe("indexUtilities", () => {
	it("indexes exported string constants by value, skipping node types", () => {
		expect.assertions(1);

		const index = indexUtilities([{ source: UTILITIES_SOURCE, specifier: "@small-rules/example" }]);

		expect({
			Identifier: index.getConstants("Identifier"),
			mutable: index.getConstants("mutable"),
			private: index.getConstants("private"),
			"roblox-ts": index.getConstants("roblox-ts"),
		}).toStrictEqual({
			Identifier: [],
			mutable: [],
			private: [],
			"roblox-ts": [{ name: "ROBLOX_TS", specifier: "@small-rules/example" }],
		});
	});

	it("indexes exported guards whose whole body is one logical chain", () => {
		expect.assertions(1);

		const index = indexUtilities([{ source: UTILITIES_SOURCE, specifier: "@small-rules/example" }]);

		expect(index.getGuards().map(({ name, parameters }) => ({ name, parameters }))).toStrictEqual([
			{ name: "isStringLiteral", parameters: ["node"] },
			{ name: "isIdentifierNamed", parameters: ["node", "name"] },
		]);
	});

	it("keeps constants from every module that exports the value", () => {
		expect.assertions(1);

		const index = indexUtilities([
			{ source: 'export const MODE = "roblox-ts";', specifier: "first" },
			{ source: 'export const ENVIRONMENT = "roblox-ts";', specifier: "second" },
		]);

		expect(index.getConstants("roblox-ts")).toStrictEqual([
			{ name: "MODE", specifier: "first" },
			{ name: "ENVIRONMENT", specifier: "second" },
		]);
	});
});

function createDirectory(files: Readonly<Record<string, string>>): string {
	const directory = mkdtempSync(nodePath.join(tmpdir(), "local-rules-utilities-"));
	onTestFinished(() => {
		rmSync(directory, { force: true, recursive: true });
	});
	for (const [relativePath, contents] of Object.entries(files)) {
		const filePath = nodePath.join(directory, relativePath);
		mkdirSync(nodePath.dirname(filePath), { recursive: true });
		writeFileSync(filePath, contents);
	}
	return directory;
}

describe("createUtilitiesIndexLoader", () => {
	it("reads source files and names each module by its import specifier", () => {
		expect.assertions(1);

		const directory = createDirectory({
			"nested/mode.ts": 'export const MODE = "roblox-ts";',
			"notes.md": 'export const NOTE = "roblox-ts";',
			"react.test.ts": 'export const TESTED = "roblox-ts";',
			"react.ts": 'export const ROBLOX_TS = "roblox-ts";',
			"types.d.ts": 'export declare const DECLARED: "roblox-ts";',
		});
		const loadIndex = createUtilitiesIndexLoader({
			locations: [{ directory, toSpecifier: (relativePath) => `$utilities/${relativePath}` }],
			maxAgeMilliseconds: 0,
		});

		expect(
			loadIndex()
				.getConstants("roblox-ts")
				.toSorted((left, right) => left.name.localeCompare(right.name)),
		).toStrictEqual([
			{ name: "MODE", specifier: "$utilities/nested/mode" },
			{ name: "ROBLOX_TS", specifier: "$utilities/react" },
		]);
	});

	it("reuses a recent index and rereads once it is older than the maximum age", () => {
		expect.assertions(3);

		const directory = createDirectory({ "react.ts": 'export const ROBLOX_TS = "roblox-ts";' });
		let now = 0;
		const loadIndex = createUtilitiesIndexLoader({
			locations: [{ directory, toSpecifier: (relativePath) => relativePath }],
			maxAgeMilliseconds: 1000,
			now: () => now,
		});

		expect(loadIndex().getConstants("roblox-ts")).toHaveLength(1);

		writeFileSync(nodePath.join(directory, "react.ts"), "export {};");
		now = 500;

		expect(loadIndex().getConstants("roblox-ts")).toHaveLength(1);

		now = 2000;

		expect(loadIndex().getConstants("roblox-ts")).toHaveLength(0);
	});
});
