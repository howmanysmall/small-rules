import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { describe, it } from "vitest";
import { type } from "arktype";

// Catches the docs deploy building with a tool the documentation site does not
// own. A stray binary such as `tsdown` walks up the tree, picks up the root
// library's config, and fails on an entry that does not exist here. The allowed
// names come from documentation/package.json, so rewording the command is fine.

const PackageManifest = type({
	"dependencies?": "Record<string, string>",
	"devDependencies?": "Record<string, string>",
	"scripts?": "Record<string, string>",
});

const documentationDirectory = nodePath.join(import.meta.dirname, "..", "..");
const workflowPath = nodePath.join(documentationDirectory, "..", ".github", "workflows", "docs.yaml");

function findBuildCommand(workflowSource: string): string {
	const lines = workflowSource.split("\n");
	const stepStart = lines.findIndex((line) => /^\s*- name: Build documentation\s*$/u.test(line));
	if (stepStart === -1) {
		throw new Error("docs.yaml has no 'Build documentation' step");
	}

	const stepLines = lines.slice(stepStart + 1);
	for (const line of stepLines) {
		if (/^\s*- name:/u.test(line)) break;

		const command = /^\s*run:\s*(?<command>.+?)\s*$/u.exec(line)?.groups?.command;
		if (command !== undefined) return command;
	}

	throw new Error("'Build documentation' step has no run command");
}

function getOwnedNames(): ReadonlySet<string> {
	const manifestSource = readFileSync(nodePath.join(documentationDirectory, "package.json"), "utf8");
	const manifest = PackageManifest.assert(JSON.parse(manifestSource));

	return new Set([
		...Object.keys(manifest.dependencies ?? {}),
		...Object.keys(manifest.devDependencies ?? {}),
		...Object.keys(manifest.scripts ?? {}),
	]);
}

describe("docs deploy build step", () => {
	it("builds with a command the documentation package owns", ({ expect }) => {
		expect.assertions(1);

		const command = findBuildCommand(readFileSync(workflowPath, "utf8"));
		const owned = getOwnedNames();

		expect(command.split(/\s+/u).some((token) => owned.has(token))).toBe(true);
	});
});
