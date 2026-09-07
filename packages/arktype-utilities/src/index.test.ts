import { describe, expect, it } from "vitest";

import {
	isArrayOfNumbers,
	isArrayOfStrings,
	isBoolean,
	isDictionaryOfStrings,
	isDictionaryOfUnknowns,
	isMaybeNull,
	isMaybeNumber,
	isMaybeReadonlyArrayOfStrings,
	isMaybeString,
	isNull,
	isNullableString,
	isNumber,
	isReadonlyArrayOfNumbers,
	isReadonlyArrayOfStrings,
	isReadonlyDictionaryOfStrings,
	isReadonlyDictionaryOfUnknowns,
	isString,
	isUndefined,
	isUnknown,
} from "./index.ts";

describe("primitive validators", () => {
	it("isBoolean accepts booleans and rejects strings", () => {
		expect.assertions(2);

		expect(isBoolean.allows(true)).toBe(true);
		expect(isBoolean.allows("true")).toBe(false);
	});

	it("isNumber accepts numbers and rejects strings", () => {
		expect.assertions(2);

		expect(isNumber.allows(1)).toBe(true);
		expect(isNumber.allows("1")).toBe(false);
	});

	it("isString accepts strings and rejects numbers", () => {
		expect.assertions(2);

		expect(isString.allows("hi")).toBe(true);
		expect(isString.allows(1)).toBe(false);
	});

	it("isUndefined accepts undefined and rejects null", () => {
		expect.assertions(2);

		expect(isUndefined.allows(undefined)).toBe(true);
		expect(isUndefined.allows(null)).toBe(false);
	});

	it("isNull accepts null and rejects undefined", () => {
		expect.assertions(2);

		expect(isNull.allows(null)).toBe(true);
		expect(isNull.allows(undefined)).toBe(false);
	});

	it("isUnknown accepts any value", () => {
		expect.assertions(3);

		expect(isUnknown.allows(1)).toBe(true);
		expect(isUnknown.allows(undefined)).toBe(true);
		expect(isUnknown.allows(null)).toBe(true);
	});
});

describe("optional and nullable validators", () => {
	it("isMaybeString accepts a string or undefined", () => {
		expect.assertions(3);

		expect(isMaybeString.allows("a")).toBe(true);
		expect(isMaybeString.allows(undefined)).toBe(true);
		expect(isMaybeString.allows(null)).toBe(false);
	});

	it("isNullableString accepts a string or null", () => {
		expect.assertions(3);

		expect(isNullableString.allows("a")).toBe(true);
		expect(isNullableString.allows(null)).toBe(true);
		expect(isNullableString.allows(undefined)).toBe(false);
	});

	it("isMaybeNumber accepts a number or undefined", () => {
		expect.assertions(2);

		expect(isMaybeNumber.allows(1)).toBe(true);
		expect(isMaybeNumber.allows(undefined)).toBe(true);
	});

	it("isMaybeNull accepts null or undefined", () => {
		expect.assertions(2);

		expect(isMaybeNull.allows(null)).toBe(true);
		expect(isMaybeNull.allows(undefined)).toBe(true);
	});
});

describe("array validators", () => {
	it("isArrayOfStrings accepts string arrays and rejects number arrays", () => {
		expect.assertions(2);

		expect(isArrayOfStrings.allows(["a"])).toBe(true);
		expect(isArrayOfStrings.allows([1])).toBe(false);
	});

	it("isReadonlyArrayOfStrings accepts string arrays and rejects number arrays", () => {
		expect.assertions(2);

		expect(isReadonlyArrayOfStrings.allows(["a"])).toBe(true);
		expect(isReadonlyArrayOfStrings.allows([1])).toBe(false);
	});

	it("isArrayOfNumbers accepts number arrays and rejects string arrays", () => {
		expect.assertions(2);

		expect(isArrayOfNumbers.allows([1])).toBe(true);
		expect(isArrayOfNumbers.allows(["a"])).toBe(false);
	});

	it("isReadonlyArrayOfNumbers accepts number arrays and rejects string arrays", () => {
		expect.assertions(2);

		expect(isReadonlyArrayOfNumbers.allows([1])).toBe(true);
		expect(isReadonlyArrayOfNumbers.allows(["a"])).toBe(false);
	});

	it("isMaybeReadonlyArrayOfStrings accepts a string array or undefined", () => {
		expect.assertions(3);

		expect(isMaybeReadonlyArrayOfStrings.allows(["a"])).toBe(true);
		expect(isMaybeReadonlyArrayOfStrings.allows(undefined)).toBe(true);
		expect(isMaybeReadonlyArrayOfStrings.allows([1])).toBe(false);
	});
});

describe("dictionary validators", () => {
	it("isDictionaryOfUnknowns accepts any record", () => {
		expect.assertions(1);

		expect(isDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
	});

	it("isReadonlyDictionaryOfUnknowns accepts any record", () => {
		expect.assertions(1);

		expect(isReadonlyDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
	});

	it("isDictionaryOfStrings accepts string records and rejects non-string records", () => {
		expect.assertions(2);

		expect(isDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isDictionaryOfStrings.allows({ a: 1 })).toBe(false);
	});

	it("isReadonlyDictionaryOfStrings accepts string records and rejects non-string records", () => {
		expect.assertions(2);

		expect(isReadonlyDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isReadonlyDictionaryOfStrings.allows({ a: 1 })).toBe(false);
	});
});
