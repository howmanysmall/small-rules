import nodePath from "node:path";
import { describe, expect, it } from "vitest";

import {
	getTsgoLintVersionFromSettings,
	inferTsgoLintVersion,
	isLintSettings,
	resolveTsgoLintVersion,
	usesAssertionSyntaxDiagnosticRange,
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

		expect(usesAssertionSyntaxDiagnosticRange(undefined)).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("not-a-version")).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("7.0")).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("7.x.1")).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("6.9.9999")).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("7.0.2001")).toBe(false);
		expect(usesAssertionSyntaxDiagnosticRange("7.0.2002")).toBe(true);
		expect(usesAssertionSyntaxDiagnosticRange("7.1.0")).toBe(true);
		expect(usesAssertionSyntaxDiagnosticRange("8.0.0")).toBe(true);
	});
});

describe("inferTsgolintVersion", () => {
	it("should prefer the installed package, then the workspace catalog, then the manifest", () => {
		expect.assertions(6);

		expect(inferTsgoLintVersion(fixtureDirectory("installed-2002"))).toBe("7.0.2002");
		expect(inferTsgoLintVersion(fixtureDirectory("workspace-2002"))).toBe("7.0.2002");
		expect(inferTsgoLintVersion(fixtureDirectory("quoted-workspace"))).toBe("7.0.2002");
		expect(inferTsgoLintVersion(fixtureDirectory("single-quoted-workspace"))).toBe("7.0.2002");
		expect(inferTsgoLintVersion(fixtureDirectory("v2001"))).toBe("7.0.2001");
		expect(inferTsgoLintVersion(fixtureDirectory("caret"))).toBe("7.0.2002");
	});

	it("should ignore unusable manifests and missing tsgolint metadata", () => {
		expect.assertions(15);

		expect(inferTsgoLintVersion(fixtureDirectory("invalid-json"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("invalid-installed"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("json-array"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("no-tsgolint"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("no-tsgolint"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("empty-workspace"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("non-string-version"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("bad-deps"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("numeric-spec"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("catalog-only"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("extra-deps"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("yaml-only"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("yaml-incomplete"))).toBeUndefined();
		expect(inferTsgoLintVersion(fixtureDirectory("yaml-invalid"))).toBeUndefined();
		expect(inferTsgoLintVersion(nodePath.parse(import.meta.dirname).root)).toBeUndefined();
	});

	it("should reuse the cached version for a project root", () => {
		expect.assertions(1);

		const first = inferTsgoLintVersion(fixtureDirectory("v2002"));
		const second = inferTsgoLintVersion(nodePath.join(fixtureDirectory("v2002"), "src"));

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
