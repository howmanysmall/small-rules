import { isentinel } from "@isentinel/eslint-config";
import { configs as astroConfigs } from "eslint-plugin-astro";

const configuration = isentinel(
	{
		formatters: {
			css: true,
			graphql: true,
			html: true,
			json: true,
			lua: false,
			markdown: false,
			oxfmtOptions: {
				$schema: "node_modules/oxfmt/configuration_schema.json",
				arrowParens: "always",
				bracketSameLine: false,
				bracketSpacing: true,
				embeddedLanguageFormatting: "auto",
				endOfLine: "lf",
				htmlWhitespaceSensitivity: "css",
				ignorePatterns: [
					"**/*.{md,toml,js,snap,toml}",
					"**/do-not-sync-ever/**",
					".tsbuildinfo*",
					"**/*-lock.{json,yaml}",
					"**/ses_*.json",
					"**/*.yaml",
				],
				insertFinalNewline: true,
				jsdoc: false,
				jsxSingleQuote: false,
				objectWrap: "preserve",
				overrides: [
					{
						files: ["**/*.{yaml,yml}"],
						options: {
							tabWidth: 2,
							useTabs: false,
						},
					},
					{
						files: ["**/*.jsonc"],
						options: { trailingComma: "all" },
					},
					{
						files: ["biome.jsonc", ".oxlintrc.json", "knip.jsonc"],
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
				sortPackageJson: false,
				sortTailwindcss: true,
				tabWidth: 4,
				trailingComma: "all",
				useTabs: true,
			},
		},
		jsdoc: true,
		jsonc: true,
		markdown: false,
		oxlint: true,
		oxlintWarnDeadRules: true,
		pnpm: true,
		roblox: false,
		rules: {
			"sonar/no-redundant-optional": "off",
			"ts/prefer-destructuring": "off",
			"unicorn/no-non-function-verb-prefix": "off",
		},
		spellCheck: false,
		test: { vitest: true },
		toml: {
			overrides: {
				"toml/array-bracket-spacing": "off",
				"toml/array-element-newline": "off",
				"toml/indent": ["error", "tab"],
				"toml/padding-line-between-pairs": "off",
				"toml/padding-line-between-tables": "off",
			},
		},
		type: "package",
		typescript: {
			outOfProjectFiles: ["*.js"],
		},
		yaml: {
			overrides: {
				"yaml/indent": "error",
				"yaml/quotes": ["error", { prefer: "double" }],
			},
		},
	},
	...astroConfigs.recommended,
	{
		name: "small-rules/package-json",
		files: ["**/package.json", "!package.json"],
		rules: {
			"package-json/require-attribution": "off",
			"package-json/require-bugs": "off",
			"package-json/require-description": "off",
			"package-json/require-engines": "off",
			"package-json/require-exports": "off",
			"package-json/require-files": "off",
			"package-json/require-homepage": "off",
			"package-json/require-keywords": "off",
			"package-json/require-license": "off",
			"package-json/require-repository": "off",
			"package-json/require-sideEffects": "off",
			"package-json/require-types": "off",
			"package-json/require-version": "off",
		},
	},
	{
		name: "small-rules/ignores",
		ignores: ["{.omo,.rumdl_cache}/**", ".github/workflows/react-doctor.yml", "**/*.js"],
	},
	{
		name: "small-rules/block-no-unsafe-string-replacement",
		files: ["src/**"],
		rules: { "unicorn/no-unsafe-string-replacement": "off" },
	},
);

export default configuration;
