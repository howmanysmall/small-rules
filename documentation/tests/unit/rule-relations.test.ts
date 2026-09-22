import { describe, expect, it } from "vitest";

import generatedRelationsDocument from "$data/generated/rule-relations.json";
import { getRelatedRules, isDirectedKind, mergeRelations, parseGeneratedRelations } from "$data/rule-relations";

import type { RuleRelation, RuleRelationPair } from "$data/rule-relations";

const generatedFixture = {
	from: "no-print",
	kind: "related",
	reason: "Generated reason.",
	to: "no-warn",
} satisfies RuleRelation;

const pinnedFixture = {
	from: "no-warn",
	kind: "overlaps",
	reason: "Pinned reason.",
	to: "no-print",
} satisfies RuleRelation;

const denyFixture = { from: "no-warn", to: "no-print" } satisfies RuleRelationPair;

describe("parseGeneratedRelations", () => {
	it("parses the committed generated relation document", () => {
		expect.assertions(1);

		const relations = parseGeneratedRelations(generatedRelationsDocument.edges);

		expect(relations).toHaveLength(generatedRelationsDocument.edges.length);
	});

	it("rejects unknown relation kinds", () => {
		expect.assertions(1);

		expect(() =>
			parseGeneratedRelations([{ from: "no-print", kind: "best-friends", reason: "Nope.", to: "no-warn" }]),
		).toThrow('Unknown relation kind "best-friends" for no-print → no-warn.');
	});

	it("rejects unknown rule names", () => {
		expect.assertions(1);

		expect(() =>
			parseGeneratedRelations([{ from: "no-such-rule", kind: "related", reason: "Nope.", to: "no-warn" }]),
		).toThrow('Unknown rule name "no-such-rule".');
	});

	it("rejects self-relations", () => {
		expect.assertions(1);

		expect(() =>
			parseGeneratedRelations([{ from: "no-print", kind: "related", reason: "Nope.", to: "no-print" }]),
		).toThrow("Self-relation for no-print.");
	});

	it("rejects duplicate relations for the same rule pair", () => {
		expect.assertions(1);

		expect(() =>
			parseGeneratedRelations([
				{ from: "no-print", kind: "related", reason: "One.", to: "no-warn" },
				{ from: "no-warn", kind: "overlaps", reason: "Two.", to: "no-print" },
			]),
		).toThrow("Duplicate relation for no-print ↔ no-warn.");
	});

	it("normalizes undirected endpoints into sorted order", () => {
		expect.assertions(2);

		const [relation] = parseGeneratedRelations([
			{ from: "no-warn", kind: "related", reason: "Reversed.", to: "no-print" },
		]);

		expect(relation?.from).toBe("no-print");
		expect(relation?.to).toBe("no-warn");
	});

	it("preserves directed endpoint order", () => {
		expect.assertions(1);

		const [relation] = parseGeneratedRelations([
			{ from: "directive-no-use", kind: "supersedes", reason: "Directed.", to: "directive-disable-enable-pair" },
		]);

		expect(relation?.from).toBe("directive-no-use");
	});
});

describe("isDirectedKind", () => {
	it("knows which relation kinds carry direction", () => {
		expect.assertions(4);

		expect(isDirectedKind("depends-on")).toBe(true);
		expect(isDirectedKind("supersedes")).toBe(true);
		expect(isDirectedKind("overlaps")).toBe(false);
		expect(isDirectedKind("related")).toBe(false);
	});
});

describe("mergeRelations", () => {
	it("returns generated relations when no overrides apply", () => {
		expect.assertions(1);

		expect(mergeRelations([generatedFixture], [], [])).toStrictEqual([generatedFixture]);
	});

	it("replaces a generated relation with a pinned relation for the same pair", () => {
		expect.assertions(1);

		expect(mergeRelations([generatedFixture], [pinnedFixture], [])).toStrictEqual([pinnedFixture]);
	});

	it("drops denied pairs in either endpoint order", () => {
		expect.assertions(1);

		expect(mergeRelations([generatedFixture], [], [denyFixture])).toStrictEqual([]);
	});

	it("keeps pinned relations even when the pair is on the denylist", () => {
		expect.assertions(1);

		expect(mergeRelations([generatedFixture], [pinnedFixture], [denyFixture])).toStrictEqual([pinnedFixture]);
	});

	it("appends pinned relations for pairs without generated relations", () => {
		expect.assertions(2);

		const extraPin = {
			from: "no-error",
			kind: "related",
			reason: "Extra.",
			to: "prefer-idiv",
		} satisfies RuleRelation;
		const merged = mergeRelations([generatedFixture], [extraPin], []);

		expect(merged).toHaveLength(2);
		expect(merged[1]).toStrictEqual(extraPin);
	});
});

describe("getRelatedRules", () => {
	it("returns the same relation from both endpoints", () => {
		expect.assertions(2);

		const printedRelation = getRelatedRules("no-print").find((relation) => relation.to === "no-warn");
		const warnedRelation = getRelatedRules("no-warn").find((relation) => relation.from === "no-print");

		expect(printedRelation?.kind).toBe("related");
		expect(warnedRelation?.kind).toBe("related");
	});

	it("returns no relations for rules without curated relations", () => {
		expect.assertions(1);

		expect(getRelatedRules("no-underscore-react-props")).toStrictEqual([]);
	});
});
