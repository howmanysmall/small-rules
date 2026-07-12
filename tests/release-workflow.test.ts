import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { parseYAML } from "confbox";
import { $ } from "zx";

const TAR_BLOCK_SIZE = 512;

const isSteps = type({
	"name?": "string | undefined",
	"run?": "string | undefined",
})
	.readonly()
	.array()
	.readonly();

const isPublish = type({
	"steps?": isSteps.or("undefined"),
}).readonly();

const isWorkflow = type({
	"jobs?": type({
		"publish?": isPublish.or("undefined"),
	})
		.readonly()
		.or("undefined"),
}).readonly();

function readPackageManifest(archivePath: string): string {
	const archive = gunzipSync(readFileSync(archivePath));

	let offset = 0;
	while (offset < archive.length) {
		const header = archive.subarray(offset, offset + TAR_BLOCK_SIZE);
		const path = header.subarray(0, 100).toString("utf8").replaceAll("\0", "");
		const size = Number.parseInt(header.subarray(124, 136).toString("utf8"), 8);
		const contentOffset = offset + TAR_BLOCK_SIZE;

		if (path === "package/package.json") {
			return archive.subarray(contentOffset, contentOffset + size).toString("utf8");
		}

		offset = contentOffset + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
	}

	const error = new Error("Packed archive does not contain package/package.json");
	Error.captureStackTrace(error, readPackageManifest);
	throw error;
}

describe("release workflow", () => {
	it("publishes through pnpm so catalog versions are resolved", () => {
		expect.assertions(1);
		const workflow = isWorkflow.assert(parseYAML(readFileSync(".github/workflows/release.yaml", "utf8")));
		const publishStep = workflow.jobs?.publish?.steps?.find(
			({ name }) => name === "Publish to NPM (Trusted Publishing)",
		);

		expect(publishStep?.run).toBe("pnpm publish --provenance --access public");
	});

	it("resolves catalog dependencies to registry-compatible versions", async () => {
		expect.assertions(1);
		const destination = mkdtempSync(nodePath.join(tmpdir(), "small-rules-pack-"));

		try {
			await $({ stdio: "ignore" })`pnpm pack --pack-destination ${destination}`;
			const archive = readdirSync(destination).join("");
			const manifest = readPackageManifest(nodePath.join(destination, archive));
			expect(manifest).not.toContain("catalog:");
		} finally {
			rmSync(destination, { force: true, recursive: true });
		}
	});
});
