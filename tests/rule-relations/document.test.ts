import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { parseGeneratedRelations } from "$data/rule-relations";
import {
	createCacheKey,
	createJudgmentCache,
	createReasonCache,
	stableStringify,
} from "$script-utilities/rule-relations/cache";
import { createReasonMessages, validateReason } from "$script-utilities/rule-relations/reasons";
import { createRelationDocument, renderRelationDocument } from "$script-utilities/rule-relations/render";
import { checkRelationsDocument } from "$script-utilities/rule-relations/validate";

import { createJudgments } from "./fixtures";

import type { RuleRelation } from "$data/rule-relations";
import type { RuleCard } from "$script-utilities/rule-relations/types";

const cacheKeyPattern = /^[0-9a-f]{64}$/u;

function recordFromEntries<TValue>(entries: ReadonlyArray<readonly [string, TValue]>): Record<string, TValue> {
	return Object.fromEntries(entries);
}

const cardFixtures = {
	"no-print": {
		name: "no-print",
		category: "roblox",
		description: "Use Log instead of print().",
		examples: [],
		messages: ["Use Log instead of print()."],
		options: "{}",
		rationale: "Raw logging has no levels.",
		sharedUtilities: ["createBannedGlobalCallRule"],
		title: "No Print",
	},
	"no-warn": {
		name: "no-warn",
		category: "roblox",
		description: "Use Log instead of warn().",
		examples: [],
		messages: ["Use Log instead of warn()."],
		options: "{}",
		rationale: "Raw logging has no levels.",
		sharedUtilities: ["createBannedGlobalCallRule"],
		title: "No Warn",
	},
} satisfies Record<string, RuleCard>;

const supersedesDraft = {
	from: "directive-no-use",
	kind: "supersedes",
	reason: "Banning block directives removes the surface directive-disable-enable-pair refines.",
	to: "directive-disable-enable-pair",
} satisfies RuleRelation;

const relatedDraft = {
	from: "no-print",
	kind: "related",
	reason: "Shared factory and shared destination.",
	to: "no-warn",
} satisfies RuleRelation;

const judgmentsFixture = createJudgments();

const evidenceFixture = {
	judgments: judgmentsFixture,
	left: "no-print",
	right: "no-warn",
	strength: 0.9,
} satisfies NonNullable<Parameters<typeof createRelationDocument>[0]["edges"][number]["evidence"]>;

const firstEdgeFixture = {
	evidence: evidenceFixture,
	from: "no-print",
	kind: "related",
	reason: "Shared factory and shared destination.",
	to: "no-warn",
} satisfies Parameters<typeof createRelationDocument>[0]["edges"][number];

const secondEdgeFixture = {
	from: "no-error",
	kind: "related",
	reason: "Failure flow.",
	to: "no-print",
} satisfies Parameters<typeof createRelationDocument>[0]["edges"][number];

const modelsFixture = { decisions: "~typesafe/jev-latest", reasons: "anthropic/claude-sonnet-5" };

describe("stableStringify", () => {
	it("is independent of object key order", () => {
		expect.assertions(2);

		const reorderedNested = recordFromEntries([
			["y", 2],
			["x", 1],
		]);
		const reorderedObject = recordFromEntries<number | Record<string, number>>([
			["nested", reorderedNested],
			["a", 1],
		]);
		const reorderedPair = recordFromEntries([
			["b", 2],
			["a", 1],
		]);

		expect(stableStringify({ a: 1, nested: { x: 1, y: 2 } })).toBe(stableStringify(reorderedObject));
		expect(createCacheKey({ a: 1, b: 2 })).toBe(createCacheKey(reorderedPair));
	});

	it("distinguishes different values", () => {
		expect.assertions(2);

		expect(createCacheKey({ a: 1 })).not.toBe(createCacheKey({ a: 2 }));
		expect(createCacheKey({ a: 1 })).toMatch(cacheKeyPattern);
	});
});

describe("file caches", () => {
	it("round-trips judgment and reason values", () => {
		expect.assertions(4);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "rule-relations-cache-"));
		onTestFinished(() => {
			rmSync(directory, { force: true, recursive: true });
		});
		const judgmentCache = createJudgmentCache(nodePath.join(directory, "judgments"));
		const reasonCache = createReasonCache(nodePath.join(directory, "reasons"));

		judgmentCache.set("pair", judgmentsFixture);
		reasonCache.set("pair", "One sentence.");

		expect(judgmentCache.get("pair")).toStrictEqual(judgmentsFixture);
		expect(judgmentCache.get("missing")).toBeUndefined();
		expect(reasonCache.get("pair")).toBe("One sentence.");
		expect(reasonCache.get("missing")).toBeUndefined();
	});

	it("treats corrupt cache files as misses", () => {
		expect.assertions(2);

		const directory = mkdtempSync(nodePath.join(tmpdir(), "rule-relations-cache-"));
		onTestFinished(() => {
			rmSync(directory, { force: true, recursive: true });
		});
		writeFileSync(nodePath.join(directory, "broken.json"), "not json", "utf8");
		writeFileSync(nodePath.join(directory, "wrong.json"), '{"unexpected": true}', "utf8");

		expect(createJudgmentCache(directory).get("broken")).toBeUndefined();
		expect(createJudgmentCache(directory).get("wrong")).toBeUndefined();
	});
});

describe("createReasonMessages", () => {
	it("asks for one sentence grounded in both rule cards", () => {
		expect.assertions(4);

		const messages = createReasonMessages({
			left: cardFixtures["no-print"],
			relation: relatedDraft,
			right: cardFixtures["no-warn"],
		});

		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe("user");
		expect(messages[0]?.content).toContain("no-print");
		expect(messages[0]?.content).toContain("no-warn");
	});
});

describe("validateReason", () => {
	const allNames = ["directive-disable-enable-pair", "directive-no-use", "no-error", "no-print", "no-warn"];

	it("accepts a grounded one-liner", () => {
		expect.assertions(1);

		expect(
			validateReason({
				allNames,
				reason: "Both rules push raw output toward structured Log calls.",
				relation: relatedDraft,
			}),
		).toStrictEqual([]);
	});

	it("rejects third-rule mentions, empty text, newlines, and overlong text", () => {
		expect.assertions(4);

		expect(validateReason({ allNames, reason: "See no-error for failures.", relation: relatedDraft })).toHaveLength(
			1,
		);
		expect(validateReason({ allNames, reason: "  ", relation: relatedDraft })).toHaveLength(1);
		expect(validateReason({ allNames, reason: "One\ntwo.", relation: relatedDraft })).toHaveLength(1);
		expect(validateReason({ allNames, reason: "x".repeat(161), relation: relatedDraft })).toHaveLength(1);
	});

	it("allows naming both endpoints of a directed relation", () => {
		expect.assertions(1);

		expect(
			validateReason({
				allNames,
				reason: "Banning block directives removes the surface directive-disable-enable-pair refines.",
				relation: supersedesDraft,
			}),
		).toStrictEqual([]);
	});
});

describe("createRelationDocument", () => {
	it("sorts edges deterministically regardless of input order", () => {
		expect.assertions(1);

		expect(
			createRelationDocument({ edges: [firstEdgeFixture, secondEdgeFixture], models: modelsFixture }),
		).toStrictEqual(
			createRelationDocument({ edges: [secondEdgeFixture, firstEdgeFixture], models: modelsFixture }),
		);
	});

	it("emits edges the documentation parser accepts", () => {
		expect.assertions(2);

		const document = createRelationDocument({ edges: [firstEdgeFixture], models: modelsFixture });

		expect(document.generator).toBe("scripts/regenerate-relations.ts");
		expect(parseGeneratedRelations(document.edges)).toHaveLength(1);
	});
});

describe("renderRelationDocument", () => {
	it("serializes the document with a trailing newline", () => {
		expect.assertions(2);

		const output = renderRelationDocument({
			edges: [firstEdgeFixture],
			models: modelsFixture,
		});

		expect(output.endsWith("\n")).toBe(true);
		expect(output.startsWith('{\n\t"edges"')).toBe(true);
	});
});

describe("checkRelationsDocument", () => {
	it("accepts a well-formed document", () => {
		expect.assertions(1);

		expect(
			checkRelationsDocument({
				denylist: [],
				edges: [{ from: "no-print", kind: "related", reason: "Shared factory.", to: "no-warn" }],
				maxRelationsPerRule: 8,
				pins: [],
			}),
		).toStrictEqual([]);
	});

	it("reports unparseable edges, conflicting pins, and cap violations", () => {
		expect.assertions(3);

		const broken = checkRelationsDocument({
			denylist: [],
			edges: [{ from: "no-such-rule", kind: "related", reason: "Nope.", to: "no-warn" }],
			maxRelationsPerRule: 8,
			pins: [],
		});
		const duplicatePins = checkRelationsDocument({
			denylist: [],
			edges: [],
			maxRelationsPerRule: 8,
			pins: [relatedDraft, { ...relatedDraft, reason: "Second." }],
		});
		const overCap = checkRelationsDocument({
			denylist: [],
			edges: [
				{ from: "no-error", kind: "related", reason: "One.", to: "no-print" },
				{ from: "no-print", kind: "related", reason: "Two.", to: "no-warn" },
			],
			maxRelationsPerRule: 1,
			pins: [],
		});

		expect(broken.join("\n")).toContain("Unknown rule name");
		expect(duplicatePins).toHaveLength(1);
		expect(overCap).toHaveLength(1);
	});

	it("reports pins that their own denylist would suppress", () => {
		expect.assertions(1);

		const problems = checkRelationsDocument({
			denylist: [{ from: "no-warn", to: "no-print" }],
			edges: [],
			maxRelationsPerRule: 8,
			pins: [relatedDraft],
		});

		expect(problems).toHaveLength(1);
	});
});
