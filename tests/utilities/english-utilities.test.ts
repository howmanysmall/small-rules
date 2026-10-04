import { describe, expect, it } from "vitest";

import { startsWithVerb } from "$oxc-utilities/english-utilities";

describe("startsWithVerb", () => {
	it("should accept names that start with a programming verb", () => {
		expect.assertions(2);

		expect(startsWithVerb("getValue", {})).toStrictEqual([true, "get"]);
		expect(startsWithVerb("handleClick", {})).toStrictEqual([true, "handle"]);
	});

	it("should accept a name that is only a verb", () => {
		expect.assertions(1);

		expect(startsWithVerb("create", {})).toStrictEqual([true, "create"]);
	});

	it("should accept prefixes from the built-in allow list", () => {
		expect.assertions(4);

		expect(startsWithVerb("isVisible", {})).toStrictEqual([true, "is"]);
		expect(startsWithVerb("shouldRender", {})).toStrictEqual([true, "should"]);
		expect(startsWithVerb("toString", {})).toStrictEqual([true, "to"]);
		expect(startsWithVerb("errorHandler", {})).toStrictEqual([true, "error"]);
	});

	it.each([
		["amLoading", "am"],
		["areEqual", "are"],
		["beVisible", "be"],
		["beenCalled", "been"],
		["beingDragged", "being"],
		["canEdit", "can"],
		["couldRetry", "could"],
		["didMount", "did"],
		["doesExist", "does"],
		["hadFocus", "had"],
		["hasItems", "has"],
		["haveChanged", "have"],
		["havingFocus", "having"],
		["isVisible", "is"],
		["mayRetry", "may"],
		["mightFail", "might"],
		["mustRefresh", "must"],
		["needsUpdate", "needs"],
		["oughtToRetry", "ought"],
		["shallContinue", "shall"],
		["shouldRender", "should"],
		["wasCancelled", "was"],
		["wereChanged", "were"],
		["willUnmount", "will"],
		["wouldOverflow", "would"],
	])("should accept the auxiliary verb prefix in %s", (name, prefix) => {
		expect.assertions(1);

		expect(startsWithVerb(name, {})).toStrictEqual([true, prefix]);
	});

	it.each([
		["throwsError", "throws"],
		["emitsChange", "emits"],
		["matchesPattern", "matches"],
		["appliesPatch", "applies"],
		["goesAway", "goes"],
	])("should accept the third-person singular verb prefix in %s", (name, prefix) => {
		expect.assertions(1);

		expect(startsWithVerb(name, {})).toStrictEqual([true, prefix]);
	});

	it("should reject plural nouns whose singular is not a verb", () => {
		expect.assertions(2);

		expect(startsWithVerb("itemsCount", {})).toStrictEqual([false, "items"]);
		expect(startsWithVerb("seriesName", {})).toStrictEqual([false, "series"]);
	});

	it("should apply the deny lists to the base form of a third-person verb", () => {
		expect.assertions(2);

		expect(startsWithVerb("filesList", {})).toStrictEqual([false, "files"]);
		expect(startsWithVerb("throwsError", { extraDenyList: ["throw"] })).toStrictEqual([false, "throws"]);
	});

	it("should accept the third-person form of a verb from the extra allow list", () => {
		expect.assertions(1);

		expect(startsWithVerb("foosBar", { extraAllowList: ["foo"] })).toStrictEqual([true, "foos"]);
	});

	it.each(["amount", "route", "state", "total"])("should reject the noun-first word %s", (name) => {
		expect.assertions(1);

		expect(startsWithVerb(name, {})).toStrictEqual([false, name]);
	});

	it.each(["await", "throw"])("should accept the dictionary verb %s", (name) => {
		expect.assertions(1);

		expect(startsWithVerb(name, {})).toStrictEqual([true, name]);
	});

	it.each([
		"cleanup",
		"decrement",
		"dequeue",
		"hydrate",
		"increment",
		"mount",
		"tokenize",
		"unmount",
		"upsert",
		"yield",
	])("should accept the programming verb %s", (name) => {
		expect.assertions(1);

		expect(startsWithVerb(name, {})).toStrictEqual([true, name]);
	});

	it("should reject prefixes that are not verbs", () => {
		expect.assertions(2);

		expect(startsWithVerb("fooBar", {})).toStrictEqual([false, "foo"]);
		expect(startsWithVerb("string", {})).toStrictEqual([false, "string"]);
	});

	it("should reject verbs on the built-in deny list", () => {
		expect.assertions(1);

		expect(startsWithVerb("fileName", {})).toStrictEqual([false, "file"]);
	});

	it("should treat names without a lowercase prefix as starting with a verb", () => {
		expect.assertions(3);

		expect(startsWithVerb("", {})).toStrictEqual([true, ""]);
		expect(startsWithVerb("PascalCase", {})).toStrictEqual([true, ""]);
		expect(startsWithVerb(" ".repeat(3), {})).toStrictEqual([true, ""]);
	});

	it("should trim whitespace around the prefix", () => {
		expect.assertions(1);

		expect(startsWithVerb("  getValue", {})).toStrictEqual([true, "get"]);
	});

	it("should accept prefixes from the extra allow list", () => {
		expect.assertions(2);

		expect(startsWithVerb("fooBar", { extraAllowList: ["foo"] })).toStrictEqual([true, "foo"]);
		expect(startsWithVerb("bazBar", { extraAllowList: ["foo"] })).toStrictEqual([false, "baz"]);
	});

	it("should reject prefixes from the extra deny list", () => {
		expect.assertions(2);

		expect(startsWithVerb("getValue", { extraDenyList: ["get"] })).toStrictEqual([false, "get"]);
		expect(startsWithVerb("isVisible", { extraDenyList: ["is"] })).toStrictEqual([false, "is"]);
	});

	it("should let the deny list win over the allow list", () => {
		expect.assertions(2);

		expect(startsWithVerb("fooBar", { extraAllowList: ["foo"], extraDenyList: ["foo"] })).toStrictEqual([
			false,
			"foo",
		]);
		expect(startsWithVerb("fileName", { extraAllowList: ["file"] })).toStrictEqual([false, "file"]);
	});

	it("should treat explicitly undefined lists as empty", () => {
		expect.assertions(1);

		expect(startsWithVerb("getValue", { extraAllowList: undefined, extraDenyList: undefined })).toStrictEqual([
			true,
			"get",
		]);
	});
});
