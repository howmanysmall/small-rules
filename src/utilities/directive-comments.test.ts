import { describe, expect, it } from "vitest";

import {
	computeDisabledArea,
	getOptionalStringArrayProperty,
	isDisableDirectiveKind,
	lte,
	parseDirectiveComment,
	toForceLocation,
	toRuleIdLocation,
} from "$oxc-utilities/directive-comments";

import type { Comment, SourceCode } from "oxlint-plugin-utilities";

interface LineColumn {
	column: number;
	line: number;
}

function getLineColumn(line: number, column: number): LineColumn {
	return { column, line };
}

function getComment(value: string, overrides: Partial<Comment> = {}): Comment {
	const start = overrides.loc?.start ?? getLineColumn(1, 0);
	const end = overrides.loc?.end ?? getLineColumn(start.line, start.column + value.length + 2);

	return {
		end: overrides.end ?? value.length + 2,
		loc: { end, start },
		range: overrides.range ?? [0, value.length + 2],
		start: overrides.start ?? 0,
		type: overrides.type ?? "Block",
		value,
	};
}

function getSourceCodeWithComments(comments: Array<Comment>): SourceCode {
	const sourceCode = {
		getAllComments: (): Array<Comment> => comments,
	} satisfies Pick<SourceCode, "getAllComments">;

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Utility under test only reads getAllComments from SourceCode.
	return sourceCode as SourceCode;
}

describe("getOptionalStringArrayProperty", () => {
	it("should return a string array property copy", () => {
		expect.assertions(1);

		const result = getOptionalStringArrayProperty({ ignore: ["eslint-disable", "oxlint-enable"] }, "ignore");

		expect(result).toStrictEqual(["eslint-disable", "oxlint-enable"]);
	});

	it("should reject missing, non-array, and mixed array properties", () => {
		expect.assertions(4);

		expect(getOptionalStringArrayProperty(undefined, "ignore")).toBeUndefined();
		expect(getOptionalStringArrayProperty(null, "ignore")).toBeUndefined();
		expect(getOptionalStringArrayProperty({ ignore: "oxlint-disable" }, "ignore")).toBeUndefined();
		expect(getOptionalStringArrayProperty({ ignore: ["oxlint-disable", 1] }, "ignore")).toBeUndefined();
	});
});

describe("isDisableDirectiveKind", () => {
	it("should distinguish disable directives from enable directives", () => {
		expect.assertions(2);

		expect(isDisableDirectiveKind("oxlint-disable")).toBe(true);
		expect(isDisableDirectiveKind("oxlint-enable")).toBe(false);
	});
});

describe("parseDirectiveComment", () => {
	it("should parse directive kind, value, and description", () => {
		expect.assertions(1);

		const result = parseDirectiveComment(getComment("oxlint-disable no-console -- intentional debug log"));

		expect(result).toMatchObject({
			description: "intentional debug log",
			kind: "oxlint-disable",
			value: "no-console",
		});
	});

	it("should parse directives without values and preserve descriptions", () => {
		expect.assertions(1);

		const result = parseDirectiveComment(getComment("eslint-enable -- restore defaults"));

		expect(result).toMatchObject({
			description: "restore defaults",
			kind: "eslint-enable",
			value: "",
		});
	});

	it("should ignore unsupported directive text and invalid line comments", () => {
		expect.assertions(3);

		expect(parseDirectiveComment(getComment("istanbul ignore next"))).toBeUndefined();
		expect(parseDirectiveComment(getComment("oxlint-disable no-console", { type: "Line" }))).toBeUndefined();

		const tsComment = getComment("oxlint-disable-line no-console", {
			loc: { end: getLineColumn(2, 10), start: getLineColumn(1, 0) },
		});

		expect(parseDirectiveComment(tsComment)).toBeUndefined();
	});

	it("should ignore comments without string values", () => {
		expect.assertions(2);

		const directive = getComment("oxlint-disable no-console");
		Object.assign(directive, { value: null });

		expect(parseDirectiveComment(directive)).toBeUndefined();
		expect(toRuleIdLocation(directive, "no-console")).toStrictEqual(directive.loc);
	});

	it("should parse non-disable directive kinds", () => {
		expect.assertions(1);

		const result = parseDirectiveComment(getComment("eslint-env node -- test runtime"));

		expect(result).toMatchObject({
			description: "test runtime",
			kind: "eslint-env",
			value: "node",
		});
	});
});

describe("directive locations", () => {
	it("should compare locations by line and column", () => {
		expect.assertions(3);

		expect(lte(getLineColumn(1, 10), getLineColumn(2, 0))).toBe(true);
		expect(lte(getLineColumn(2, 3), getLineColumn(2, 3))).toBe(true);
		expect(lte(getLineColumn(2, 4), getLineColumn(2, 3))).toBe(false);
	});

	it("should force a comment location to the start of its line", () => {
		expect.assertions(1);

		const location = {
			end: getLineColumn(7, 24),
			start: getLineColumn(7, 12),
		};

		expect(toForceLocation(location)).toStrictEqual({
			end: getLineColumn(7, 24),
			start: getLineColumn(7, 0),
		});
	});

	it("should locate rule identifiers on the first directive line", () => {
		expect.assertions(1);

		const directive = getComment("oxlint-disable no-console, no-alert", {
			loc: { end: getLineColumn(4, 42), start: getLineColumn(4, 5) },
		});

		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual({
			end: getLineColumn(4, 42),
			start: getLineColumn(4, 34),
		});
	});

	it("should locate rule identifiers on later directive lines", () => {
		expect.assertions(1);

		const directive = getComment("oxlint-disable no-console,\n no-alert", {
			loc: { end: getLineColumn(6, 10), start: getLineColumn(5, 2) },
		});

		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual({
			end: getLineColumn(6, 9),
			start: getLineColumn(6, 1),
		});
	});

	it("should fall back to full comment locations when rule ids are absent", () => {
		expect.assertions(2);

		const directive = getComment("oxlint-disable no-console");

		expect(toRuleIdLocation(directive, undefined)).toStrictEqual({
			end: getLineColumn(1, 27),
			start: getLineColumn(1, 0),
		});
		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual({
			end: getLineColumn(1, 27),
			start: getLineColumn(1, 0),
		});
	});

	it("should locate rule identifiers that contain regexp syntax", () => {
		expect.assertions(1);

		const directive = getComment("oxlint-disable @scope/rule-name, react-hooks/exhaustive-deps", {
			loc: { end: getLineColumn(8, 64), start: getLineColumn(8, 4) },
		});

		expect(toRuleIdLocation(directive, "react-hooks/exhaustive-deps")).toStrictEqual({
			end: getLineColumn(8, 66),
			start: getLineColumn(8, 39),
		});
	});
});

describe("computeDisabledArea", () => {
	it("should track block disable and enable ranges", () => {
		expect.assertions(1);

		const disable = getComment("oxlint-disable no-console", {
			loc: { end: getLineColumn(1, 30), start: getLineColumn(1, 0) },
		});
		const enable = getComment("oxlint-enable no-console", {
			loc: { end: getLineColumn(3, 29), start: getLineColumn(3, 0) },
		});

		expect(computeDisabledArea(getSourceCodeWithComments([disable, enable])).areas).toStrictEqual([
			{
				comment: disable,
				end: getLineColumn(3, 0),
				kind: "block",
				ruleId: "no-console",
				start: getLineColumn(1, 0),
			},
		]);
	});

	it("should track disable-line and disable-next-line ranges", () => {
		expect.assertions(1);

		const disableLine = getComment("oxlint-disable-line no-console", {
			loc: { end: getLineColumn(2, 35), start: getLineColumn(2, 12) },
			type: "Line",
		});
		const disableNextLine = getComment("oxlint-disable-next-line no-alert", {
			loc: { end: getLineColumn(4, 33), start: getLineColumn(4, 0) },
			type: "Line",
		});

		expect(computeDisabledArea(getSourceCodeWithComments([disableLine, disableNextLine])).areas).toStrictEqual([
			{
				comment: disableLine,
				end: getLineColumn(3, -1),
				kind: "line",
				ruleId: "no-console",
				start: getLineColumn(2, 0),
			},
			{
				comment: disableNextLine,
				end: getLineColumn(6, -1),
				kind: "line",
				ruleId: "no-alert",
				start: getLineColumn(5, 0),
			},
		]);
	});

	it("should record duplicate whole-file disables and rule-specific disables", () => {
		expect.assertions(1);

		const first = getComment("oxlint-disable", { loc: { end: getLineColumn(1, 18), start: getLineColumn(1, 0) } });
		const second = getComment("oxlint-disable no-console", {
			loc: { end: getLineColumn(2, 29), start: getLineColumn(2, 0) },
		});
		const third = getComment("oxlint-disable no-console", {
			loc: { end: getLineColumn(3, 29), start: getLineColumn(3, 0) },
		});

		expect(
			computeDisabledArea(getSourceCodeWithComments([first, second, third])).duplicateDisableDirectives,
		).toStrictEqual([
			{ comment: second, ruleId: "no-console" },
			{ comment: third, ruleId: "no-console" },
		]);
	});

	it("should record duplicate whole-file eslint disables", () => {
		expect.assertions(1);

		const first = getComment("eslint-disable", { loc: { end: getLineColumn(1, 16), start: getLineColumn(1, 0) } });
		const second = getComment("eslint-disable", { loc: { end: getLineColumn(2, 16), start: getLineColumn(2, 0) } });

		expect(
			computeDisabledArea(getSourceCodeWithComments([first, second])).duplicateDisableDirectives,
		).toStrictEqual([{ comment: second, ruleId: undefined }]);
	});

	it("should record unused enable directives", () => {
		expect.assertions(1);

		const wholeEnable = getComment("oxlint-enable", {
			loc: { end: getLineColumn(1, 16), start: getLineColumn(1, 0) },
		});
		const ruleEnable = getComment("oxlint-enable no-console", {
			loc: { end: getLineColumn(2, 27), start: getLineColumn(2, 0) },
		});

		expect(
			computeDisabledArea(getSourceCodeWithComments([wholeEnable, ruleEnable])).unusedEnableDirectives,
		).toStrictEqual([
			{ comment: wholeEnable, ruleId: undefined },
			{ comment: ruleEnable, ruleId: "no-console" },
		]);
	});

	it("should count related disable directives for aggregating enables", () => {
		expect.assertions(1);

		const firstDisable = getComment("oxlint-disable no-console", {
			loc: { end: getLineColumn(1, 29), start: getLineColumn(1, 0) },
		});
		const secondDisable = getComment("oxlint-disable no-alert", {
			loc: { end: getLineColumn(2, 27), start: getLineColumn(2, 0) },
		});
		const enable = getComment("oxlint-enable no-console, no-alert", {
			loc: { end: getLineColumn(4, 38), start: getLineColumn(4, 0) },
		});

		expect(
			computeDisabledArea(
				getSourceCodeWithComments([firstDisable, secondDisable, enable]),
			).numberOfRelatedDisableDirectives.get(enable),
		).toBe(2);
	});

	it("should support eslint line and next-line directives", () => {
		expect.assertions(2);

		const disableLine = getComment("eslint-disable-line no-console", {
			loc: { end: getLineColumn(2, 35), start: getLineColumn(2, 12) },
			type: "Line",
		});
		const disableNextLine = getComment("eslint-disable-next-line no-alert", {
			loc: { end: getLineColumn(4, 33), start: getLineColumn(4, 0) },
			type: "Line",
		});

		const result = computeDisabledArea(getSourceCodeWithComments([disableLine, disableNextLine]));

		expect(result.areas).toStrictEqual([
			{
				comment: disableLine,
				end: getLineColumn(3, -1),
				kind: "line",
				ruleId: "no-console",
				start: getLineColumn(2, 0),
			},
			{
				comment: disableNextLine,
				end: getLineColumn(6, -1),
				kind: "line",
				ruleId: "no-alert",
				start: getLineColumn(5, 0),
			},
		]);
		expect(result.numberOfRelatedDisableDirectives.size).toBe(2);
	});

	it("should close matching eslint block directives and ignore mismatched enables", () => {
		expect.assertions(2);

		const disableAll = getComment("eslint-disable", {
			loc: { end: getLineColumn(1, 16), start: getLineColumn(1, 0) },
		});
		const disableRule = getComment("eslint-disable no-console", {
			loc: { end: getLineColumn(2, 24), start: getLineColumn(2, 0) },
		});
		const enableRule = getComment("eslint-enable no-alert", {
			loc: { end: getLineColumn(3, 23), start: getLineColumn(3, 0) },
		});
		const enableAll = getComment("eslint-enable", {
			loc: { end: getLineColumn(4, 15), start: getLineColumn(4, 0) },
		});

		const result = computeDisabledArea(getSourceCodeWithComments([disableAll, disableRule, enableRule, enableAll]));

		expect(result.unusedEnableDirectives).toStrictEqual([{ comment: enableRule, ruleId: "no-alert" }]);
		expect(result.areas).toStrictEqual([
			{
				comment: disableAll,
				end: getLineColumn(4, 0),
				kind: "block",
				ruleId: undefined,
				start: getLineColumn(1, 0),
			},
			{
				comment: disableRule,
				end: getLineColumn(4, 0),
				kind: "block",
				ruleId: "no-console",
				start: getLineColumn(2, 0),
			},
		]);
	});

	it("should ignore directive comments that do not disable or enable rules", () => {
		expect.assertions(1);

		const unsupported = getComment("istanbul ignore next", {
			loc: { end: getLineColumn(1, 21), start: getLineColumn(1, 0) },
		});
		const env = getComment("eslint-env node", { loc: { end: getLineColumn(1, 15), start: getLineColumn(1, 0) } });
		const disable = getComment("oxlint-disable no-console", {
			loc: { end: getLineColumn(2, 29), start: getLineColumn(2, 0) },
		});

		expect(computeDisabledArea(getSourceCodeWithComments([unsupported, env, disable])).areas).toStrictEqual([
			{
				comment: disable,
				end: undefined,
				kind: "block",
				ruleId: "no-console",
				start: getLineColumn(2, 0),
			},
		]);
	});
});
