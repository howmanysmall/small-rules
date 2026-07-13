import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { parseYAML } from "confbox";
import { $ } from "zx";

const TAR_BLOCK_SIZE = 512;

const CHECKS_YAML = readFileSync(".github/workflows/checks.yaml", "utf8");
const CI_YAML = readFileSync(".github/workflows/ci.yaml", "utf8");
const RELEASE_YAML = readFileSync(".github/workflows/release.yaml", "utf8");
const PACKAGE_JSON = readFileSync("package.json", "utf8");

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

describe("checks workflow", () => {
	it("runs repository validation in one job", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).not.toContain("matrix.name");
	});

	it("uses compact Vitest reporting in CI", () => {
		expect.assertions(1);
		expect(CHECKS_YAML).toContain("--reporter github-actions --reporter dot");
	});
});

describe("ci workflow", () => {
	it("delegates checks to the reusable checks workflow", () => {
		expect.assertions(1);
		expect(CI_YAML).toContain("uses: ./.github/workflows/checks.yaml");
	});
});

describe("release workflow", () => {
	it("publishes through pnpm so catalog versions are resolved", () => {
		expect.assertions(1);
		const workflow = isWorkflow.assert(parseYAML(RELEASE_YAML));
		const publishStep = workflow.jobs?.publish?.steps?.find(
			({ name }) => name === "Publish to NPM (Trusted Publishing)",
		);

		expect(publishStep?.run).toBe("pnpm publish --provenance --access public --no-git-checks");
	});

	it("does not rerun CI checks for a tag already validated on main", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).not.toContain("uses: ./.github/workflows/checks.yaml");
	});

	it("waits for the matching main-branch CI run before publishing", () => {
		expect.assertions(2);
		expect(RELEASE_YAML).toContain('gh run list --workflow ci.yaml --commit "$GITHUB_SHA"');
		expect(RELEASE_YAML).toContain('gh run watch "$CI_RUN_ID" --exit-status');
	});

	it("does not explicitly build before pnpm runs prepublishOnly", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).not.toContain("name: Build");
	});

	it("uses prepublishOnly as the single real-release build", () => {
		expect.assertions(2);
		expect(PACKAGE_JSON).toContain('"prepublishOnly": "node --run build -- --minify"');
		expect(PACKAGE_JSON).not.toContain('"prepublish":');
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
