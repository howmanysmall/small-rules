import type { ThemeRegistration } from "shiki";

interface SyntaxTones {
	readonly comment: string;
	readonly func: string;
	readonly ink: string;
	readonly keyword: string;
	readonly number: string;
	readonly punctuation: string;
	readonly string: string;
	readonly type: string;
	readonly well: string;
}

/**
 * Builds a Shiki theme from the site's syntax tones. Every tone is at least
 * 4.5:1 against the well and the paper, and none of them reuses the flagged
 * (vermilion) or allowed (violet) data colors. Keep in sync with the
 * `--syntax-*` tokens in `custom.css`.
 *
 * @param name - The Shiki theme name.
 * @param type - Whether the theme is for the light or dark scheme.
 * @param tones - The colors for each token kind.
 * @returns A Shiki theme registration.
 */
function createSyntaxTheme(name: string, type: "dark" | "light", tones: SyntaxTones): ThemeRegistration {
	return {
		name,
		colors: { "editor.background": tones.well, "editor.foreground": tones.ink },
		settings: [
			{ settings: { foreground: tones.ink } },
			{
				scope: ["comment", "punctuation.definition.comment"],
				settings: { fontStyle: "italic", foreground: tones.comment },
			},
			{
				scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control"],
				settings: { foreground: tones.keyword },
			},
			{
				scope: ["string", "string.quoted", "string.template", "punctuation.definition.string"],
				settings: { foreground: tones.string },
			},
			{
				scope: [
					"constant.numeric",
					"constant.language",
					"constant.character",
					"support.constant",
					"variable.other.constant",
				],
				settings: { foreground: tones.number },
			},
			{
				scope: [
					"entity.name.function",
					"support.function",
					"meta.function-call entity.name.function",
					"support.type.property-name",
					"meta.object-literal.key",
				],
				settings: { foreground: tones.func },
			},
			{
				scope: [
					"entity.name.type",
					"entity.name.class",
					"support.type",
					"support.class",
					"entity.other.inherited-class",
					"entity.name.tag",
				],
				settings: { foreground: tones.type },
			},
			{
				scope: ["entity.other.attribute-name", "entity.name.label"],
				settings: { foreground: tones.number },
			},
			{
				scope: ["punctuation", "meta.brace", "keyword.operator"],
				settings: { foreground: tones.punctuation },
			},
		],
		type,
	};
}

export const syntaxLightThemeName = "small-rules-light";
export const syntaxDarkThemeName = "small-rules-dark";

export const syntaxLightTheme = createSyntaxTheme(syntaxLightThemeName, "light", {
	comment: "#6b7079",
	func: "#1f5f99",
	ink: "#1a1c20",
	keyword: "#a3366b",
	number: "#8f5300",
	punctuation: "#555a63",
	string: "#2f6b2f",
	type: "#0f6b78",
	well: "#ffffff",
});

export const syntaxDarkTheme = createSyntaxTheme(syntaxDarkThemeName, "dark", {
	comment: "#8c9199",
	func: "#8cb8f0",
	ink: "#eeeeec",
	keyword: "#f08cb8",
	number: "#e8b765",
	punctuation: "#a9adb4",
	string: "#9fd28f",
	type: "#6fd0d8",
	well: "#171a1d",
});
