import { createHighlighter } from "shiki";

import type { Highlighter } from "shiki";

const TS_TYPE_CLEANUP = /<code[^>]*>(?<content>[\s\S]*)<\/code>/u;
let highlighter: Highlighter | undefined;

async function getHighlighterAsync(): Promise<Highlighter> {
	highlighter ??= await createHighlighter({
		langs: ["typescript"],
		themes: [
			{
				colors: { "editor.background": "#f8fafc", "editor.foreground": "#334155" },
				name: "small-rules-types-light",
				settings: [
					{ settings: { foreground: "#334155" } },
					{ scope: "variable.other.readwrite.ts", settings: { foreground: "#0e7490" } },
					{ scope: "entity.name.label.ts", settings: { foreground: "#b45309" } },
					{ scope: "string.quoted.double.ts", settings: { foreground: "#047857" } },
					{
						scope: ["keyword.operator.bitwise.ts", "keyword.operator.relational.ts"],
						settings: { foreground: "#7c3aed" },
					},
					{
						scope: [
							"punctuation.separator.label.ts",
							"punctuation.terminator.statement.ts",
							"punctuation.definition.block.ts",
						],
						settings: { foreground: "#64748b" },
					},
				],
				type: "light",
			},
			{
				colors: { "editor.background": "#101a24", "editor.foreground": "#d9e4ee" },
				name: "small-rules-types-dark",
				settings: [
					{ settings: { foreground: "#d9e4ee" } },
					{ scope: "variable.other.readwrite.ts", settings: { foreground: "#67e8f9" } },
					{ scope: "entity.name.label.ts", settings: { foreground: "#fcd34d" } },
					{ scope: "string.quoted.double.ts", settings: { foreground: "#6ee7b7" } },
					{
						scope: ["keyword.operator.bitwise.ts", "keyword.operator.relational.ts"],
						settings: { foreground: "#c4b5fd" },
					},
					{
						scope: [
							"punctuation.separator.label.ts",
							"punctuation.terminator.statement.ts",
							"punctuation.definition.block.ts",
						],
						settings: { foreground: "#94a3b8" },
					},
				],
				type: "dark",
			},
		],
	});
	return highlighter;
}

/**
 * Syntax-highlight a TypeScript type snippet using Shiki with dual themes.
 *
 * @param code - Raw TypeScript type string to highlight.
 * @returns HTML string with `<span>` elements carrying `--shiki-light` and
 * `--shiki-dark` CSS variables per token
 */
export async function highlightTypeScriptAsync(code: string): Promise<string> {
	const shiki = await getHighlighterAsync();
	const html = shiki.codeToHtml(code, {
		defaultColor: false,
		lang: "typescript",
		themes: { dark: "small-rules-types-dark", light: "small-rules-types-light" },
	});

	const match = TS_TYPE_CLEANUP.exec(html);
	if (match?.groups === undefined) return html;

	return match.groups.content ?? html;
}
