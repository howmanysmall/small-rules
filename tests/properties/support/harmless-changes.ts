import { fc } from "@fast-check/vitest";
import { Predicate } from "effect";

import { traverseAst } from "$test/rule-harness/ast";
import { applyFixes } from "$test/rule-harness/fixes";
import { parseCase } from "$test/rule-harness/parse";

import { isGeneratedIdentifier } from "./syntax";

import type { Fix, HarnessNode, NormalizedValidCase, Range } from "$test/rule-harness/types";

/**
 * Text that can sit on its own line between two statements without changing
 * what the program means. JSDoc is left out because some rules read it.
 */
export const lineSeparatorArbitrary = fc.constantFrom("", "\t", "// harmless note", "/* harmless note */");

/**
 * Puts a separator on its own line at every line break, cycling through the
 * given separators.
 *
 * Generated programs only break lines between statements or class members,
 * never inside a literal or a JSX child list, so every insertion point sits
 * between two statements or members.
 *
 * @param code - A generated program.
 * @param separators - The separators to cycle through.
 * @returns The program with a separator line at every line break.
 */
export function separateLines(code: string, separators: ReadonlyArray<string>): string {
	const lines = code.split("\n");
	let output = lines[0] ?? "";
	for (let index = 1; index < lines.length; index += 1) {
		const separator = separators[(index - 1) % separators.length] ?? "";
		output += `\n${separator}\n${lines[index] ?? ""}`;
	}
	return output;
}

/** Suffixes that no generated name ends with, so renaming stays one-to-one. */
export const renameSuffixArbitrary = fc.constantFrom("Alias", "Renamed", "Second");

/**
 * Appends `suffix` to every identifier the generators built from dictionary
 * words, wherever it appears: bindings, references, property keys, members,
 * and type names. Names from rule templates and the platform stay as they
 * are, so every occurrence of one name is treated the same way.
 *
 * @param testCase - A generated program that parses.
 * @param suffix - The text to append to each generated name.
 * @returns The renamed program.
 */
export function renameGeneratedIdentifiers(testCase: NormalizedValidCase, suffix: string): string {
	const endings = new Set<number>();
	traverseAst(parseCase(testCase).ast, {
		Identifier(node: HarnessNode): void {
			if (Predicate.isString(node.name) && isGeneratedIdentifier(node.name)) endings.add(node.range[1]);
		},
	});

	const insertions = Array.from(endings, (end): Fix => {
		const range: Range = [end, end];
		return { range, text: suffix };
	});
	return applyFixes(testCase.code, insertions) ?? testCase.code;
}
