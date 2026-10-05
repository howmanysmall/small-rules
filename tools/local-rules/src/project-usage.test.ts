import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { countInlineNodeTypes, createProjectUsageCounter } from "./project-usage";

describe("countInlineNodeTypes", () => {
	it("counts node type strings in type comparisons, type switches, and node type arrays", () => {
		expect.assertions(1);

		const source = [
			'if (node.type === "Identifier") {}',
			'if ("Identifier" !== node?.type) {}',
			'if (getNodeType(value) == "LogicalExpression") {}',
			'switch (node.type) { case "ContinueStatement": break; case "Banana": break; default: break; }',
			'const TYPES = new Set(["BreakStatement", "ContinueStatement"]);',
		].join("\n");

		expect(Object.fromEntries(countInlineNodeTypes(source, "case.ts"))).toStrictEqual({
			BreakStatement: 1,
			ContinueStatement: 2,
			Identifier: 2,
			LogicalExpression: 1,
		});
	});

	it("ignores strings that are not node type uses", () => {
		expect.assertions(1);

		const source = [
			'const REACT_NODE_TYPE_NAMES = new Set(["JSXElement", "ReactElement", "ReactNode"]);',
			'const EMPTY = [];\nconst HOLES = [, "Identifier"];\nconst SPREAD = [...TYPES, "Identifier"];',
			'if (name === "Identifier") {}',
			'if (node.type > "Identifier") {}',
			'if (node["type"] === "Identifier") {}',
			'if (node.kind === "Identifier") {}',
			'switch (name) { case "Identifier": break; }',
			'type Narrowed = Extract<ESTree.Node, { type: "Identifier" }>;',
			'const IDENTIFIER = "Identifier" as const satisfies NodeType;',
		].join("\n");

		expect(countInlineNodeTypes(source, "case.ts").size).toBe(0);
	});

	it("parses TSX files", () => {
		expect.assertions(1);

		const source = 'const element = <A />;\nif (node.type === "JSXText") {}';

		expect(Object.fromEntries(countInlineNodeTypes(source, "case.tsx"))).toStrictEqual({ JSXText: 1 });
	});
});

function createProject(files: Readonly<Record<string, string>>): string {
	const directory = mkdtempSync(nodePath.join(tmpdir(), "local-rules-usage-"));
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

describe("createProjectUsageCounter", () => {
	it("totals bundled source files, using live counts for the file being linted", () => {
		expect.assertions(3);

		const root = createProject({
			"other/c.ts": 'if (node.type === "ContinueStatement") {}',
			"src/a.test.ts": 'if (node.type === "ContinueStatement") {}',
			"src/a.ts": 'if (node.type === "ContinueStatement") {}',
			"src/nested/b.tsx": 'switch (node.type) { case "ContinueStatement": break; }',
			"src/notes.md": 'node.type === "ContinueStatement"',
			"src/types.d.ts": 'declare const isContinue: typeof node.type === "ContinueStatement";',
		});
		const countUsage = createProjectUsageCounter({
			directories: [nodePath.join(root, "src"), nodePath.join(root, "other")],
			maxAgeMilliseconds: 0,
		});
		const linted = nodePath.join(root, "src/a.ts");

		expect(countUsage("ContinueStatement", linted, new Map([["ContinueStatement", 1]]))).toBe(3);
		expect(countUsage("ContinueStatement", linted, new Map())).toBe(2);
		expect(
			countUsage("ContinueStatement", nodePath.join(root, "src/unsaved.ts"), new Map([["ContinueStatement", 1]])),
		).toBe(4);
	});

	it("reuses a recent scan and rescans once it is older than the maximum age", () => {
		expect.assertions(3);

		const root = createProject({ "src/a.ts": 'if (node.type === "ContinueStatement") {}' });
		let now = 0;
		const countUsage = createProjectUsageCounter({
			directories: [nodePath.join(root, "src")],
			maxAgeMilliseconds: 1000,
			now: () => now,
		});

		expect(countUsage("ContinueStatement", "elsewhere.ts", new Map())).toBe(1);

		writeFileSync(nodePath.join(root, "src/a.ts"), "export {};");
		now = 500;

		expect(countUsage("ContinueStatement", "elsewhere.ts", new Map())).toBe(1);

		now = 2000;

		expect(countUsage("ContinueStatement", "elsewhere.ts", new Map())).toBe(0);
	});
});
