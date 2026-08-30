import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { parseYAML } from "confbox";
import { $ } from "zx";

const TAR_BLOCK_SIZE = 512;

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
	"concurrency?": type({
		"cancel-in-progress?": "boolean | undefined",
		"group?": "string | undefined",
	})
		.readonly()
		.or("undefined"),
	"jobs?": type({
		"publish?": isPublish.or("undefined"),
	})
		.readonly()
		.or("undefined"),
}).readonly();

const isPackageScripts = type({
	"scripts?": type({
		"prepublish?": "string | undefined",
		"prepublishOnly?": "string | undefined",
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
	// Catches two tag pushes racing into a double or cancelled publish.
	it("serializes all releases through one never-cancelling concurrency group", () => {
		expect.assertions(2);
		const workflow = isWorkflow.assert(parseYAML(RELEASE_YAML));

		expect(workflow.concurrency?.group).toBeDefined();
		expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
	});

	// Catches npm publish, which drops provenance and leaks catalog: refs.
	it("publishes with provenance through pnpm", () => {
		expect.assertions(2);
		const workflow = isWorkflow.assert(parseYAML(RELEASE_YAML));
		const publishStep = workflow.jobs?.publish?.steps?.find(
			({ name }) => name === "Publish to NPM (Trusted Publishing)",
		);

		expect(publishStep?.run?.startsWith("pnpm publish")).toBe(true);
		expect(publishStep?.run).toContain("--provenance");
	});

	// A tag commit is validated on main; re-running checks doubles the bill.
	it("does not rerun CI checks for a tag already validated on main", () => {
		expect.assertions(1);
		expect(RELEASE_YAML).not.toContain("uses: ./.github/workflows/checks.yaml");
	});

	// Catches publishing a commit that CI never validated.
	it("waits for the matching main-branch CI run before publishing", () => {
		expect.assertions(2);
		expect(RELEASE_YAML).toContain('gh run list --workflow ci.yaml --commit "$GITHUB_SHA"');
		expect(RELEASE_YAML).toContain('gh run watch "$CI_RUN_ID" --exit-status');
	});

	// Ordering is the contract: notes must land on main before the tag
	// publishes, or the documentation deployment from main misses them.
	it("commits release notes to main before publishing the tag", () => {
		expect.assertions(3);
		const worktreeIndex = RELEASE_YAML.indexOf("git worktree add");
		const publishIndex = RELEASE_YAML.indexOf("pnpm publish --provenance");

		expect(worktreeIndex).toBeGreaterThan(-1);
		expect(publishIndex).toBeGreaterThan(worktreeIndex);
		expect(RELEASE_YAML).toContain('git -C "$RELEASE_WORKTREE" push origin HEAD:main');
	});

	// Catches a dry run mutating the repository, which CI cannot surface.
	it("keeps dry runs read-only", () => {
		expect.assertions(2);
		expect(RELEASE_YAML).toContain("env.DRY_RUN != 'true'");
		expect(RELEASE_YAML).not.toContain("env.DRY_RUN == 'true'\n        run: git");
	});

	// A stray prepublish script or Build step would double-build or ship
	// stale output.
	it("uses prepublishOnly as the single real-release build", () => {
		expect.assertions(3);
		const manifest = isPackageScripts.assert(JSON.parse(PACKAGE_JSON));

		expect(manifest.scripts?.prepublishOnly).toBeDefined();
		expect(manifest.scripts?.prepublish).toBeUndefined();
		expect(RELEASE_YAML).not.toContain("name: Build");
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
