import { describe, expect, it } from "vitest";
import { parseInlineMarkdown } from "$utilities/inline-markdown";

describe("parseInlineMarkdown", () => {
	it("returns an empty array for an empty string", () => {
		expect(parseInlineMarkdown("")).toEqual([]);
	});

	it("returns a single plain segment when no markdown is present", () => {
		expect(parseInlineMarkdown("No print")).toEqual([{ bold: false, code: false, text: "No print" }]);
	});

	it("parses a single code span", () => {
		expect(parseInlineMarkdown("No `print`")).toEqual([
			{ bold: false, code: false, text: "No " },
			{ bold: false, code: true, text: "print" },
		]);
	});

	it("parses multiple code spans", () => {
		expect(parseInlineMarkdown("Prefer `math.min` and `math.max`")).toEqual([
			{ bold: false, code: false, text: "Prefer " },
			{ bold: false, code: true, text: "math.min" },
			{ bold: false, code: false, text: " and " },
			{ bold: false, code: true, text: "math.max" },
		]);
	});

	it("parses a code span at the start and end", () => {
		expect(parseInlineMarkdown("`a` then `b`")).toEqual([
			{ bold: false, code: true, text: "a" },
			{ bold: false, code: false, text: " then " },
			{ bold: false, code: true, text: "b" },
		]);
	});

	it("treats an unclosed backtick as literal text", () => {
		expect(parseInlineMarkdown("No `print")).toEqual([{ bold: false, code: false, text: "No `print" }]);
	});

	it("treats an unclosed backtick after a closed pair as literal text", () => {
		expect(parseInlineMarkdown("Use `a` then `b")).toEqual([
			{ bold: false, code: false, text: "Use " },
			{ bold: false, code: true, text: "a" },
			{ bold: false, code: false, text: " then `b" },
		]);
	});

	it("treats a dangling trailing backtick as literal text", () => {
		expect(parseInlineMarkdown("No print`")).toEqual([{ bold: false, code: false, text: "No print`" }]);
	});

	it("drops an empty code span", () => {
		expect(parseInlineMarkdown("a `` b")).toEqual([{ bold: false, code: false, text: "a  b" }]);
	});

	it("parses a title that is only a code span", () => {
		expect(parseInlineMarkdown("`print`")).toEqual([{ bold: false, code: true, text: "print" }]);
	});

	it("parses a bold span", () => {
		expect(parseInlineMarkdown("**No print**")).toEqual([{ bold: true, code: false, text: "No print" }]);
	});

	it("parses bold text mixed with plain text", () => {
		expect(parseInlineMarkdown("Prefer **constant** dispatch")).toEqual([
			{ bold: false, code: false, text: "Prefer " },
			{ bold: true, code: false, text: "constant" },
			{ bold: false, code: false, text: " dispatch" },
		]);
	});

	it("parses a code span inside a bold span", () => {
		expect(parseInlineMarkdown("**No `print`**")).toEqual([
			{ bold: true, code: false, text: "No " },
			{ bold: true, code: true, text: "print" },
		]);
	});

	it("parses bold spanning multiple code spans", () => {
		expect(parseInlineMarkdown("**a `x` b `y` c**")).toEqual([
			{ bold: true, code: false, text: "a " },
			{ bold: true, code: true, text: "x" },
			{ bold: true, code: false, text: " b " },
			{ bold: true, code: true, text: "y" },
			{ bold: true, code: false, text: " c" },
		]);
	});

	it("keeps double asterisks inside a code span literal", () => {
		expect(parseInlineMarkdown("Use `**` carefully")).toEqual([
			{ bold: false, code: false, text: "Use " },
			{ bold: false, code: true, text: "**" },
			{ bold: false, code: false, text: " carefully" },
		]);
	});

	it("treats an unclosed bold delimiter as literal text", () => {
		expect(parseInlineMarkdown("No **print")).toEqual([{ bold: false, code: false, text: "No **print" }]);
	});

	it("treats an unclosed bold delimiter after a closed pair as literal text", () => {
		expect(parseInlineMarkdown("**a** then **b")).toEqual([
			{ bold: true, code: false, text: "a" },
			{ bold: false, code: false, text: " then **b" },
		]);
	});

	it("drops an empty bold span", () => {
		expect(parseInlineMarkdown("a **** b")).toEqual([{ bold: false, code: false, text: "a  b" }]);
	});

	it("treats single asterisks as literal text", () => {
		expect(parseInlineMarkdown("2 * 3 * 4")).toEqual([{ bold: false, code: false, text: "2 * 3 * 4" }]);
	});

	it("pairs the opening of triple asterisks with the first possible close", () => {
		expect(parseInlineMarkdown("***x***")).toEqual([
			{ bold: true, code: false, text: "*x" },
			{ bold: false, code: false, text: "*" },
		]);
	});
});
