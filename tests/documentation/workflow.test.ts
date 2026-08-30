// oxlint-disable vitest/no-conditional-in-test -- you annoy me.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { parseYAML } from "confbox";

const isMaybeString = type("string | undefined");
const isUndefined = type("undefined");
const isUnknown = type("unknown");

const isSteps = type({
	"name?": isMaybeString,
	"run?": isMaybeString,
	"uses?": isMaybeString,
	"with?": type({
		"persist-credentials?": "boolean | undefined",
	}).or(isUndefined),
	"working-directory?": isMaybeString,
}).array();

const isCiJob = type({
	"uses?": isMaybeString,
});

const isCi = type({
	"jobs?": type({ "[string]": isCiJob }).or(isUndefined),
	"on?": type({ "push?": type({ "paths?": "string[] | undefined" }).or(isUndefined) }).or(isUndefined),
	"permissions?": type({ "pages?": isMaybeString }).or(isUndefined),
});

const isChecksJob = type({
	"name?": isMaybeString,
	"steps?": isSteps.or(isUndefined),
});

const isChecks = type({
	"jobs?": type({ "[string]": isChecksJob }).or(isUndefined),
});

const isReleaseWith = type({ "ref?": isMaybeString });

const isDeployDocumentation = type({
	"if?": isMaybeString,
	"needs?": isMaybeString,
	"uses?": isMaybeString,
	"with?": isReleaseWith.or(isUndefined),
});

const isRelease = type({
	"jobs?": type({
		"deploy-documentation?": isDeployDocumentation.or(isUndefined),
	}).or(isUndefined),
});

const isDeployJob = type({
	"environment?": isMaybeString,
	"steps?": isSteps.or(isUndefined),
});

const isWorkflowDispatch = type({
	"inputs?": type({
		"ref?": type({
			"default?": isMaybeString,
			"description?": isMaybeString,
		}).or(isUndefined),
	}).or(isUndefined),
});

const isDocs = type({
	"jobs?": type({
		"deploy?": isDeployJob.or(isUndefined),
	}).or(isUndefined),
	"on?": type({
		"pull_request?": isUnknown,
		"workflow_call?": isUnknown,
		"workflow_dispatch?": isWorkflowDispatch.or(isUndefined),
		"workflow_run?": isUnknown,
	}).or(isUndefined),
	"permissions?": type({
		"contents?": isMaybeString,
		"id-token?": isMaybeString,
		"pages?": isMaybeString,
	}).or(isUndefined),
});

const ciRaw = readFileSync(".github/workflows/ci.yaml", "utf8");
const checksRaw = readFileSync(".github/workflows/checks.yaml", "utf8");
const releaseRaw = readFileSync(".github/workflows/release.yaml", "utf8");
const DOCS_WORKFLOW_PATH = ".github/workflows/docs.yaml";

const ci = isCi.assert(parseYAML(ciRaw));
const checks = isChecks.assert(parseYAML(checksRaw));
const release = isRelease.assert(parseYAML(releaseRaw));

type Docs = typeof isDocs.infer;

function loadDocs(): Docs {
	if (!existsSync(DOCS_WORKFLOW_PATH)) {
		throw new TypeError(`Docs workflow not found at ${DOCS_WORKFLOW_PATH}`);
	}
	const docsRaw = readFileSync(DOCS_WORKFLOW_PATH, "utf8");
	return isDocs.assert(parseYAML(docsRaw));
}

function readDocsRaw(): string {
	return existsSync(DOCS_WORKFLOW_PATH) ? readFileSync(DOCS_WORKFLOW_PATH, "utf8") : "";
}

describe("documentation validation workflow", () => {
	// Catches documentation-only changes skipping validation entirely.
	it("runs for documentation and documentation-source changes", () => {
		expect.assertions(3);
		const paths = ci.on?.push?.paths;
		expect(paths).toContain("documentation/**");
		expect(paths).toContain("src/**/*.ts");
		expect(paths).toContain("tests/**");
	});
});

describe("documentation deployment workflow", () => {
	// Catches docs deploying on ordinary pushes or before publish succeeds.
	it("deploys after a successful version-tag release, never ordinary CI", () => {
		expect.assertions(11);
		const docs = loadDocs();
		expect(docs.on?.workflow_call).toBeDefined();
		expect(docs.on?.workflow_dispatch).toBeDefined();

		const ciUsesDocs = Object.values(ci.jobs ?? {}).some((job) => job.uses === "./.github/workflows/docs.yaml");
		expect(ciUsesDocs).toBe(false);
		expect(ci.permissions?.pages).not.toBe("write");

		const deployDocsJob = release.jobs?.["deploy-documentation"];
		expect(deployDocsJob?.needs).toBe("publish");
		expect(deployDocsJob?.if).toContain("github.event_name == 'push'");
		expect(deployDocsJob?.if).toContain("startsWith(github.ref, 'refs/tags/')");
		expect(deployDocsJob?.uses).toBe("./.github/workflows/docs.yaml");
		expect(deployDocsJob?.with?.ref).toBe("main");

		expect(docs.on?.workflow_run).toBeUndefined();
		expect(docs.on?.pull_request).toBeUndefined();
	});

	// Catches the deployment gaining write access it does not need.
	it("uses GitHub Pages with minimal permissions", () => {
		expect.assertions(4);
		const docs = loadDocs();
		expect(docs.permissions?.contents).toBe("read");
		expect(docs.permissions?.pages).toBe("write");
		expect(docs.permissions?.["id-token"]).toBe("write");
		expect(docs.jobs?.deploy?.environment).toBe("github-pages");
	});

	// Catches a checkout step persisting credentials into every following step.
	it("never persists checkout credentials in the checks workflow", () => {
		expect.assertions(1);
		const allSteps = Object.values(checks.jobs ?? {}).flatMap((job) => job.steps ?? []);
		const hasPersistCredentials = allSteps.some((step) => step.with?.["persist-credentials"] === false);
		expect(hasPersistCredentials).toBe(true);
	});

	// Catches workflows gaining branch writes or release credentials.
	it("keeps validation and deployment workflows free of branch writes and release credentials", () => {
		expect.assertions(5);
		const readOnlyWorkflows = `${ciRaw}\n${checksRaw}\n${readDocsRaw()}`;
		expect(readOnlyWorkflows).not.toContain("git commit");
		expect(readOnlyWorkflows).not.toContain("git push");
		expect(readOnlyWorkflows).not.toContain("NPM_TOKEN");
		expect(readOnlyWorkflows).not.toContain("NODE_AUTH_TOKEN");
		expect(readOnlyWorkflows).not.toContain("GH_TOKEN");
	});
});
