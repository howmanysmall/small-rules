import { createHighlighter } from "shiki";

import type { Highlighter } from "shiki";

const TS_TYPE_CLEANUP = /<code[^>]*>(?<content>[\s\S]*)<\/code>/u;
let highlighter: Highlighter | undefined;

async function getHighlighterAsync(): Promise<Highlighter> {
	highlighter ??= await createHighlighter({
		langs: ["typescript"],
		themes: ["github-light", "dracula"],
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
		themes: { dark: "dracula", light: "github-light" },
	});

	const match = TS_TYPE_CLEANUP.exec(html);
	if (match?.groups === undefined) return html;

	return match.groups.content ?? html;
}
