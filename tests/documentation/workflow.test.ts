import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	isMaybeBoolean,
	isMaybeReadonlyArrayOfStrings,
	isMaybeString,
	isReadonlyDictionaryOfStrings,
	isString,
	isUndefined,
	isUnknown,
} from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { parseYAML } from "confbox";
import { Predicate } from "effect";

const isSteps = type({
	"name?": isMaybeString,
	"run?": isMaybeString,
	"uses?": isMaybeString,
	"with?": type({
		"persist-credentials?": isMaybeBoolean,
	}).or(isUndefined),
	"working-directory?": isMaybeString,
}).array();

const isCiJob = type({
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
	"steps?": isSteps.or(isUndefined),
	"uses?": isMaybeString,
});

const isCi = type({
	"jobs?": type({ "[string]": isCiJob }).or(isUndefined),
	"on?": type({
		"pull_request?": type({ "paths?": isMaybeReadonlyArrayOfStrings }).or(isUndefined),
		"push?": type({ "paths?": isMaybeReadonlyArrayOfStrings }).or(isUndefined),
	}).or(isUndefined),
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
});

const isChecksJob = type({
	"name?": isMaybeString,
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
	"steps?": isSteps.or(isUndefined),
});

const isChecks = type({
	"jobs?": type({ "[string]": isChecksJob }).or(isUndefined),
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
});

const isReleaseStepJob = type({
	"steps?": isSteps.or(isUndefined),
});

const isDeployDocumentation = type({
	"if?": isMaybeString,
	"needs?": isMaybeReadonlyArrayOfStrings.or(isString),
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
	"uses?": isMaybeString,
});

const isRelease = type({
	"jobs?": type({
		"deploy-documentation?": isDeployDocumentation.or(isUndefined),
		"publish?": isReleaseStepJob.or(isUndefined),
	}).or(isUndefined),
	"on?": type({
		"push?": type({ "tags?": isMaybeReadonlyArrayOfStrings }).or(isUndefined),
	}).or(isUndefined),
});

const isDeployJob = type({
	"environment?": isMaybeString,
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
	"steps?": isSteps.or(isUndefined),
});

const isDocs = type({
	"jobs?": type({
		"deploy?": isDeployJob.or(isUndefined),
	}).or(isUndefined),
	"on?": type({
		"pull_request?": isUnknown,
		"push?": isUnknown,
		"workflow_call?": isUnknown,
	}).or(isUndefined),
	"permissions?": isReadonlyDictionaryOfStrings.or(isUndefined),
});

const DOCS_WORKFLOW_PATH = ".github/workflows/docs.yaml";

const ciRaw = readFileSync(".github/workflows/ci.yaml", "utf8");
const checksRaw = readFileSync(".github/workflows/checks.yaml", "utf8");
const releaseRaw = readFileSync(".github/workflows/release.yaml", "utf8");

const ci = isCi.assert(parseYAML(ciRaw));
const checks = isChecks.assert(parseYAML(checksRaw));
const release = isRelease.assert(parseYAML(releaseRaw));

type Docs = typeof isDocs.infer;
type Permissions = typeof isReadonlyDictionaryOfStrings.infer;

interface DocsTriggers {
	call: unknown;
	pullRequest: unknown;
	push: unknown;
}

interface CheckoutFinding {
	job: string;
	step: string;
	workflow: string;
}

interface CheckoutAudit {
	leaking: Array<CheckoutFinding>;
	total: number;
}

interface WriteViolation {
	job: string;
	scopes: Array<string>;
	workflow: string;
}

function loadDocs(): Docs {
	if (!existsSync(DOCS_WORKFLOW_PATH)) {
		throw new TypeError(`Docs workflow not found at ${DOCS_WORKFLOW_PATH}`);
	}
	const docsRaw = readFileSync(DOCS_WORKFLOW_PATH, "utf8");
	return isDocs.assert(parseYAML(docsRaw));
}

/**
 * Local workflow refs have two spellings for one file:
 * "./" and "$/". Compare targets, not spellings.
 *
 * @param ref - The raw `uses` value from a workflow job.
 * @returns The ref without its local prefix, for comparison.
 */
function normalizeLocalRef(ref: string): string {
	return ref.replace(/^\$\//u, "").replace(/^\.\//u, "");
}

function effectivePermissions(top: Permissions | undefined, job: Permissions | undefined): Permissions {
	return { ...top, ...job };
}

function writeScopes(permissions: Permissions): Array<string> {
	return Object.keys(permissions).filter((scope) => permissions[scope] === "write" || permissions[scope] === "admin");
}

function ciPushPaths(): ReadonlyArray<string> {
	return ci.on?.push?.paths ?? [];
}

function ciPullRequestPaths(): ReadonlyArray<string> {
	return ci.on?.pull_request?.paths ?? [];
}

function releaseTags(): ReadonlyArray<string> {
	return release.on?.push?.tags ?? [];
}

function deployNeeds(): ReadonlyArray<string> {
	const needs = release.jobs?.["deploy-documentation"]?.needs;
	if (needs === undefined) return [];
	return Predicate.isString(needs) ? [needs] : needs;
}

function deployCondition(): string {
	return release.jobs?.["deploy-documentation"]?.if ?? "";
}

function deployUses(): string {
	return normalizeLocalRef(release.jobs?.["deploy-documentation"]?.uses ?? "");
}

function ciJobsCallingDocs(): Array<string> {
	const target = normalizeLocalRef(DOCS_WORKFLOW_PATH);
	return Object.keys(ci.jobs ?? {}).filter((name) => normalizeLocalRef(ci.jobs?.[name]?.uses ?? "") === target);
}

function docsTriggers(): DocsTriggers {
	const docs = loadDocs();
	return { call: docs.on?.workflow_call, pullRequest: docs.on?.pull_request, push: docs.on?.push };
}

function deployEffectivePermissions(): Permissions {
	const docs = loadDocs();
	return effectivePermissions(docs.permissions, docs.jobs?.deploy?.permissions);
}

function checkoutAudit(): CheckoutAudit {
	const candidates: Array<CheckoutFinding & { persist: boolean | undefined }> = [];
	function collect(workflow: string, job: string, steps: typeof isSteps.infer | undefined): void {
		const input = steps ?? [];
		for (const step of input) {
			const uses = step.uses ?? "";
			if (uses.startsWith("actions/checkout")) {
				candidates.push({
					job,
					persist: step.with?.["persist-credentials"],
					step: step.name ?? "(unnamed step)",
					workflow,
				});
			}
		}
	}
	const ciJobs = Object.entries(ci.jobs ?? {});
	for (const [job, definition] of ciJobs) {
		collect("ci", job, definition.steps);
	}
	const checksJobs = Object.entries(checks.jobs ?? {});
	for (const [job, definition] of checksJobs) {
		collect("checks", job, definition.steps);
	}
	const docs = loadDocs();
	const docsJobs = Object.entries(docs.jobs ?? {});
	for (const [job, definition] of docsJobs) {
		if (definition !== undefined) {
			collect("docs", job, definition.steps);
		}
	}
	const publish = release.jobs?.publish;
	if (publish !== undefined) {
		collect("release", "publish", publish.steps);
	}
	return {
		leaking: candidates
			.filter((candidate) => candidate.persist !== false)
			.map(({ job, step, workflow }) => ({ job, step, workflow })),
		total: candidates.length,
	};
}

function writeViolations(): Array<WriteViolation> {
	// Only the Pages deploy job may hold write scopes.
	const allowedForDeploy = new Set(["id-token", "pages"]);
	const violations: Array<WriteViolation> = [];
	function collect(workflow: string, job: string, effective: Permissions): void {
		const allowed = workflow === "docs" && job === "deploy" ? allowedForDeploy : new Set<string>();
		const scopes = writeScopes(effective).filter((scope) => !allowed.has(scope));
		if (scopes.length > 0) {
			violations.push({ job, scopes, workflow });
		}
	}
	const ciJobs = Object.entries(ci.jobs ?? {});
	for (const [job, definition] of ciJobs) {
		collect("ci", job, effectivePermissions(ci.permissions, definition.permissions));
	}
	const checksJobs = Object.entries(checks.jobs ?? {});
	for (const [job, definition] of checksJobs) {
		collect("checks", job, effectivePermissions(checks.permissions, definition.permissions));
	}
	const docs = loadDocs();
	const docsJobs = Object.entries(docs.jobs ?? {});
	for (const [job, definition] of docsJobs) {
		if (definition !== undefined) {
			collect("docs", job, effectivePermissions(docs.permissions, definition.permissions));
		}
	}
	return violations;
}

describe("documentation validation workflow", () => {
	// Bug: a docs-only change merges without running docs checks.
	// Oracle: the documentation/ directory exists here,
	// so CI must select it.
	it("triggers validation for documentation changes", () => {
		expect.assertions(2);
		expect(ciPushPaths()).toContain("documentation/**");
		expect(ciPullRequestPaths()).toContain("documentation/**");
	});
});

describe("documentation deployment workflow", () => {
	// Bug: the public site updates from an ordinary push
	// or before the package publishes.
	// Oracle: releases ship as v*.*.* tags; the deploy job
	// must wait for publish and require a tag ref.
	it("releases docs only for version tags, after publish succeeds", () => {
		expect.assertions(4);
		expect(releaseTags()).toContain("v*.*.*");
		expect(deployCondition()).toContain("refs/tags/");
		expect(deployNeeds()).toContain("publish");
		expect(deployUses()).toBe(normalizeLocalRef(DOCS_WORKFLOW_PATH));
	});

	// Bug: an ordinary CI run redeploys the public site.
	// The missing call is its only trace.
	it("is never called by ordinary CI", () => {
		expect.assertions(1);
		expect(ciJobsCallingDocs()).toStrictEqual([]);
	});

	// Bug: docs deploy from a pull request push instead of through the release.
	// Oracle: workflow_call is the release handoff; push and
	// pull_request are untrusted for a deploy target.
	it("is callable for releases, not for pull requests", () => {
		expect.assertions(3);
		const triggers = docsTriggers();
		expect(triggers.call).toBeDefined();
		expect(triggers.push).toBeUndefined();
		expect(triggers.pullRequest).toBeUndefined();
	});

	// Bug: the deployment gains unneeded write access,
	// or loses access it needs.
	// Oracle: Pages deployment needs exactly contents read,
	// plus pages write and id-token write.
	it("deploys to GitHub Pages with only the permissions Pages requires", () => {
		expect.assertions(1);
		expect(deployEffectivePermissions()).toStrictEqual({ contents: "read", "id-token": "write", pages: "write" });
	});

	// Bug: a checkout step persists credentials into every following step.
	// Oracle: hygiene requires persist-credentials: false
	// on every checkout.
	it("never persists checkout credentials", () => {
		expect.assertions(2);
		const audit = checkoutAudit();
		expect(audit.leaking).toStrictEqual([]);
		expect(audit.total).toBeGreaterThan(0);
	});

	// Bug: a validation workflow gains write credentials
	// and becomes a confused deputy.
	// Oracle: least privilege; only the Pages deploy job may hold write scopes.
	it("grants validation workflows no write access", () => {
		expect.assertions(1);
		expect(writeViolations()).toStrictEqual([]);
	});
});
