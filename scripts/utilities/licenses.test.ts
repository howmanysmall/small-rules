import { describe, it } from "vitest";

import { evaluateLicenses, parseLicenseReport } from "$script-utilities/licenses";

import type { LicensePolicy } from "$script-utilities/licenses";

const policy: LicensePolicy = {
	exceptions: [
		{
			license: "CC BY-SA 4.0",
			package: "@cspell/dict-en-common-misspellings",
			reason: "Not a valid SPDX expression.",
		},
	],
	tiers: [
		{
			name: "shipped",
			allowed: ["MIT", "Apache-2.0"],
			scoped: [{ license: "OFL-1.1", packages: "@fontsource*" }],
		},
		{ name: "workspace", allowed: ["MIT", "Apache-2.0", "MPL-2.0"], scoped: [] },
	],
};

const withoutExceptions: LicensePolicy = { ...policy, exceptions: [] };

describe("evaluateLicenses", () => {
	it("passes an OR expression when one side is allowed", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ shipped: [{ name: "dual", license: "(GPL-3.0-only OR MIT)", version: "1.0.0" }] },
			withoutExceptions,
		);

		expect(result).toStrictEqual({ checked: 1, failures: [], staleExceptions: [] });
	});

	it("fails an AND expression when one side is disallowed", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ shipped: [{ name: "both", license: "MIT AND GPL-3.0-only", version: "2.0.0" }] },
			withoutExceptions,
		);

		expect(result.failures).toStrictEqual([
			{
				name: "both",
				license: "MIT AND GPL-3.0-only",
				reason: "license is not allowed",
				tier: "shipped",
				version: "2.0.0",
			},
		]);
	});

	it("judges a WITH expression by its base license", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ shipped: [{ name: "llvm", license: "Apache-2.0 WITH LLVM-exception", version: "1.0.0" }] },
			withoutExceptions,
		);

		expect(result.failures).toStrictEqual([]);
	});

	it("allows a scoped license only for the packages it names", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{
				shipped: [
					{ name: "@fontsource/ibm-plex-mono", license: "OFL-1.1", version: "5.3.0" },
					{ name: "some-font", license: "OFL-1.1", version: "1.0.0" },
				],
			},
			withoutExceptions,
		);

		expect(result.failures.map(({ name }) => name)).toStrictEqual(["some-font"]);
	});

	it("fails an invalid SPDX expression without an exception", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ workspace: [{ name: "not-spdx", license: "CC BY-SA 4.0", version: "1.0.0" }] },
			withoutExceptions,
		);

		expect(result.failures).toStrictEqual([
			{
				name: "not-spdx",
				license: "CC BY-SA 4.0",
				reason: "license is not a valid SPDX expression",
				tier: "workspace",
				version: "1.0.0",
			},
		]);
	});

	it("fails a missing license without an exception", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ workspace: [{ name: "unlicensed", license: "", version: "1.0.0" }] },
			withoutExceptions,
		);

		expect(result.failures.map(({ reason }) => reason)).toStrictEqual(["license is missing"]);
	});

	it("passes an invalid SPDX expression that has an exception", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{
				workspace: [
					{ name: "@cspell/dict-en-common-misspellings", license: "CC BY-SA 4.0", version: "2.1.12" },
				],
			},
			policy,
		);

		expect(result).toStrictEqual({ checked: 1, failures: [], staleExceptions: [] });
	});

	it("does not let an exception cover a different license string", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses(
			{ workspace: [{ name: "@cspell/dict-en-common-misspellings", license: "GPL-3.0-only", version: "3.0.0" }] },
			policy,
		);

		expect(result.failures.map(({ name }) => name)).toStrictEqual(["@cspell/dict-en-common-misspellings"]);
	});

	it("judges a package in both tiers by the stricter tier", ({ expect }) => {
		expect.assertions(1);

		const lightningcss = { name: "lightningcss", license: "MPL-2.0", version: "1.33.0" };
		const result = evaluateLicenses({ shipped: [lightningcss], workspace: [lightningcss] }, withoutExceptions);

		expect(result).toStrictEqual({
			checked: 1,
			failures: [{ ...lightningcss, reason: "license is not allowed", tier: "shipped" }],
			staleExceptions: [],
		});
	});

	it("reports an exception that no installed package needs as stale", ({ expect }) => {
		expect.assertions(1);

		const result = evaluateLicenses({ workspace: [{ name: "plain", license: "MIT", version: "1.0.0" }] }, policy);

		expect(result.staleExceptions).toStrictEqual(policy.exceptions);
	});
});

describe("parseLicenseReport", () => {
	it("lists every installed version of each package", ({ expect }) => {
		expect.assertions(1);

		const stdout = JSON.stringify({
			MIT: [{ name: "a", license: "MIT", paths: ["/store/a"], versions: ["1.0.0", "2.0.0"] }],
		});

		expect(parseLicenseReport(stdout)).toStrictEqual([
			{ name: "a", license: "MIT", version: "1.0.0" },
			{ name: "a", license: "MIT", version: "2.0.0" },
		]);
	});

	it("rejects output that is not a pnpm license report", ({ expect }) => {
		expect.assertions(1);

		expect(() => parseLicenseReport(JSON.stringify({ MIT: [{ name: "a" }] }))).toThrow(/pnpm licenses list/u);
	});
});
