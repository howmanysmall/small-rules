import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	isMaybeBoolean,
	isMaybeReadonlyArrayOfStrings,
	isMaybeReadonlyDictionaryOfStrings,
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
type Steps = typeof isSteps.infer;

const isCiJob = type({
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
	"steps?": isSteps.or(isUndefined),
	"uses?": isMaybeString,
});

const isCi = type({
	"jobs?": type({ "[string]": isCiJob }).or(isUndefined),
	"on?": type({
		"pull_request?": type({ "paths?": isMaybeReadonlyArrayOfStrings }).or(isUndefined),
		"push?": type({ "paths?": isMaybeReadonlyArrayOfStrings }).or(isUndefined),
	}).or(isUndefined),
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
});

const isChecksJob = type({
	"name?": isMaybeString,
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
	"steps?": isSteps.or(isUndefined),
});

const isChecks = type({
	"jobs?": type({ "[string]": isChecksJob }).or(isUndefined),
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
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
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
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
	"permissions?": isMaybeReadonlyDictionaryOfStrings,
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
	readonly call: unknown;
	readonly pullRequest: unknown;
	readonly push: unknown;
}

interface CheckoutFinding {
	readonly job: string;
	readonly step: string;
	readonly workflow: string;
}

interface CheckoutAudit {
	readonly leaking: ReadonlyArray<CheckoutFinding>;
	readonly total: number;
}

interface WriteViolation {
	readonly job: string;
	readonly scopes: ReadonlyArray<string>;
	readonly workflow: string;
}

function loadDocs(): Docs {
	if (!existsSync(DOCS_WORKFLOW_PATH)) {
		throw new TypeError(`Docs workflow not found at ${DOCS_WORKFLOW_PATH}`);
	}
	const docsRaw = readFileSync(DOCS_WORKFLOW_PATH, "utf8");
	return isDocs.assert(parseYAML(docsRaw));
}

function normalizeLocalRef(ref: string): string {
	return ref.replace(/^\$\//u, "").replace(/^\.\//u, "");
}

function effectivePermissions(top?: Permissions, job?: Permissions): Permissions {
	return { ...top, ...job };
}

function writeScopes(permissions: Permissions): ReadonlyArray<string> {
	return Object.keys(permissions).filter((scope) => permissions[scope] === "write" || permissions[scope] === "admin");
}

function getCiPushPaths(): ReadonlyArray<string> {
	return ci.on?.push?.paths ?? [];
}

function getCiPullRequestPaths(): ReadonlyArray<string> {
	return ci.on?.pull_request?.paths ?? [];
}

function getReleaseTags(): ReadonlyArray<string> {
	return release.on?.push?.tags ?? [];
}

function getDeployNeeds(): ReadonlyArray<string> {
	const needs = release.jobs?.["deploy-documentation"]?.needs;
	if (needs === undefined) return [];
	return Predicate.isString(needs) ? [needs] : needs;
}

function getDeployCondition(): string {
	return release.jobs?.["deploy-documentation"]?.if ?? "";
}

function getDeployUses(): string {
	return normalizeLocalRef(release.jobs?.["deploy-documentation"]?.uses ?? "");
}

function getCiJobsCallingDocs(): ReadonlyArray<string> {
	const target = normalizeLocalRef(DOCS_WORKFLOW_PATH);
	return Object.keys(ci.jobs ?? {}).filter((name) => normalizeLocalRef(ci.jobs?.[name]?.uses ?? "") === target);
}

function getDocsTriggers(): DocsTriggers {
	const docs = loadDocs();
	return { call: docs.on?.workflow_call, pullRequest: docs.on?.pull_request, push: docs.on?.push };
}

function getDeployEffectivePermissions(): Permissions {
	const docs = loadDocs();
	return effectivePermissions(docs.permissions, docs.jobs?.deploy?.permissions);
}

interface AuditCandidate extends CheckoutFinding {
	readonly persist?: boolean | undefined;
}

function getLeaking(candidates: ReadonlyArray<AuditCandidate>): ReadonlyArray<CheckoutFinding> {
	const leaking = new Array<CheckoutFinding>();
	let size = 0;
	for (const { persist, ...candidate } of candidates) if (persist !== false) leaking[size++] = candidate;
	return leaking;
}

type Collect = (workflow: string, job: string, steps?: Steps) => void;

function collectCiJobs(collect: Collect): void {
	if (ci.jobs === undefined) return;
	for (const [job, definition] of Object.entries(ci.jobs)) collect("ci", job, definition.steps);
}
function collectChecksJobs(collect: Collect): void {
	if (checks.jobs === undefined) return;
	for (const [job, definition] of Object.entries(checks.jobs)) collect("checks", job, definition.steps);
}
function collectDocsJobs(collect: Collect): void {
	const docs = loadDocs();
	if (docs.jobs === undefined) return;
	for (const [job, definition] of Object.entries(docs.jobs)) {
		if (definition === undefined) continue;
		collect("docs", job, definition.steps);
	}
}

function checkoutAudit(): CheckoutAudit {
	const candidates = new Array<AuditCandidate>();
	let total = 0;

	const collect: Collect = function collect(workflow: string, job: string, steps?: Steps): void {
		if (steps === undefined) return;
		for (const step of steps) {
			if (step.uses?.startsWith("actions/checkout") !== true) continue;
			candidates[total++] = {
				job,
				persist: step.with?.["persist-credentials"],
				step: step.name ?? "(unnamed step)",
				workflow,
			};
		}
	};

	collectCiJobs(collect);
	collectChecksJobs(collect);
	collectDocsJobs(collect);

	const publish = release.jobs?.publish;
	if (publish !== undefined) collect("release", "publish", publish.steps);

	return {
		leaking: getLeaking(candidates),
		total,
	};
}

// Only the Pages deploy job may hold write scopes.
const ALLOWED_FOR_DEPLOY = new Set(["id-token", "pages"]);

function writeViolations(): ReadonlyArray<WriteViolation> {
	const violations = new Array<WriteViolation>();

	function collect(workflow: string, job: string, effective: Permissions): void {
		const allowed = workflow === "docs" && job === "deploy" ? ALLOWED_FOR_DEPLOY : new Set<string>();
		const scopes = writeScopes(effective).filter((scope) => !allowed.has(scope));
		if (scopes.length > 0) violations.push({ job, scopes, workflow });
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
		if (definition === undefined) continue;
		collect("docs", job, effectivePermissions(docs.permissions, definition.permissions));
	}
	return violations;
}

describe("documentation validation workflow", () => {
	// Bug: a docs-only change merges without running docs checks.
	// Oracle: the documentation/ directory exists here,
	// so CI must select it.
	it("triggers validation for documentation changes", () => {
		expect.assertions(2);

		expect(getCiPushPaths()).toContain("documentation/**");
		expect(getCiPullRequestPaths()).toContain("documentation/**");
	});
});

describe("documentation deployment workflow", () => {
	// Bug: the public site updates from an ordinary push
	// or before the package publishes.
	// Oracle: releases ship as v*.*.* tags; the deploy job
	// must wait for publish and require a tag ref.
	it("releases docs only for version tags, after publish succeeds", () => {
		expect.assertions(4);

		expect(getReleaseTags()).toContain("v*.*.*");
		expect(getDeployCondition()).toContain("refs/tags/");
		expect(getDeployNeeds()).toContain("publish");
		expect(getDeployUses()).toBe(normalizeLocalRef(DOCS_WORKFLOW_PATH));
	});

	// Bug: an ordinary CI run redeploys the public site.
	// The missing call is its only trace.
	it("is never called by ordinary CI", () => {
		expect.assertions(1);

		expect(getCiJobsCallingDocs()).toStrictEqual([]);
	});

	// Bug: docs deploy from a pull request push instead of through the release.
	// Oracle: workflow_call is the release handoff; push and
	// pull_request are untrusted for a deploy target.
	it("is callable for releases, not for pull requests", () => {
		expect.assertions(3);

		const triggers = getDocsTriggers();

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

		expect(getDeployEffectivePermissions()).toStrictEqual({
			contents: "read",
			"id-token": "write",
			pages: "write",
		});
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
