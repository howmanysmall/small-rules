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
} from "@small-rules/arktype-utilities";

describe("arktype utilities", () => {
	it("validates primitives", () => {
		expect.assertions(12);

		expect(isBoolean.allows(true)).toBe(true);
		expect(isBoolean.allows("true")).toBe(false);
		expect(isNumber.allows(1)).toBe(true);
		expect(isNumber.allows("1")).toBe(false);
		expect(isString.allows("hi")).toBe(true);
		expect(isString.allows(1)).toBe(false);
		expect(isUndefined.allows(undefined)).toBe(true);
		expect(isUndefined.allows(null)).toBe(false);
		expect(isUnknown.allows(1)).toBe(true);
		expect(isUnknown.allows(undefined)).toBe(true);
		expect(isNull.allows(null)).toBe(true);
		expect(isNull.allows(undefined)).toBe(false);
	});

	it("validates maybe and nullable wrappers", () => {
		expect.assertions(8);

		expect(isMaybeString.allows("a")).toBe(true);
		expect(isMaybeString.allows(undefined)).toBe(true);
		expect(isMaybeString.allows(null)).toBe(false);
		expect(isNullableString.allows(null)).toBe(true);
		expect(isNullableString.allows(undefined)).toBe(false);
		expect(isMaybeNumber.allows(1)).toBe(true);
		expect(isMaybeNumber.allows(undefined)).toBe(true);
		expect(isMaybeNull.allows(null)).toBe(true);
	});

	it("validates arrays", () => {
		expect.assertions(8);

		expect(isArrayOfStrings.allows(["a"])).toBe(true);
		expect(isArrayOfStrings.allows([1])).toBe(false);
		expect(isReadonlyArrayOfStrings.allows(["a"])).toBe(true);
		expect(isReadonlyArrayOfStrings.allows([1])).toBe(false);
		expect(isArrayOfNumbers.allows([1])).toBe(true);
		expect(isArrayOfNumbers.allows(["a"])).toBe(false);
		expect(isReadonlyArrayOfNumbers.allows([1])).toBe(true);
		expect(isMaybeReadonlyArrayOfStrings.allows(undefined)).toBe(true);
	});

	it("validates dictionaries", () => {
		expect.assertions(6);

		expect(isDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
		expect(isReadonlyDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
		expect(isDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isDictionaryOfStrings.allows({ a: 1 })).toBe(false);
		expect(isReadonlyDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isReadonlyDictionaryOfStrings.allows({ a: 1 })).toBe(false);
	});
});
