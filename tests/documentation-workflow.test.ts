// oxlint-disable unicorn-js/name-replacements -- you annoy me.
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
		"install_args?": isMaybeString,
		"persist-credentials?": "boolean | undefined",
		"ref?": isMaybeString,
		"tools?": isMaybeString,
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

const isSetupAction = type({
	"runs?": type({ "steps?": isSteps.or(isUndefined) }).or(isUndefined),
});

const ciRaw = readFileSync(".github/workflows/ci.yaml", "utf8");
const checksRaw = readFileSync(".github/workflows/checks.yaml", "utf8");
const releaseRaw = readFileSync(".github/workflows/release.yaml", "utf8");
const setupActionRaw = readFileSync(".github/actions/setup/action.yaml", "utf8");
const DOCS_WORKFLOW_PATH = ".github/workflows/docs.yaml";
const DEPLOY_SCRIPT_PATH = "scripts/deploy-docs.sh";

const ci = isCi.assert(parseYAML(ciRaw));
const checks = isChecks.assert(parseYAML(checksRaw));
const release = isRelease.assert(parseYAML(releaseRaw));
const setupAction = isSetupAction.assert(parseYAML(setupActionRaw));

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

function getDeployScript(): string {
	return existsSync(DEPLOY_SCRIPT_PATH) ? readFileSync(DEPLOY_SCRIPT_PATH, "utf8") : "";
}

describe("documentation validation workflow", () => {
	it("runs for documentation and documentation-source changes", () => {
		expect.assertions(3);
		const paths = ci.on?.push?.paths;
		expect(paths).toContain("documentation/**");
		expect(paths).toContain("src/**/*.ts");
		expect(paths).toContain("tests/**");
	});

	it("builds the site and runs Chromium tests in reusable checks", () => {
		expect.assertions(9);
		const docSteps = checks.jobs?.documentation?.steps ?? [];
		expect(checks.jobs?.documentation?.name).toBe("Documentation");

		const setupStep = docSteps.find((step) => step.name === "Setup toolchain");
		expect(setupStep?.with?.tools).toBe("bun node pnpm ni");

		// oxlint-disable-next-line eslint/no-template-curly-in-string -- GitHub Actions expression, not a JS template literal
		expect(setupAction.runs?.steps?.[0]?.with?.install_args).toBe("${{ inputs.tools }}");

		const runCommands = docSteps.map((step) => step.run).filter((run): run is string => run !== undefined);
		expect(runCommands).toContain("pnpm --filter docs exec playwright install --with-deps chromium");

		const workingDirCount = docSteps.filter((step) => step["working-directory"] === "documentation").length;
		expect(workingDirCount).toBe(4);

		const buildIdx = runCommands.indexOf("node --run build");
		const testUnitIdx = runCommands.indexOf("node --run test:unit");
		const testBrowserIdx = runCommands.indexOf("node --run test:browser");
		expect(buildIdx).toBeLessThan(testUnitIdx);
		expect(testUnitIdx).toBeLessThan(testBrowserIdx);

		const allSteps = Object.values(checks.jobs ?? {}).flatMap((job) => job.steps ?? []);
		const hasDocsTestPrefix = allSteps.some((step) => step.run?.startsWith("pnpm --filter docs test:") === true);
		expect(hasDocsTestPrefix).toBe(false);

		const hasPersistCredentials = allSteps.some((step) => step.with?.["persist-credentials"] === false);
		expect(hasPersistCredentials).toBe(true);
	});
});

describe("documentation deployment workflow", () => {
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

	it("uses GitHub Pages actions with minimal permissions", () => {
		expect.assertions(7);
		const docs = loadDocs();
		expect(docs.permissions?.contents).toBe("read");
		expect(docs.permissions?.pages).toBe("write");
		expect(docs.permissions?.["id-token"]).toBe("write");

		const deploySteps = docs.jobs?.deploy?.steps ?? [];
		const stepUses = deploySteps.map((step) => step.uses).filter((uses): uses is string => uses !== undefined);
		expect(stepUses).toContainEqual(expect.stringMatching(/^actions\/configure-pages@/u));
		expect(stepUses).toContainEqual(expect.stringMatching(/^actions\/upload-pages-artifact@/u));
		expect(stepUses).toContainEqual(expect.stringMatching(/^actions\/deploy-pages@/u));

		expect(docs.jobs?.deploy?.environment).toBe("github-pages");
	});

	it("builds the generated release notes from main without ni", () => {
		expect.assertions(3);
		const docs = loadDocs();
		const deploySteps = docs.jobs?.deploy?.steps ?? [];
		const checkoutStep = deploySteps.find((step) => step.name === "Checkout");
		// oxlint-disable-next-line eslint/no-template-curly-in-string -- GitHub Actions expression, not a JS template literal
		expect(checkoutStep?.with?.ref).toBe("${{ inputs.ref }}");

		const buildStep = deploySteps.find((step) => step.run === "node --run build");
		expect(buildStep?.["working-directory"]).toBe("documentation");
		expect(buildStep?.run).toBe("node --run build");
	});

	it("dispatches an explicit main deployment through the script", () => {
		expect.assertions(4);
		const docs = loadDocs();
		expect(docs.on?.workflow_dispatch).toBeDefined();
		expect(docs.on?.workflow_dispatch?.inputs?.ref?.default).toBe("main");
		expect(docs.on?.workflow_dispatch?.inputs?.ref?.description).toBe("Git ref to deploy.");
		expect(getDeployScript()).toContain("gh workflow run docs.yaml --ref main -f ref=main");
	});

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
