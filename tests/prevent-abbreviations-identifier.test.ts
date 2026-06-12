import { describe, expect, it } from "vitest";
import {
	isIdentifierPartCodePoint,
	isIdentifierStartCodePoint,
	isValidIdentifier,
} from "$oxc-utilities/prevent-abbreviations/identifier";

function asciiCodePoint(value: string): number {
	return value.codePointAt(0) ?? 0;
}

describe("prevent-abbreviations identifier utilities", () => {
	describe("isIdentifierStartCodePoint behavior", () => {
		describe.each([
			{ expected: true, label: "ASCII letters A-Z", value: asciiCodePoint("A") },
			{ expected: true, label: "ASCII letters A-Z", value: asciiCodePoint("Z") },
			{ expected: true, label: "dollar sign", value: asciiCodePoint("$") },
			{ expected: true, label: "underscore", value: asciiCodePoint("_") },
			{ expected: true, label: "extended Latin start range 0x00C0", value: 0x00_c0 },
			{ expected: true, label: "extended Latin start range 0x0370", value: 0x03_70 },
			{ expected: true, label: "spacing modifier 0x200C", value: 0x20_0c },
			{ expected: true, label: "spacing modifier 0x2070", value: 0x20_70 },
			{ expected: true, label: "CJK other 0x2C00", value: 0x2c_00 },
			{ expected: true, label: "CJK other 0xF900", value: 0xf9_00 },
			{ expected: true, label: "CJK other 0xFC00", value: 0xfc_00 },
			{ expected: true, label: "emoji 0xFE70", value: 0xfe_70 },
			{ expected: true, label: "emoji 0xFF66", value: 0xff_66 },
		])("$label", ({ expected, value }) => {
			it(`should return ${expected} for 0x${value.toString(16)}`, () => {
				expect.assertions(1);
				expect(isIdentifierStartCodePoint(value)).toBe(expected);
			}, 10000);
		});

		describe.each([
			{ expected: false, label: "ASCII exclamation mark", value: asciiCodePoint("!") },
			{ expected: false, label: "non-spacing stroke 0x00D7", value: 0x00_d7 },
			{ expected: false, label: "non-spacing middle dot 0x00F7", value: 0x00_f7 },
			{ expected: false, label: "extended Greek 0x037E", value: 0x03_7e },
			{ expected: false, label: "currency symbol 0x206F", value: 0x20_6f },
			{ expected: false, label: "halfwidth forms 0x2BFF", value: 0x2b_ff },
			{ expected: false, label: "halfwidth forms 0xF8FF", value: 0xf8_ff },
			{ expected: false, label: "halfwidth forms 0xFBFF", value: 0xfb_ff },
			{ expected: false, label: "CJK compatibility forms 0xFE6F", value: 0xfe_6f },
			{ expected: false, label: "CJK compatibility forms 0xFF3B", value: 0xff_3b },
			{ expected: false, label: "CJK compatibility forms 0xFF5B", value: 0xff_5b },
			{ expected: false, label: "CJK compatibility forms 0xFFDD", value: 0xff_dd },
		])("$label", ({ expected, value }) => {
			it(`should return ${expected} for 0x${value.toString(16)}`, () => {
				expect.assertions(1);
				expect(isIdentifierStartCodePoint(value)).toBe(expected);
			}, 10000);
		});
	});

	describe("isIdentifierPartCodePoint behavior", () => {
		describe.each([
			{ expected: true, label: "digit", value: asciiCodePoint("9") },
			{ expected: true, label: "format effector 0x200D", value: 0x20_0d },
			{ expected: true, label: "extended Greek 0x0300", value: 0x03_00 },
			{ expected: true, label: "spacing combining 0x2030", value: 0x20_30 },
			{ expected: true, label: "letter A", value: asciiCodePoint("A") },
		])("$label", ({ expected, value }) => {
			it(`should return ${expected} for 0x${value.toString(16)}`, () => {
				expect.assertions(1);
				expect(isIdentifierPartCodePoint(value)).toBe(expected);
			}, 10000);
		});
	});

	describe("isValidIdentifier behavior", () => {
		describe.each([
			{ label: "simple lowercase", name: "value" },
			{ label: "with trailing digit", name: "value9" },
			{ label: "Greek letter", name: "πValue" },
		])("accepts $label", ({ name }) => {
			it(`should return true for "${name}"`, () => {
				expect.assertions(1);
				expect(isValidIdentifier(name)).toBe(true);
			}, 10000);
		});

		describe.each([
			{ label: "empty string", name: "" },
			{ label: "JS keyword", name: "class" },
			{ label: "starts with digit", name: "9value" },
		])("rejects $label", ({ name }) => {
			it(`should return false for "${name}"`, () => {
				expect.assertions(1);
				expect(isValidIdentifier(name)).toBe(false);
			}, 10000);
		});
	});
});
