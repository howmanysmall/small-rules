import type { OxfmtOptions } from "@isentinel/eslint-config";

const DEFAULT_CONFIGURATION = {
	arrowParens: "always",
	bracketSameLine: false,
	bracketSpacing: true,
	embeddedLanguageFormatting: "auto",
	endOfLine: "lf",
	htmlWhitespaceSensitivity: "css",
	ignorePatterns: [
		"src/generated/",
		"**/*.{md,toml,js,yml,toml}",
		"tests/fixtures/**/{invalid-*,*-invalid}/**/*.json",
		"**/do-not-sync-ever/**",
		".tsbuildinfo*",
		"**/*-lock.json",
		"**/ses_*.json",
		".mise/",
	],
	insertFinalNewline: true,
	jsdoc: false,
	jsxSingleQuote: false,
	objectWrap: "preserve",
	overrides: [
		{
			files: ["**/*.jsonc"],
			options: { trailingComma: "all" },
		},
		{
			files: ["biome.jsonc", ".oxlintrc.json"],
			options: { trailingComma: "none" },
		},
		{
			files: [".oxfmtrc.json"],
			options: { trailingComma: "all" },
		},
	],
	printWidth: 120,
	proseWrap: "preserve",
	quoteProps: "as-needed",
	semi: true,
	singleAttributePerLine: false,
	singleQuote: false,
	sortImports: {
		customGroups: [
			{
				elementNamePattern: [
					"react",
					"react-dom",
					"react-**",
					"next",
					"next/**",
					"vue",
					"vue-**",
					"@vue/**",
					"svelte",
					"svelte/**",
					"@sveltejs/**",
					"solid-js",
					"@solidjs/**",
				],
				groupName: "framework",
				modifiers: ["value"],
				selector: "external",
			},
			{
				elementNamePattern: [
					"vitest",
					"@vitest/**",
					"jest",
					"@jest/**",
					"@testing-library/**",
					"msw",
					"msw/**",
					"playwright",
					"@playwright/**",
					"cypress",
					"@cypress/**",
				],
				groupName: "testing",
				modifiers: ["value"],
				selector: "external",
			},
		],
		groups: [
			"side_effect",
			"side_effect_style",
			{ newlinesBetween: true },

			"value-builtin",
			"framework",
			"testing",
			"value-external",
			{ newlinesBetween: true },

			["value-internal", "value-subpath"],
			{ newlinesBetween: true },

			["value-parent", "value-sibling", "value-index"],
			{ newlinesBetween: true },

			"style",
			{ newlinesBetween: true },

			["type-builtin", "type-external"],
			{ newlinesBetween: true },

			["type-internal", "type-subpath"],
			{ newlinesBetween: true },

			["type-parent", "type-sibling", "type-index"],
			"type-import",
			{ newlinesBetween: true },

			"unknown",
		],
		ignoreCase: true,
		internalPattern: ["$", "~/"],
		newlinesBetween: false,
		order: "asc",
		partitionByComment: false,
		partitionByNewline: false,
		sortSideEffects: false,
	},
	sortPackageJson: false,
	sortTailwindcss: true,
	tabWidth: 4,
	trailingComma: "all",
	useTabs: true,
} satisfies OxfmtOptions;

export async function getOxfmtConfigurationAsync(): Promise<OxfmtOptions> {
	try {
		const { up } = await import("empathic/find");
		const filePath = up(".oxfmtrc.json");
		if (filePath === undefined) return DEFAULT_CONFIGURATION;

		const { readFile } = await import("node:fs/promises");
		const { parseJSONC } = await import("confbox");
		const jsonc = parseJSONC(await readFile(filePath, "utf8"));

		const { isOxfmtConfiguration } = await import("./oxfmt-types.ts");
		return isOxfmtConfiguration.allows(jsonc) ? jsonc : DEFAULT_CONFIGURATION;
	} catch {
		return DEFAULT_CONFIGURATION;
	}
}
