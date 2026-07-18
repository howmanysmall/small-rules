import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HK_CONFIG = readFileSync("hk.pkl", "utf8");
const PRE_COMMIT_CONFIG = HK_CONFIG.slice(HK_CONFIG.indexOf('["pre-commit"]'), HK_CONFIG.indexOf('["commit-msg"]'));

describe("pre-commit hook", () => {
	it("uses GitHub CLI authentication when pinact verifies action pins", () => {
		expect.assertions(2);

		expect(PRE_COMMIT_CONFIG).toMatch(
			/PINACT_GITHUB_TOKEN=\\"\$\(gh auth token\)\\" pinact run --verify \{\{files\}\}/u,
		);
		expect(PRE_COMMIT_CONFIG).not.toContain("(Builtins.pinact)");
	});
});
