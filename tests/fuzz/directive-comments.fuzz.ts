import { expect } from "vitest";
import { fuzz } from "@vitiate/core";
import { FuzzedDataProvider } from "@vitiate/fuzzed-data-provider";

import { parseDirectiveComment, toRuleIdLocation } from "$oxc-utilities/directive-comments";

import type { Comment } from "oxlint-plugin-utilities";

const DIRECTIVE_KINDS: ReadonlyArray<string> = [
	"eslint",
	"eslint-env",
	"eslint-disable",
	"eslint-disable-line",
	"eslint-disable-next-line",
	"eslint-enable",
	"exported",
	"global",
	"globals",
	"oxlint",
	"oxlint-env",
	"oxlint-disable",
	"oxlint-disable-line",
	"oxlint-disable-next-line",
	"oxlint-enable",
];

const DIRECTIVE_WHITESPACE: ReadonlyArray<string> = [" ", "  ", "\t", "\t "];

function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}

function createComment(value: string, startLine = 1, startColumn = 0): Comment {
	const lines = value.split("\n");
	const endLine = startLine + lines.length - 1;
	const lastLine = lines.at(-1) ?? "";
	const endColumn = lines.length === 1 ? startColumn + value.length + 4 : lastLine.length + 2;

	return {
		end: value.length + 4,
		loc: {
			end: { column: endColumn, line: endLine },
			start: { column: startColumn, line: startLine },
		},
		range: [0, value.length + 4],
		start: 0,
		type: "Block",
		value,
	};
}

fuzz(
	"parses generated directives without losing fields",
	(data): void => {
		const provider = new FuzzedDataProvider(data);
		const kind = provider.pickValue(DIRECTIVE_KINDS);
		const value = `rule-${bytesToHex(provider.consumeBytes(24))}`;
		const description = `reason-${bytesToHex(provider.consumeBytes(24))}`;
		const whitespace = provider.pickValue(DIRECTIVE_WHITESPACE);
		const comment = createComment(`${whitespace}${kind}${whitespace}${value} -- ${description}${whitespace}`);

		expect(parseDirectiveComment(comment)).toStrictEqual({
			comment,
			description,
			kind,
			value,
		});
	},
	{ maxLen: 256 },
);

fuzz(
	"preserves parser invariants for arbitrary comment bytes",
	(data): void => {
		const comment = createComment(data.toString("utf8"));
		const parsed = parseDirectiveComment(comment);
		if (parsed === undefined) return;

		expect(DIRECTIVE_KINDS).toContain(parsed.kind);
		expect(parsed.comment).toBe(comment);
		expect(parsed.kind).toBe(parsed.kind.trim());
		expect(parsed.value).toBe(parsed.value?.trim());
		expect(parsed.description).toBe(parsed.description?.trim());
	},
	{ maxLen: 1024 },
);

fuzz(
	"locates generated rule identifiers exactly",
	(data): void => {
		const provider = new FuzzedDataProvider(data);
		const ruleId = `scope/rule-${bytesToHex(provider.consumeBytes(24))}`;
		const otherRuleId = `other-${bytesToHex(provider.consumeBytes(24))}`;
		const startLine = provider.consumeIntegralInRange(1, 10_000);
		const startColumn = provider.consumeIntegralInRange(0, 200);
		const laterLine = provider.consumeBoolean();
		const indentation = provider.pickValue(DIRECTIVE_WHITESPACE);
		const value = laterLine
			? `oxlint-disable ${otherRuleId},\n${indentation}${ruleId}`
			: `oxlint-disable ${otherRuleId}, ${ruleId}`;
		const comment = createComment(value, startLine, startColumn);
		const expectedLine = laterLine ? startLine + 1 : startLine;
		const expectedColumn = laterLine ? indentation.length : startColumn + 2 + value.indexOf(ruleId);

		expect(toRuleIdLocation(comment, ruleId)).toStrictEqual({
			end: { column: expectedColumn + ruleId.length, line: expectedLine },
			start: { column: expectedColumn, line: expectedLine },
		});
	},
	{ maxLen: 256 },
);
