import { describe, expect, it, vi } from "vitest";

import { createRuleNewness, getRuleNewnessWith, parseAddCommits, resolveNewness } from "$data/rule-newness";

import type { GitRunner } from "$data/rule-newness";

const ADD_LOG_FIXTURE = [
	"__COMMIT__aaaa1111",
	"src/rules/no-print.ts",
	"src/rules/no-chain-state-updates.ts",
	"",
	"__COMMIT__bbbb2222",
	"src/rules/no-chain-state-updates.ts",
	"src/rules/no-derived-state.ts",
	"src/rules/subdir/nested/not-a-rule.ts",
	"",
	"__COMMIT__cccc3333",
	"src/rules/no-initialize-state.ts",
	"",
].join("\n");

const RESPONSES = new Map([
	["log --reverse --diff-filter=A --format=__COMMIT__%H --name-only -- src/rules/", ADD_LOG_FIXTURE],
	["tag --contains aaaa1111 --list v* --sort=version:refname", "v1.1.0\n"],
	["tag --contains bbbb2222 --list v* --sort=version:refname", "v2.14.0\n"],
	["tag --contains cccc3333 --list v* --sort=version:refname", ""],
	["tag --list v* --sort=-version:refname", "v2.14.0\n"],
]);

function createFakeRunner(responses: ReadonlyMap<string, string>): GitRunner {
	return (parameters) => responses.get(parameters.join(" ")) ?? "";
}

function createRecordingRunner(calls: Array<ReadonlyArray<string>>): GitRunner {
	return (parameters) => {
		calls.push(parameters);
		return RESPONSES.get(parameters.join(" ")) ?? "";
	};
}
function createManifestFilteredRunner(): GitRunner {
	return (parameters) => {
		if (parameters[0] === "tag" && parameters[1] === "--list") return "v2.14.0\n";
		if (parameters[0] === "log") return "__COMMIT__dddd4444\nsrc/rules/not-a-real-rule.ts\n";
		return "";
	};
}
describe("parseAddCommits", () => {
	it("maps each rule to its first add commit", () => {
		expect.assertions(4);
		const adds = parseAddCommits(ADD_LOG_FIXTURE);

		expect(adds.get("no-chain-state-updates")).toBe("aaaa1111");
		expect(adds.get("no-print")).toBe("aaaa1111");
		expect(adds.get("no-derived-state")).toBe("bbbb2222");
		expect(adds.get("no-initialize-state")).toBe("cccc3333");
	});

	it("keeps the first occurrence when a rule appears in multiple commits", () => {
		expect.assertions(1);
		const adds = parseAddCommits(ADD_LOG_FIXTURE);

		expect(adds.get("no-chain-state-updates")).toBe("aaaa1111");
	});

	it("ignores deeply nested paths and non-`.ts` files", () => {
		expect.assertions(2);
		const adds = parseAddCommits(ADD_LOG_FIXTURE);

		expect(adds.has("subdir/nested/not-a-rule")).toBe(false);
		expect(adds.has("not-a-rule")).toBe(false);
	});
});

describe("resolveNewness", () => {
	it("marks rules new only when added in the latest release or unreleased", () => {
		expect.assertions(3);
		const newness = resolveNewness(
			new Map([
				["latest", "v2.14.0"],
				["older", "v1.1.0"],
				["unreleased", undefined],
			]),
			"v2.14.0",
		);

		expect(newness.get("unreleased")).toStrictEqual({ addedIn: undefined, isNew: true });
		expect(newness.get("latest")).toStrictEqual({ addedIn: "v2.14.0", isNew: true });
		expect(newness.get("older")).toStrictEqual({ addedIn: "v1.1.0", isNew: false });
	});
});

describe("createRuleNewness", () => {
	it("classifies rules against the latest release", () => {
		expect.assertions(3);
		const newness = createRuleNewness(createFakeRunner(RESPONSES));

		expect(newness.get("no-print")).toStrictEqual({ addedIn: "v1.1.0", isNew: false });
		expect(newness.get("no-derived-state")).toStrictEqual({ addedIn: "v2.14.0", isNew: true });
		expect(newness.get("no-initialize-state")).toStrictEqual({ addedIn: undefined, isNew: true });
	});

	it("runs one tag lookup per distinct add commit", () => {
		expect.assertions(1);
		const calls = new Array<ReadonlyArray<string>>();
		const runner = createRecordingRunner(calls);

		createRuleNewness(runner);

		// oxlint-disable-next-line vitest/no-conditional-in-test -- it is FINE.
		const containsCalls = calls.filter((call) => call[0] === "tag" && call[1] === "--contains");
		expect(containsCalls).toHaveLength(3);
	});

	it("returns an empty map when no release tags exist", () => {
		expect.assertions(1);
		expect(createRuleNewness(() => "")).toStrictEqual(new Map());
	});

	it("drops rules absent from the manifest", () => {
		expect.assertions(1);
		const newness = createRuleNewness(createManifestFilteredRunner());

		expect(newness.has("not-a-real-rule")).toBe(false);
	});
});

describe("getRuleNewnessWith", () => {
	it("returns an empty map and warns when git is unavailable", () => {
		expect.assertions(2);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {
			// purposefully empty
		});

		const newness = getRuleNewnessWith(() => {
			throw new Error("spawn git ENOENT");
		});

		expect(newness.size).toBe(0);
		expect(warn).toHaveBeenCalledWith("[rule-newness] git history unavailable; New badges disabled");
	});
});
