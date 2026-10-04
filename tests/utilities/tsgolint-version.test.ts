import nodePath from "node:path";
import { describe, expect, it } from "vitest";

import {
	checkAssertionSyntaxDiagnosticRange,
	determineTsgoLintVersion,
	getTsgoLintVersionFromSettings,
	isLintSettings,
	resolveTsgoLintVersion,
} from "$oxc-utilities/tsgolint-version";

const FIXTURES = nodePath.join(import.meta.dirname, "..", "fixtures", "tsgolint-version");

function fixtureDirectory(name: string): string {
	return nodePath.join(FIXTURES, name);
}

describe("getTsgolintVersionFromSettings", () => {
	it("should read the plugin tsgolint version from settings", () => {
		expect.assertions(1);

		const version = getTsgoLintVersionFromSettings({ "small-rules": { tsgolintVersion: "7.0.2002" } });

		expect(version).toBe("7.0.2002");
	});

	it("should ignore missing plugin version settings", () => {
		expect.assertions(2);

		expect(getTsgoLintVersionFromSettings({})).toBeUndefined();
		expect(getTsgoLintVersionFromSettings({ "small-rules": {} })).toBeUndefined();
	});
});

describe("isLintSettings", () => {
	it("should reject settings that are not a small-rules version object", () => {
		expect.assertions(3);

		expect(isLintSettings.allows(undefined)).toBe(false);
		expect(isLintSettings.allows({ "small-rules": "7.0.2002" })).toBe(false);
		expect(isLintSettings.allows({ "small-rules": { tsgolintVersion: 7 } })).toBe(false);
	});
});

describe("usesAssertionSyntaxDiagnosticRange", () => {
	it("should treat 7.0.2002 as the first release that reports on assertion syntax", () => {
		expect.assertions(9);

		expect(checkAssertionSyntaxDiagnosticRange(undefined)).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("not-a-version")).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("7.0")).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("7.x.1")).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("6.9.9999")).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("7.0.2001")).toBe(false);
		expect(checkAssertionSyntaxDiagnosticRange("7.0.2002")).toBe(true);
		expect(checkAssertionSyntaxDiagnosticRange("7.1.0")).toBe(true);
		expect(checkAssertionSyntaxDiagnosticRange("8.0.0")).toBe(true);
	});
});

describe("inferTsgolintVersion", () => {
	it("should prefer the installed package, then the workspace catalog, then the manifest", () => {
		expect.assertions(6);

		expect(determineTsgoLintVersion(fixtureDirectory("installed-2002"))).toBe("7.0.2002");
		expect(determineTsgoLintVersion(fixtureDirectory("workspace-2002"))).toBe("7.0.2002");
		expect(determineTsgoLintVersion(fixtureDirectory("quoted-workspace"))).toBe("7.0.2002");
		expect(determineTsgoLintVersion(fixtureDirectory("single-quoted-workspace"))).toBe("7.0.2002");
		expect(determineTsgoLintVersion(fixtureDirectory("v2001"))).toBe("7.0.2001");
		expect(determineTsgoLintVersion(fixtureDirectory("caret"))).toBe("7.0.2002");
	});

	it("should ignore unusable manifests and missing tsgolint metadata", () => {
		expect.assertions(15);

		expect(determineTsgoLintVersion(fixtureDirectory("invalid-json"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("invalid-installed"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("json-array"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("no-tsgolint"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("no-tsgolint"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("empty-workspace"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("non-string-version"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("bad-deps"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("numeric-spec"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("catalog-only"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("extra-deps"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("yaml-only"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("yaml-incomplete"))).toBeUndefined();
		expect(determineTsgoLintVersion(fixtureDirectory("yaml-invalid"))).toBeUndefined();
		expect(determineTsgoLintVersion(nodePath.parse(import.meta.dirname).root)).toBeUndefined();
	});

	it("should reuse the cached version for a project root", () => {
		expect.assertions(1);

		const first = determineTsgoLintVersion(fixtureDirectory("v2002"));
		const second = determineTsgoLintVersion(nodePath.join(fixtureDirectory("v2002"), "src"));

		expect(second).toBe(first);
	});
});

describe("resolveTsgolintVersion", () => {
	it("should let settings override inferred package versions", () => {
		expect.assertions(2);

		expect(
			resolveTsgoLintVersion({ "small-rules": { tsgolintVersion: "7.0.2001" } }, fixtureDirectory("v2002")),
		).toBe("7.0.2001");
		expect(resolveTsgoLintVersion({}, fixtureDirectory("v2002"))).toBe("7.0.2002");
	});
});
