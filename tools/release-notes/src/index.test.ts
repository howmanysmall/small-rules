import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import {
	compareReleaseTagsDescending,
	countChangedLines,
	getReleaseTag,
	getReleaseTitle,
	listReleaseTagsAsync,
	readCommuniqueDefaults,
} from "./index.ts";

// Bugs these tests guard: the regeneration script picking up non-release
// files from the releases directory, sorting `v2.10.0` before `v2.9.0`
// (string order), silently regenerating with a stale model when
// `communique.toml` moves the key, and the preview summary misreporting how
// much a release note changed.

describe("release-notes-utilities", () => {
	describe("getReleaseTag", () => {
		it("returns the tag for a release note file", () => {
			expect.assertions(2);

			expect(getReleaseTag("v3.1.0.md")).toBe("v3.1.0");
			expect(getReleaseTag("v4.0.0-beta.2.md")).toBe("v4.0.0-beta.2");
		});

		it("ignores files that are not release notes", () => {
			expect.assertions(4);

			expect(getReleaseTag("README.md")).toBeUndefined();
			expect(getReleaseTag("v3.1.0.mdx")).toBeUndefined();
			expect(getReleaseTag("3.1.0.md")).toBeUndefined();
			expect(getReleaseTag("v3.1.md")).toBeUndefined();
		});
	});

	describe("compareReleaseTagsDescending", () => {
		it("orders numerically, newest first", () => {
			expect.assertions(1);

			const tags = ["v2.9.0", "v1.1.0", "v2.10.0", "v3.0.2", "v3.0.10"];

			expect(tags.toSorted(compareReleaseTagsDescending)).toStrictEqual([
				"v3.0.10",
				"v3.0.2",
				"v2.10.0",
				"v2.9.0",
				"v1.1.0",
			]);
		});

		it("places a prerelease after its stable release", () => {
			expect.assertions(1);

			const tags = ["v4.0.0-beta.1", "v4.0.0", "v4.0.0-beta.2", "v3.9.9"];

			expect(tags.toSorted(compareReleaseTagsDescending)).toStrictEqual([
				"v4.0.0",
				"v4.0.0-beta.2",
				"v4.0.0-beta.1",
				"v3.9.9",
			]);
		});

		it("falls back to reverse string order for tags that are not SemVer", () => {
			expect.assertions(1);

			expect(["nightly", "v1.0.0", "canary"].toSorted(compareReleaseTagsDescending)).toStrictEqual([
				"v1.0.0",
				"nightly",
				"canary",
			]);
		});

		it("treats identical tags as equal", () => {
			expect.assertions(1);

			expect(compareReleaseTagsDescending("v1.0.0", "v1.0.0")).toBe(0);
		});
	});

	describe("listReleaseTagsAsync", () => {
		it("lists only release note tags, newest first", async () => {
			expect.assertions(1);

			const directory = await mkdtemp(nodePath.join(tmpdir(), "release-notes-"));
			onTestFinished(async () => rm(directory, { force: true, recursive: true }));

			const files = ["v2.9.0.md", "v2.10.0.md", "notes.txt", "v1.1.0.md", "index.mdx"];
			await Promise.all(files.map(async (file) => writeFile(nodePath.join(directory, file), "# notes\n")));

			await expect(listReleaseTagsAsync(directory)).resolves.toStrictEqual(["v2.10.0", "v2.9.0", "v1.1.0"]);
		});
	});

	describe("readCommuniqueDefaults", () => {
		it("reads the default model and repository", () => {
			expect.assertions(1);

			const toml = [
				'system_extra = """',
				"model = 'not this one'",
				'"""',
				"",
				"[defaults]",
				'model = "~openai/gpt-luna-latest"',
				"max_tokens = 16384",
				'repo = "howmanysmall/small-rules"',
			].join("\n");

			expect(readCommuniqueDefaults(toml)).toStrictEqual({
				model: "~openai/gpt-luna-latest",
				owner: "howmanysmall",
				repository: "small-rules",
			});
		});

		it("throws when the model or repository is missing", () => {
			expect.assertions(3);

			expect(() => readCommuniqueDefaults('[defaults]\nrepo = "a/b"\n')).toThrow(
				"communique.toml: defaults.model",
			);
			expect(() => readCommuniqueDefaults('[defaults]\nmodel = "m"\n')).toThrow("communique.toml: defaults.repo");
			expect(() => readCommuniqueDefaults('model = "m"\nrepo = "a/b"\n')).toThrow("communique.toml: defaults");
		});

		it("throws when the repository is not owner/name", () => {
			expect.assertions(1);

			expect(() => readCommuniqueDefaults('[defaults]\nmodel = "m"\nrepo = "small-rules"\n')).toThrow(
				"communique.toml: defaults.repo",
			);
		});
	});

	describe("getReleaseTitle", () => {
		it("returns the first level-one heading", () => {
			expect.assertions(1);

			expect(getReleaseTitle("\n# v3.1.0: New diagnostics\n\n## Added\n# Other\n")).toBe(
				"v3.1.0: New diagnostics",
			);
		});

		it("returns undefined without a level-one heading", () => {
			expect.assertions(1);

			expect(getReleaseTitle("## Added\n\n- thing\n")).toBeUndefined();
		});
	});

	describe("countChangedLines", () => {
		it("counts lines added and removed", () => {
			expect.assertions(1);

			const before = ["# v1.0.0", "", "- old entry", "- kept"].join("\n");
			const after = ["# v1.0.0: Title", "", "- kept", "- new entry", "- another"].join("\n");

			expect(countChangedLines(before, after)).toStrictEqual({ added: 3, removed: 2 });
		});

		it("respects duplicate lines", () => {
			expect.assertions(1);

			expect(countChangedLines("a\na\nb", "a\nb\nb")).toStrictEqual({ added: 1, removed: 1 });
		});

		it("reports nothing for identical notes", () => {
			expect.assertions(1);

			expect(countChangedLines("same\n", "same\n")).toStrictEqual({ added: 0, removed: 0 });
		});
	});
});
