import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { existsAsync, isFileAccessibleAsync } from "./index.ts";

// Bugs these tests guard: a missing path must resolve to `false` instead of
// throwing, while any other failure — permissions, a non-directory in the
// path — must propagate instead of masquerading as "does not exist".
const existingFilePath = fileURLToPath(new URL("../package.json", import.meta.url));

// A path through a regular file lstat answers ENOTDIR, not ENOENT (POSIX).
const pathThroughFile = fileURLToPath(new URL("../package.json/child", import.meta.url));

describe("existsAsync", () => {
	it("returns true for an existing file", async () => {
		expect.assertions(1);

		const result = await existsAsync(existingFilePath);
		expect(result).toBe(true);
	});

	it("returns false for a missing path", async () => {
		expect.assertions(1);

		const missingPath = path.join(tmpdir(), `small-rules-fs-utilities-missing-${randomUUID()}`);

		const result = await existsAsync(missingPath);
		expect(result).toBe(false);
	});

	it("rethrows failures that are not a missing path", async () => {
		expect.assertions(1);

		await expect(existsAsync(pathThroughFile)).rejects.toMatchObject({ code: "ENOTDIR" });
	});
});

// Bugs these tests guard: a missing path must report inaccessible instead of
// throwing. Unlike `existsAsync`, every `access` failure — missing path or
// permission-denied — folds into `false`, because callers only use it to
// skip candidate directories.
describe("isFileAccessibleAsync", () => {
	it("returns true for an existing file", async () => {
		expect.assertions(1);

		const result = await isFileAccessibleAsync(existingFilePath);
		expect(result).toBe(true);
	});

	it("returns false for a missing path", async () => {
		expect.assertions(1);

		const missingPath = path.join(tmpdir(), `small-rules-fs-utilities-inaccessible-${randomUUID()}`);

		const result = await isFileAccessibleAsync(missingPath);
		expect(result).toBe(false);
	});
});
