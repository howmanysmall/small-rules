/**
 * Lightweight regex-based JSON syntax highlighter.
 *
 * Tokenizes a JSON string into segments with CSS class names for syntax highlighting. Uses two passes: first tokenize,
 * then promote string tokens followed by `:` to "key" tokens. No external dependencies, no AST parser.
 */

const JSON_TOKEN = new RegExp(
	[
		/"(?:[^"\\]|\\.)*"/u.source,
		"true",
		"false",
		"null",
		/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.source,
		String.raw`[{}[\]:,]`,
		String.raw`\s+`,
	].join("|"),
	"gu",
);

const JSON_DIGIT_START = /^-?\d/u;
const JSON_WHITESPACE_ONLY = /^\s+$/u;

export interface HighlightToken {
	readonly className: string | undefined;
	readonly text: string;
}

function classifyToken(text: string): string | undefined {
	if (text.startsWith('"')) return "json-string";
	if (text === "true" || text === "false") return "json-boolean";
	if (text === "null") return "json-null";
	if (JSON_DIGIT_START.test(text)) return "json-number";
	if (JSON_WHITESPACE_ONLY.test(text)) return undefined;
	return "json-punctuation";
}

function isKey(raw: Array<HighlightToken>, index: number): boolean {
	let lookahead = index + 1;
	while (lookahead < raw.length) {
		const current: HighlightToken | undefined = raw[lookahead];
		if (current === undefined || current.className !== undefined) break;
		lookahead += 1;
	}
	const token: HighlightToken | undefined = raw[lookahead];
	return token?.text === ":";
}

export function tokenizeJson(json: string): Array<HighlightToken> {
	const raw: Array<HighlightToken> = [];
	const result: Array<HighlightToken> = [];

	for (const match of json.matchAll(JSON_TOKEN)) {
		const [text] = match;
		const className = classifyToken(text);
		raw.push({ className, text });
	}

	for (const token of raw) {
		if (token.className === "json-string" && isKey(raw, raw.indexOf(token))) {
			result.push({ className: "json-key", text: token.text });
		} else {
			result.push(token);
		}
	}

	return result;
}
