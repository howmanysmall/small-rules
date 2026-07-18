import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CHECKS_YAML = readFileSync(".github/workflows/checks.yaml", "utf8");
const CI_YAML = readFileSync(".github/workflows/ci.yaml", "utf8");
const DOCS_WORKFLOW_PATH = ".github/workflows/docs.yaml";
const RELEASE_YAML = readFileSync(".github/workflows/release.yaml", "utf8");
const SETUP_ACTION_YAML = readFileSync(".github/actions/setup/action.yaml", "utf8");

function getDocsYaml(): string {
	return existsSync(DOCS_WORKFLOW_PATH) ? readFileSync(DOCS_WORKFLOW_PATH, "utf8") : "";
}

describe("documentation validation workflow", () => {
	it("runs for documentation and documentation-source changes", () => {
		expect.assertions(3);
		expect(CI_YAML).toContain('"documentation/**"');
		expect(CI_YAML).toContain('"src/**/*.ts"');
		expect(CI_YAML).toContain('"tests/**"');
	});

	it("builds the site and runs Chromium tests in reusable checks", () => {
		expect.assertions(9);
		expect(CHECKS_YAML).toContain("name: Documentation");
		expect(CHECKS_YAML).toContain('tools: "bun node pnpm ni"');
		expect(SETUP_ACTION_YAML).toMatch(/install_args: \$\{\{ inputs\.tools \}\}/u);
		expect(CHECKS_YAML).toContain("pnpm --filter docs exec playwright install --with-deps chromium");
		expect(CHECKS_YAML.match(/working-directory: documentation/gu)).toHaveLength(3);
		expect(CHECKS_YAML.indexOf("node --run build")).toBeLessThan(CHECKS_YAML.indexOf("node --run test:unit"));
		expect(CHECKS_YAML.indexOf("node --run test:unit")).toBeLessThan(
			CHECKS_YAML.indexOf("node --run test:browser"),
		);
		expect(CHECKS_YAML).not.toContain("pnpm --filter docs test:");
		expect(CHECKS_YAML).toContain("persist-credentials: false");
	});
});

describe("documentation deployment workflow", () => {
	it("deploys only after a successful version-tag release", () => {
		expect.assertions(11);
		const docsYaml = getDocsYaml();

		expect(docsYaml).toContain("workflow_call:");
		expect(docsYaml).not.toContain("workflow_dispatch:");
		expect(CI_YAML).not.toContain("uses: ./.github/workflows/docs.yaml");
		expect(CI_YAML).not.toContain("pages: write");
		expect(RELEASE_YAML).toContain("needs: publish");
		expect(RELEASE_YAML).toContain("github.event_name == 'push'");
		expect(RELEASE_YAML).toContain("startsWith(github.ref, 'refs/tags/')");
		expect(RELEASE_YAML).toContain("uses: ./.github/workflows/docs.yaml");
		expect(RELEASE_YAML).toContain("ref: main");
		expect(docsYaml).not.toContain("workflow_run:");
		expect(docsYaml).not.toContain("pull_request:");
	});

	it("uses GitHub Pages actions with minimal permissions", () => {
		expect.assertions(7);
		const docsYaml = getDocsYaml();

		expect(docsYaml).toContain("contents: read");
		expect(docsYaml).toContain("pages: write");
		expect(docsYaml).toContain("id-token: write");
		expect(docsYaml).toContain("actions/configure-pages@");
		expect(docsYaml).toContain("actions/upload-pages-artifact@");
		expect(docsYaml).toContain("actions/deploy-pages@");
		expect(docsYaml).toContain("environment: github-pages");
	});

	it("builds the generated release notes from main without ni", () => {
		expect.assertions(3);
		const docsYaml = getDocsYaml();

		expect(docsYaml).toMatch(/ref: \$\{\{ inputs\.ref \}\}/u);
		expect(docsYaml).toContain("working-directory: documentation");
		expect(docsYaml).toContain("run: node --run build");
	});

	it("keeps validation and deployment workflows free of branch writes and release credentials", () => {
		expect.assertions(5);
		const docsYaml = getDocsYaml();
		const readOnlyWorkflows = `${CI_YAML}\n${CHECKS_YAML}\n${docsYaml}`;

		expect(readOnlyWorkflows).not.toContain("git commit");
		expect(readOnlyWorkflows).not.toContain("git push");
		expect(readOnlyWorkflows).not.toContain("NPM_TOKEN");
		expect(readOnlyWorkflows).not.toContain("NODE_AUTH_TOKEN");
		expect(readOnlyWorkflows).not.toContain("GH_TOKEN");
	});
});
