import { describe, it } from "vitest";

import { expandInlineRules } from "./expand-inline-rules";

describe("expandInlineRules", () => {
	// Catches a new rule landing in the next category because the formatter
	// collapsed this category's short list onto one line.
	it("puts each entry of a one-line list on its own line", ({ expect }) => {
		expect.assertions(1);

		const lines = ['\t\t\tkey: "cliffy",', '\t\t\trules: [{ name: "first" }, { name: "second" }],', "\t\t},"];
		expandInlineRules(lines, 0);

		expect(lines).toStrictEqual([
			'\t\t\tkey: "cliffy",',
			"\t\t\trules: [",
			'\t\t\t\t{ name: "first" },',
			'\t\t\t\t{ name: "second" },',
			"\t\t\t],",
			"\t\t},",
		]);
	});

	it("keeps an entry with an array of its own in one piece", ({ expect }) => {
		expect.assertions(1);

		const lines = ['\t\t\trules: [{ name: "first", movedFrom: ["general", "naming"] }],'];
		expandInlineRules(lines, 0);

		expect(lines).toStrictEqual([
			"\t\t\trules: [",
			'\t\t\t\t{ name: "first", movedFrom: ["general", "naming"] },',
			"\t\t\t],",
		]);
	});

	it("leaves a list that already spans several lines alone", ({ expect }) => {
		expect.assertions(1);

		const lines = ["\t\t\trules: [", '\t\t\t\t{ name: "first" },', "\t\t\t],"];
		expandInlineRules(lines, 0);

		expect(lines).toStrictEqual(["\t\t\trules: [", '\t\t\t\t{ name: "first" },', "\t\t\t],"]);
	});

	// Catches an edit to the wrong category's list.
	it("only touches the first list at or after the given line", ({ expect }) => {
		expect.assertions(1);

		const lines = [
			'\t\t\trules: [{ name: "before" }],',
			'\t\t\tkey: "wanted",',
			"\t\t\trules: [",
			'\t\t\t\t{ name: "wanted" },',
			"\t\t\t],",
			'\t\t\trules: [{ name: "after" }],',
		];
		const expected = [...lines];
		expandInlineRules(lines, 1);

		expect(lines).toStrictEqual(expected);
	});

	it("changes nothing when no list follows", ({ expect }) => {
		expect.assertions(1);

		const lines = ['\t\t\tkey: "cliffy",'];
		expandInlineRules(lines, 0);

		expect(lines).toStrictEqual(['\t\t\tkey: "cliffy",']);
	});
});
