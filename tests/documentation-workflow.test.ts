// oxlint-disable unicorn-js/name-replacements -- you annoy me.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { parseYAML } from "confbox";

const isSteps = type({
	"name?": "string | undefined",
	"run?": "string | undefined",
	"uses?": "string | undefined",
	"with?": type({
		"install_args?": "string | undefined",
		"persist-credentials?": "boolean | undefined",
		"ref?": "string | undefined",
		"tools?": "string | undefined",
	}).or("undefined"),
	"working-directory?": "string | undefined",
}).array();

const isWorkflowJob = type({
	"environment?": "string | undefined",
	"if?": "string | undefined",
	"name?": "string | undefined",
	"needs?": "string | undefined",
	"steps?": isSteps.or("undefined"),
	"uses?": "string | undefined",
	"with?": type({
		"ref?": "string | undefined",
	}).or("undefined"),
});

const isDispatchRefInput = type({
	"default?": "string | undefined",
	"description?": "string | undefined",
});

const isDispatchInputs = type({
	"ref?": isDispatchRefInput.or("undefined"),
});

const isWorkflowOn = type({
	"pull_request?": "unknown",
	"push?": type({
		"paths?": "string[] | undefined",
	}).or("undefined"),
	"workflow_call?": "unknown",
	"workflow_dispatch?": type({
		"inputs?": isDispatchInputs.or("undefined"),
	}).or("undefined"),
	"workflow_run?": "unknown",
});

const isWorkflow = type({
	"jobs?": type({
		"[string]": isWorkflowJob,
	}).or("undefined"),
	"on?": isWorkflowOn.or("undefined"),
	"permissions?": type({
		"contents?": "string | undefined",
		"id-token?": "string | undefined",
		"pages?": "string | undefined",
	}).or("undefined"),
});
type Workflow = typeof isWorkflow.infer;

const isCompositeAction = type({
	"runs?": type({ "steps?": isSteps.or("undefined") }).or("undefined"),
});

const ciRaw = readFileSync(".github/workflows/ci.yaml", "utf8");
const checksRaw = readFileSync(".github/workflows/checks.yaml", "utf8");
const releaseRaw = readFileSync(".github/workflows/release.yaml", "utf8");
const setupActionRaw = readFileSync(".github/actions/setup/action.yaml", "utf8");
const DOCS_WORKFLOW_PATH = ".github/workflows/docs.yaml";
const DEPLOY_SCRIPT_PATH = "scripts/deploy-docs.sh";

const ci = isWorkflow.assert(parseYAML(ciRaw));
const checks = isWorkflow.assert(parseYAML(checksRaw));
const release = isWorkflow.assert(parseYAML(releaseRaw));
const setupAction = isCompositeAction.assert(parseYAML(setupActionRaw));

function loadDocs(): Workflow {
	if (!existsSync(DOCS_WORKFLOW_PATH)) {
		throw new TypeError(`Docs workflow not found at ${DOCS_WORKFLOW_PATH}`);
	}
	const docsRaw = readFileSync(DOCS_WORKFLOW_PATH, "utf8");
	return isWorkflow.assert(parseYAML(docsRaw));
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
