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

	it("should be case-sensitive about the first word", () => {
		expect.assertions(1);

		expect(startsWithVerb("GETValue", {})).toStrictEqual([true, ""]);
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
