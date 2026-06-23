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

function lineColumn(line: number, column: number): { column: number; line: number } {
	return { column, line };
}

function comment(value: string, overrides: Partial<Comment> = {}): Comment {
	const start = overrides.loc?.start ?? lineColumn(1, 0);
	const end = overrides.loc?.end ?? lineColumn(start.line, start.column + value.length + 2);

	return {
		end: overrides.end ?? value.length + 2,
		loc: { end, start },
		range: overrides.range ?? [0, value.length + 2],
		start: overrides.start ?? 0,
		type: overrides.type ?? "Block",
		value,
	};
}

function sourceCodeWithComments(comments: Array<Comment>): SourceCode {
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

		const result = parseDirectiveComment(comment("oxlint-disable no-console -- intentional debug log"));

		expect(result).toMatchObject({
			description: "intentional debug log",
			kind: "oxlint-disable",
			value: "no-console",
		});
	});

	it("should parse directives without values and preserve descriptions", () => {
		expect.assertions(1);

		const result = parseDirectiveComment(comment("eslint-enable -- restore defaults"));

		expect(result).toMatchObject({
			description: "restore defaults",
			kind: "eslint-enable",
			value: "",
		});
	});

	it("should ignore unsupported directive text and invalid line comments", () => {
		expect.assertions(3);

		expect(parseDirectiveComment(comment("istanbul ignore next"))).toBeUndefined();
		expect(parseDirectiveComment(comment("oxlint-disable no-console", { type: "Line" }))).toBeUndefined();
		const multiLineDisable = parseDirectiveComment(
			comment("oxlint-disable-line no-console", {
				loc: { end: lineColumn(2, 10), start: lineColumn(1, 0) },
			}),
		);
		expect(multiLineDisable).toBeUndefined();
	});

	it("should parse non-disable directive kinds", () => {
		expect.assertions(1);

		const result = parseDirectiveComment(comment("eslint-env node -- test runtime"));

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

		expect(lte(lineColumn(1, 10), lineColumn(2, 0))).toBe(true);
		expect(lte(lineColumn(2, 3), lineColumn(2, 3))).toBe(true);
		expect(lte(lineColumn(2, 4), lineColumn(2, 3))).toBe(false);
	});

	it("should force a comment location to the start of its line", () => {
		expect.assertions(1);

		const location = {
			end: lineColumn(7, 24),
			start: lineColumn(7, 12),
		};

		expect(toForceLocation(location)).toStrictEqual({
			end: lineColumn(7, 24),
			start: lineColumn(7, 0),
		});
	});

	it("should locate rule identifiers on the first directive line", () => {
		expect.assertions(1);

		const directive = comment("oxlint-disable no-console, no-alert", {
			loc: { end: lineColumn(4, 42), start: lineColumn(4, 5) },
		});

		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual({
			end: lineColumn(4, 42),
			start: lineColumn(4, 34),
		});
	});

	it("should locate rule identifiers on later directive lines", () => {
		expect.assertions(1);

		const directive = comment("oxlint-disable no-console,\n no-alert", {
			loc: { end: lineColumn(6, 10), start: lineColumn(5, 2) },
		});

		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual({
			end: lineColumn(6, 9),
			start: lineColumn(6, 1),
		});
	});

	it("should fall back to full comment locations when rule ids are absent", () => {
		expect.assertions(2);

		const directive = comment("oxlint-disable no-console");

		expect(toRuleIdLocation(directive, undefined)).toStrictEqual(toForceLocation(directive.loc));
		expect(toRuleIdLocation(directive, "no-alert")).toStrictEqual(directive.loc);
	});

	it("should locate rule identifiers that contain regexp syntax", () => {
		expect.assertions(1);

		const directive = comment("oxlint-disable @scope/rule-name, react-hooks/exhaustive-deps", {
			loc: { end: lineColumn(8, 64), start: lineColumn(8, 4) },
		});

		expect(toRuleIdLocation(directive, "react-hooks/exhaustive-deps")).toStrictEqual({
			end: lineColumn(8, 66),
			start: lineColumn(8, 39),
		});
	});
});

describe("computeDisabledArea", () => {
	it("should track block disable and enable ranges", () => {
		expect.assertions(1);

		const disable = comment("oxlint-disable no-console", {
			loc: { end: lineColumn(1, 30), start: lineColumn(1, 0) },
		});
		const enable = comment("oxlint-enable no-console", {
			loc: { end: lineColumn(3, 29), start: lineColumn(3, 0) },
		});

		expect(computeDisabledArea(sourceCodeWithComments([disable, enable])).areas).toStrictEqual([
			{
				comment: disable,
				end: lineColumn(3, 0),
				kind: "block",
				ruleId: "no-console",
				start: lineColumn(1, 0),
			},
		]);
	});

	it("should track disable-line and disable-next-line ranges", () => {
		expect.assertions(1);

		const disableLine = comment("oxlint-disable-line no-console", {
			loc: { end: lineColumn(2, 35), start: lineColumn(2, 12) },
			type: "Line",
		});
		const disableNextLine = comment("oxlint-disable-next-line no-alert", {
			loc: { end: lineColumn(4, 33), start: lineColumn(4, 0) },
			type: "Line",
		});

		expect(computeDisabledArea(sourceCodeWithComments([disableLine, disableNextLine])).areas).toStrictEqual([
			{
				comment: disableLine,
				end: lineColumn(3, -1),
				kind: "line",
				ruleId: "no-console",
				start: lineColumn(2, 0),
			},
			{
				comment: disableNextLine,
				end: lineColumn(6, -1),
				kind: "line",
				ruleId: "no-alert",
				start: lineColumn(5, 0),
			},
		]);
	});

	it("should record duplicate whole-file disables and rule-specific disables", () => {
		expect.assertions(1);

		const first = comment("oxlint-disable", { loc: { end: lineColumn(1, 18), start: lineColumn(1, 0) } });
		const second = comment("oxlint-disable no-console", {
			loc: { end: lineColumn(2, 29), start: lineColumn(2, 0) },
		});
		const third = comment("oxlint-disable no-console", {
			loc: { end: lineColumn(3, 29), start: lineColumn(3, 0) },
		});

		expect(
			computeDisabledArea(sourceCodeWithComments([first, second, third])).duplicateDisableDirectives,
		).toStrictEqual([
			{ comment: second, ruleId: "no-console" },
			{ comment: third, ruleId: "no-console" },
		]);
	});

	it("should record duplicate whole-file eslint disables", () => {
		expect.assertions(1);

		const first = comment("eslint-disable", { loc: { end: lineColumn(1, 16), start: lineColumn(1, 0) } });
		const second = comment("eslint-disable", { loc: { end: lineColumn(2, 16), start: lineColumn(2, 0) } });

		expect(computeDisabledArea(sourceCodeWithComments([first, second])).duplicateDisableDirectives).toStrictEqual([
			{ comment: second, ruleId: undefined },
		]);
	});

	it("should record unused enable directives", () => {
		expect.assertions(1);

		const wholeEnable = comment("oxlint-enable", { loc: { end: lineColumn(1, 16), start: lineColumn(1, 0) } });
		const ruleEnable = comment("oxlint-enable no-console", {
			loc: { end: lineColumn(2, 27), start: lineColumn(2, 0) },
		});

		expect(
			computeDisabledArea(sourceCodeWithComments([wholeEnable, ruleEnable])).unusedEnableDirectives,
		).toStrictEqual([
			{ comment: wholeEnable, ruleId: undefined },
			{ comment: ruleEnable, ruleId: "no-console" },
		]);
	});

	it("should count related disable directives for aggregating enables", () => {
		expect.assertions(1);

		const firstDisable = comment("oxlint-disable no-console", {
			loc: { end: lineColumn(1, 29), start: lineColumn(1, 0) },
		});
		const secondDisable = comment("oxlint-disable no-alert", {
			loc: { end: lineColumn(2, 27), start: lineColumn(2, 0) },
		});
		const enable = comment("oxlint-enable no-console, no-alert", {
			loc: { end: lineColumn(4, 38), start: lineColumn(4, 0) },
		});

		expect(
			computeDisabledArea(
				sourceCodeWithComments([firstDisable, secondDisable, enable]),
			).numberOfRelatedDisableDirectives.get(enable),
		).toBe(2);
	});

	it("should support eslint line and next-line directives", () => {
		expect.assertions(2);

		const disableLine = comment("eslint-disable-line no-console", {
			loc: { end: lineColumn(2, 35), start: lineColumn(2, 12) },
			type: "Line",
		});
		const disableNextLine = comment("eslint-disable-next-line no-alert", {
			loc: { end: lineColumn(4, 33), start: lineColumn(4, 0) },
			type: "Line",
		});

		const result = computeDisabledArea(sourceCodeWithComments([disableLine, disableNextLine]));

		expect(result.areas).toStrictEqual([
			{
				comment: disableLine,
				end: lineColumn(3, -1),
				kind: "line",
				ruleId: "no-console",
				start: lineColumn(2, 0),
			},
			{
				comment: disableNextLine,
				end: lineColumn(6, -1),
				kind: "line",
				ruleId: "no-alert",
				start: lineColumn(5, 0),
			},
		]);
		expect(result.numberOfRelatedDisableDirectives.size).toBe(2);
	});

	it("should close matching eslint block directives and ignore mismatched enables", () => {
		expect.assertions(2);

		const disableAll = comment("eslint-disable", { loc: { end: lineColumn(1, 16), start: lineColumn(1, 0) } });
		const disableRule = comment("eslint-disable no-console", {
			loc: { end: lineColumn(2, 24), start: lineColumn(2, 0) },
		});
		const enableRule = comment("eslint-enable no-alert", {
			loc: { end: lineColumn(3, 23), start: lineColumn(3, 0) },
		});
		const enableAll = comment("eslint-enable", { loc: { end: lineColumn(4, 15), start: lineColumn(4, 0) } });

		const result = computeDisabledArea(sourceCodeWithComments([disableAll, disableRule, enableRule, enableAll]));

		expect(result.unusedEnableDirectives).toStrictEqual([{ comment: enableRule, ruleId: "no-alert" }]);
		expect(result.areas).toStrictEqual([
			{
				comment: disableAll,
				end: lineColumn(4, 0),
				kind: "block",
				ruleId: undefined,
				start: lineColumn(1, 0),
			},
			{
				comment: disableRule,
				end: lineColumn(4, 0),
				kind: "block",
				ruleId: "no-console",
				start: lineColumn(2, 0),
			},
		]);
	});

	it("should ignore directive comments that do not disable or enable rules", () => {
		expect.assertions(1);

		const unsupported = comment("istanbul ignore next", {
			loc: { end: lineColumn(1, 21), start: lineColumn(1, 0) },
		});
		const env = comment("eslint-env node", { loc: { end: lineColumn(1, 15), start: lineColumn(1, 0) } });
		const disable = comment("oxlint-disable no-console", {
			loc: { end: lineColumn(2, 29), start: lineColumn(2, 0) },
		});

		expect(computeDisabledArea(sourceCodeWithComments([unsupported, env, disable])).areas).toStrictEqual([
			{
				comment: disable,
				end: undefined,
				kind: "block",
				ruleId: "no-console",
				start: lineColumn(2, 0),
			},
		]);
	});
});
