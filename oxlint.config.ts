// oxlint-disable small-rules/prevent-abbreviations -- ok.

import { argv } from "node:process";
import { GLOB_SRC_EXT } from "@isentinel/eslint-config";
import { isentinel, translateRuleToOxlint } from "@isentinel/eslint-config/oxlint";
import { ALL_REACT_DOCTOR_RULES } from "oxlint-plugin-react-doctor";

import type { OxlintRules } from "@isentinel/eslint-config/oxlint";

type GetRecordValue<TRecord extends Record<string, unknown>> = TRecord[keyof TRecord];
type DummyRule = NonNullable<GetRecordValue<OxlintRules>>;
const CONFIGURATION_FILES = `*.config.${GLOB_SRC_EXT}`;

const reactDoctorRules = Object.fromEntries(
	Object.entries(ALL_REACT_DOCTOR_RULES).map(([key, value]) => {
		if (key.includes("nextjs-") || key.includes("preact-")) return [key, "off" as const];
		return [key, value];
	}),
);

type ConvertedRules = Record<string, DummyRule>;
function convertOxlintRules(oxlintRules: OxlintRules): ConvertedRules {
	const entries = Object.entries(oxlintRules);
	const conversion: ConvertedRules = {};

	for (const [rule, options] of entries) {
		if (options === undefined) continue;
		conversion[translateRuleToOxlint(rule)] = options;
	}

	// oxlint-disable-next-line small-rules/no-known-value-widening -- beyond dumb.
	return conversion;
}

const rules: OxlintRules = {
	"better-max-params/better-max-params": [
		"error",
		{
			constructor: 7,
			func: 7,
		},
	],
	"capitalized-comments": "off",
	"comment-length/limit-multi-line-comments": [
		"error",
		{
			semanticComments: ["v8 ignore"],
		},
	],
	"comment-length/limit-single-line-comments": [
		"error",
		{
			semanticComments: [
				"Modifications",
				"Vendored from",
				"oxlint-disable",
				"oxlint-disable-next-line",
				"biome-ignore",
				"eslint-disable-next-line",
			],
		},
	],
	complexity: "off",
	curly: ["error", "multi-line"],
	"default-case": "off",
	// this is literally not true -- it just worsens performance!
	"e18e/prefer-static-collator": "off",
	"flawless/arrow-return-style": "off",
	"flawless/max-lines-per-function": "off",
	"func-style": [
		"error",
		"declaration",
		{
			allowArrowFunctions: false,
			allowTypeAnnotation: true,
			overrides: {
				namedExports: "ignore",
			},
		},
	],
	"import/exports-last": "off",
	"import/extensions": "off",
	"import/group-exports": "off",
	"import/max-dependencies": "off",
	"import/no-default-export": "off",
	"import/no-named-export": "off",
	"import/no-relative-parent-imports": "off",
	"import/no-unassigned-import": [
		"error",
		{
			allow: ["**/*.css", "**/*.scss", "**/*.less", "**/*.sass", "@total-typescript/ts-reset"],
		},
	],
	"import/prefer-default-export": "off",
	"init-declarations": "off",
	"jsdoc/require-param-type": "off",
	"jsdoc/require-property-type": "off",
	"jsdoc/require-returns-type": "off",
	"max-lines": "off",
	"max-lines-per-function": "off",
	"max-params": "off",
	"max-statements": "off",
	"new-cap": "off",
	"no-bitwise": "off",
	"no-continue": "off",
	"no-duplicate-imports": "off",
	"no-magic-numbers": "off",
	"no-nested-ternary": "off",
	"no-plusplus": "off",
	"no-ternary": "off",
	"no-undefined": "off",
	"no-underscore-dangle": "off",
	"node-js/prefer-global/buffer": "off",
	"node/callback-return": "off",
	"node/no-sync": "off",
	"object-shorthand": ["error"],
	"one-var": "off",
	"oxc/no-async-await": "off",
	"oxc/no-const-enum": "off",
	"oxc/no-optional-chaining": "off",
	"oxc/no-rest-spread-properties": "off",
	"perfectionist/sort-modules": "off",
	"prefer-destructuring": "error",
	"prefer-named-capture-group": "off",
	"react-perf/jsx-no-new-function-as-prop": "off",
	"react/jsx-curly-brace-presence": [
		"error",
		{
			children: "always",
		},
	],
	"react/jsx-filename-extension": [
		"error",
		{
			extensions: ["jsx", "tsx"],
			ignoreFilesWithoutCode: true,
		},
	],
	"react/react-in-jsx-scope": "off",
	"small-rules/array-type-generic": "error",
	"small-rules/ban-instances": "off",
	"small-rules/ban-react-fc": "off",
	"small-rules/ban-types": [
		"error",
		{
			bannedTypes: {
				Omit: "Except",
			},
		},
	],
	"small-rules/consistent-compound-words": [
		"error",
		{
			allowList: {},
			checkProperties: false,
			checkShorthandProperties: false,
			checkVariables: false,
			extendDefaultReplacements: false,
			replacements: {},
		},
	],
	"small-rules/directive-disable-enable-pair": "error",
	"small-rules/directive-no-aggregating-enable": "error",
	"small-rules/directive-no-duplicate-disable": "error",
	"small-rules/directive-no-restricted-disable": "error",
	"small-rules/directive-no-unlimited-disable": "error",
	"small-rules/directive-no-unused-enable": "error",
	"small-rules/directive-no-use": "error",
	"small-rules/directive-require-description": "error",
	"small-rules/enforce-ianitor-check-type": "off",
	"small-rules/isolated-functions": [
		"error",
		{
			comments: [],
			functions: [],
			overrideGlobals: {},
			selectors: [],
		},
	],
	"small-rules/memoized-effect-dependencies": "off",
	"small-rules/no-adjust-state-on-prop-change": "off",
	"small-rules/no-array-constructor-elements": [
		"error",
		{
			environment: "standard",
			requireExplicitGenericOnNewArray: true,
		},
	],
	"small-rules/no-array-constructor-index-assignment": "error",
	"small-rules/no-array-size-assignment": ["error", { allowAutofix: false }],
	"small-rules/no-async-in-system": [
		"error",
		{
			additionalSystemTypeNames: [],
			callbackParameterTypes: [],
			synchronousCallbacks: [],
		},
	],
	"small-rules/no-cascading-set-state": "off",
	"small-rules/no-chain-state-updates": "off",
	"small-rules/no-chained-type-assertions": "error",
	"small-rules/no-color3-constructor": "off",
	"small-rules/no-conditional-empty-object-spread": "error",
	"small-rules/no-constant-condition-with-break": [
		"error",
		{
			loopExitCalls: ["break", "return", "throw"],
		},
	],
	"small-rules/no-dead-store": "error",
	"small-rules/no-derived-state": "off",
	"small-rules/no-error": "off",
	"small-rules/no-event-handler": "off",
	"small-rules/no-events-in-events-callback": "off",
	"small-rules/no-external-store-subscription": "off",
	"small-rules/no-filter-map-chain": "off",
	"small-rules/no-floating-point-equality": "error",
	"small-rules/no-giant-component": "off",
	"small-rules/no-god-components": "off",
	"small-rules/no-ianitor-in-function-body": "off",
	"small-rules/no-ianitor-success-access": "off",
	"small-rules/no-identity-map": "off",
	"small-rules/no-increment-decrement": ["error", { allowAutofix: true }],
	"small-rules/no-initialize-state": "off",
	"small-rules/no-inline-property-on-memo-component": "off",
	"small-rules/no-instance-methods-without-this": "off",
	"small-rules/no-known-value-widening": "error",
	"small-rules/no-module-mocking": "error",
	"small-rules/no-native-properties-spread": "off",
	"small-rules/no-new-instance-in-use-memo": "off",
	"small-rules/no-object-parameters": "error",
	"small-rules/no-pass-data-to-parent": "off",
	"small-rules/no-pass-live-state-to-parent": "off",
	"small-rules/no-print": "off",
	"small-rules/no-redundant-aspect-ratio-constraint": "off",
	"small-rules/no-reflect-apply": "error",
	"small-rules/no-reflect-get": "error",
	"small-rules/no-render-helper-functions": "off",
	"small-rules/no-reset-all-state-on-prop-change": "off",
	"small-rules/no-restricted-property-assignment": "off",
	"small-rules/no-runtime-typeof": "error",
	"small-rules/no-shape-in-symbol-names": "error",
	"small-rules/no-spec-file-extension": "error",
	"small-rules/no-static-react-create-element": "error",
	"small-rules/no-table-create-map": "off",
	"small-rules/no-task-wait": "off",
	"small-rules/no-trivial-assertions": "off",
	"small-rules/no-underscore-react-props": "off",
	"small-rules/no-unknown-parameters": "error",
	"small-rules/no-unknown-returns": "error",
	"small-rules/no-unknown-type-aliases": "error",
	"small-rules/no-unsafe-dictionary-type": "error",
	"small-rules/no-unused-imports": "error",
	"small-rules/no-unused-use-memo": "off",
	"small-rules/no-use-memo-simple-expression": "off",
	"small-rules/no-useless-constants": "error",
	"small-rules/no-useless-default": "off",
	"small-rules/no-useless-use-effect": "off",
	"small-rules/no-useless-use-memo": "off",
	"small-rules/no-useless-use-spring": "off",
	"small-rules/no-variadic-spread": "error",
	"small-rules/no-warn": "off",
	"small-rules/no-widen-then-assert": "error",
	"small-rules/only-type-imports": "off",
	"small-rules/prefer-constant-dispatch": "off",
	"small-rules/prefer-context-stack": "off",
	"small-rules/prefer-direct-hook-imports": "off",
	"small-rules/prefer-early-return": "error",
	"small-rules/prefer-expect-assertions": "off",
	"small-rules/prefer-hoisted-jsx-elements": "off",
	"small-rules/prefer-hoisted-jsx-object-properties": "off",
	"small-rules/prefer-idiv": "off",
	"small-rules/prefer-local-portal-component": "off",
	"small-rules/prefer-math-min-max": "off",
	"small-rules/prefer-modding-inspect": "off",
	"small-rules/prefer-module-scope-constants": "off",
	"small-rules/prefer-padding-components": "off",
	"small-rules/prefer-pascal-case-enums": "error",
	"small-rules/prefer-sequence-overloads": "off",
	"small-rules/prefer-single-world-query": "off",
	"small-rules/prefer-ternary-conditional-rendering": "off",
	"small-rules/prefer-udim2-shorthand": "off",
	"small-rules/prefer-use-reducer": "off",
	"small-rules/prevent-abbreviations": [
		"error",
		{
			allowPropertyAccess: [
				"char",
				"InstanceProps",
				"InferProps",
				"PropsWithoutRef",
				"ComponentProps",
				"screenProps",
				"getScreenProps",
				"PropsWithChildren",
				"args",
			],
			ignoreShorthands: ["InferProps", "InstanceProps", "PropsWithoutRef", "ComponentProps"],
			shorthands: {
				"*Props": "*Properties",
				"*props": "*properties",
				args: "parameters",
				btn: "button",
				char: "character",
				dt: "deltaTime",
				plr: "player",
				str: "string",
			},
		},
	],
	"small-rules/react-hooks-strict-return": "off",
	"small-rules/require-async-suffix": "error",
	"small-rules/require-module-level-instantiation": "off",
	"small-rules/require-named-effect-functions": "off",
	"small-rules/require-paired-calls": "error",
	"small-rules/require-react-component-keys": "off",
	"small-rules/require-react-display-names": "off",
	"small-rules/require-safety-comment-for-type-assertion": "error",
	"small-rules/require-switch-case-braces": [
		"error",
		{
			metric: "lines",
		},
	],
	"small-rules/require-throw-error-capture": [
		"off",
		{
			allow: [{ name: "ValidationError", from: "package", package: "@cliffy/command" }],
		},
	],
	"small-rules/require-unicode-regex": "error",
	"small-rules/rerender-memo-with-default-value": "off",
	"small-rules/strict-component-boundaries": ["error", { allow: [] }],
	"small-rules/use-exhaustive-dependencies": "off",
	"small-rules/use-hook-at-top-level": "off",
	// shittier
	"sonar/destructuring-assignment-syntax": "off",
	"sonar/no-nested-incdec": "off",
	"sort-imports": [
		"off",
		{
			allowSeparatedGroups: true,
			ignoreCase: true,
			ignoreDeclarationSort: true,
			ignoreMemberSort: false,
		},
	],
	"sort-keys": [
		"off",
		"asc",
		{
			allowLineSeparatedGroups: true,
			caseSensitive: true,
			minKeys: 2,
			natural: true,
		},
	],
	"style/jsx-curly-brace-presence": "off",
	"style/padding-line-between-statements": [
		"error",
		{
			blankLine: "never",
			next: "*",
			prev: "directive",
		},
	],
	"ts/array-type": "off",
	"ts/prefer-readonly-parameter-types": "off",
	"ts/switch-exhaustiveness-check": [
		"error",
		{
			allowDefaultCaseForExhaustiveSwitch: true,
			considerDefaultExhaustiveForUnions: true,
			requireDefaultForNonUnion: false,
		},
	],
	"unicorn-js/name-replacements": "off",
	"unicorn-js/no-break-in-nested-loop": "off",
	"unicorn-js/no-keyword-prefix": "off",
	"unicorn-js/no-unreadable-new-expression": "off",
	"unicorn-js/prefer-global-number-constants": "off",
	"unicorn/catch-error-name": ["warn", { name: "error" }],
	"unicorn/no-array-callback-reference": "off",
	"unicorn/no-new-array": "error",
	"unicorn/no-process-exit": "off",
	// shit rule that breaks everything:
	"unicorn/no-useless-undefined": "off",
	"unicorn/numeric-separators-style": "off",
	"unicorn/prefer-event-target": "off",
	"unicorn/prefer-math-trunc": "off",
	"unicorn/switch-case-braces": "off",
	"unused-imports/no-unused-vars": "off",
	"vue/no-dupe-keys": "off",
};

const reactTestRules: OxlintRules = {
	"react-perf/jsx-no-new-array-as-prop": "off",
	"react-perf/jsx-no-new-function-as-prop": "off",
	"react-perf/jsx-no-new-object-as-prop": "off",
	"react/no-multi-comp": "off",
	"react/no-unknown-property": "off",
	"react/only-export-components": "off",
};

const configuration = isentinel(
	{
		name: "small-rules",
		categories: {
			correctness: "error",
			nursery: "error",
			pedantic: "error",
			perf: "error",
			restriction: "error",
			style: "error",
			suspicious: "error",
		},
		eslintPlugin: false,
		formatters: {
			css: false,
			graphql: true,
			html: true,
			lua: false,
			markdown: false,
			oxfmtOptions: {
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
		ignores: [
			"**/{dist,do-not-sync-ever,node_modules}/**",
			"**/*.js",
			"scripts/dupes-viewer.html",
			"scripts/clis/**/*.ts",
			"src/generated/**",
		],
		options: {
			denyWarnings: true,
			maxWarnings: 0,
			reportUnusedDisableDirectives: "deny",
			respectEslintDisableDirectives: false,
			typeAware: true,
			typeCheck: !argv.includes("--lsp"),
		},
		react: true,
		roblox: false,
		rules,
		settings: {
			react: { version: "19.2.8" },
			vitest: { typecheck: true },
		},
		spellCheck: false,
		stylistic: true,
	},
	{
		name: "small-rules/native-id-length",
		files: ["**/*.{js,jsx,ts,tsx}"],
		rules: {
			"eslint-js/id-length": "off",
			"id-length": [
				"error",
				{
					exceptionPatterns: ["^_"],
					exceptions: ["_", "x", "y", "z", "a", "b", "$"],
					max: 45,
				},
			],
		},
	},
	{
		name: "small-rules/react-doctor",
		files: ["**/*.{ts,tsx}"],
		jsPlugins: [{ name: "react-doctor", specifier: "oxlint-plugin-react-doctor" }],
		rules: {
			...reactDoctorRules,
			"react-doctor/jsx-curly-brace-presence": "off",
			"react-doctor/react-in-jsx-scope": "off",
		},
	},
	{
		name: "small-rules/disable-stupid-rule",
		files: ["src/rules/react/no-adjust-state-on-prop-change.ts"],
		rules: { "sonar/file-name-differ-from-class": "off" },
	},
	{
		name: "small-rules/documentation",
		env: {
			astro: true,
			browser: true,
			node: true,
		},
		files: ["documentation/**/*"],
	},
	{
		name: "small-rules/allow-git",
		// rule-newness.ts spawns git to classify rules; the binary is a fixed
		// system dependency.
		files: ["documentation/src/data/rule-newness.ts"],
		rules: {
			"no-console": "off",
			"sonar/no-os-command-from-path": "off",
		},
	},
	{
		name: "small-rules/astro",
		files: ["documentation/**/*.astro"],
		rules: {
			...convertOxlintRules(rules),
			"import/unambiguous": "off",
			"small-rules/no-unused-imports": "off",
			"small-rules/prevent-abbreviations": "off",
			"sonar/unused-import": "off",
			"unused-imports/no-unused-imports": "off",
		},
	},
	{
		name: "small-rules/allow-satteri-optional-peers",
		files: ["documentation/src/types/satteri-optional-peers.d.ts"],
		rules: {
			"import/unambiguous": "off",
			"small-rules/no-unused-imports": "off",
			"typescript/no-redundant-type-constituents": "off",
		},
	},
	{
		name: "small-rules/allow-top-level-await",
		files: ["documentation/**/*.astro", "scripts/**/*.{ts,tsx}", CONFIGURATION_FILES],
		rules: { "node/no-top-level-await": "off" },
	},
	{
		name: "small-rules/allow-console",
		files: ["scripts/**/*.{ts,tsx}", CONFIGURATION_FILES],
		rules: { "no-console": "off" },
	},
	{
		name: "small-rules/these-are-fine",
		files: [CONFIGURATION_FILES],
		rules: {
			"small-rules/no-unsafe-dictionary-type": "off",
		},
	},
	{
		name: "small-rules/vitest",
		files: ["tests/**/*.test.{tsx,ts}"],
		plugins: ["vitest"],
		rules: {
			"max-lines": "off",
			"max-lines-per-function": "off",
			"no-console": "error",
			"no-non-null-assertion": "off",
			"small-rules/prefer-expect-assertions": [
				"error",
				{
					additionalAssertionFunctions: ["expectRecord", "expectArray", "expectPresent"],
					additionalExpectCallNames: ["expectRecord", "expectArray", "expectPresent"],
				},
			],
			"small-rules/prevent-abbreviations": "off",
			"unicorn-js/no-incorrect-template-string-interpolation": "off",
			"unicorn/no-null": "off",
			"vitest/consistent-each-for": "error",
			"vitest/consistent-test-filename": "error",
			"vitest/consistent-test-it": "error",
			"vitest/consistent-vitest-vi": "error",
			"vitest/expect-expect": "error",
			"vitest/hoisted-apis-on-top": "error",
			"vitest/max-expects": "off",
			"vitest/max-nested-describe": "error",
			"vitest/no-alias-methods": "error",
			"vitest/no-commented-out-tests": "error",
			"vitest/no-conditional-expect": "error",
			"vitest/no-conditional-in-test": "error",
			"vitest/no-conditional-tests": "error",
			"vitest/no-disabled-tests": "error",
			"vitest/no-duplicate-hooks": "error",
			"vitest/no-focused-tests": "error",
			"vitest/no-hooks": "error",
			"vitest/no-identical-title": "error",
			"vitest/no-import-node-test": "error",
			"vitest/no-importing-vitest-globals": "off",
			"vitest/no-interpolation-in-snapshots": "error",
			"vitest/no-large-snapshots": "error",
			"vitest/no-mocks-import": "error",
			"vitest/prefer-called-exactly-once-with": "error",
			"vitest/prefer-called-once": "error",
			"vitest/prefer-called-times": "error",
			"vitest/prefer-describe-function-title": "off",
			"vitest/prefer-expect-assertions": "error",
			"vitest/prefer-expect-type-of": "error",
			"vitest/prefer-import-in-mock": "error",
			"vitest/prefer-importing-vitest-globals": "error",
			"vitest/prefer-strict-boolean-matchers": "error",
			"vitest/prefer-to-be-falsy": "off",
			"vitest/prefer-to-be-object": "error",
			"vitest/prefer-to-be-truthy": "off",
			"vitest/prefer-to-contain": "error",
			"vitest/prefer-todo": "error",
			"vitest/require-awaited-expect-poll": "error",
			"vitest/require-hook": "off",
			"vitest/require-local-test-context-for-concurrent-snapshots": "error",
			"vitest/require-mock-type-parameters": "error",
			"vitest/require-test-timeout": "off",
			"vitest/require-top-level-describe": "off",
			"vitest/valid-expect": "error",
			"vitest/valid-title": "error",
			"vitest/warn-todo": "error",
		},
	},
	{
		name: "small-rules/allow-default-export",
		files: ["tests/fixtures/**/*.{ts,tsx}", CONFIGURATION_FILES],
		rules: { "import/no-default-export": "off" },
	},
	{
		name: "small-rules/allow-null",
		files: ["vitest*.config.ts"],
		rules: { "unicorn/no-null": "off" },
	},
	{
		name: "small-rules/fixtures",
		files: ["tests/fixtures/**/*.{ts,tsx}"],
		rules: {
			...reactTestRules,
			"eslint-js/no-restricted-syntax": "off",
			"small-rules/no-unknown-parameters": "off",
			"small-rules/no-unknown-returns": "off",
			"small-rules/no-unsafe-dictionary-type": "off",
			"typescript/ban-ts-comment": "off",
		},
	},
	{
		name: "small-rules/documentation-react-tests",
		files: ["documentation/tests/**/*.test.tsx"],
		rules: reactTestRules,
	},
	{
		name: "small-rules/allow-unambiguous-import",
		files: ["**/*.d.ts"],
		rules: { "import/unambiguous": "off" },
	},
	{
		name: "small-rules/react",
		files: ["documentation/src/**/*.{ts,tsx}"],
		plugins: ["react", "react-perf", "jsx-a11y"],
		rules: {
			"react-perf/jsx-no-new-function-as-prop": "off",
			"react/jsx-curly-brace-presence": [
				"error",
				{
					children: "always",
				},
			],
			"react/jsx-filename-extension": [
				"error",
				{
					extensions: ["jsx", "tsx"],
					ignoreFilesWithoutCode: true,
				},
			],
			"react/jsx-max-depth": ["error", { max: 3 }],
			"small-rules/ban-react-fc": "error",
			"small-rules/memoized-effect-dependencies": "error",
			"small-rules/no-static-react-create-element": ["error", { environment: "standard" }],
			"small-rules/prefer-hoisted-jsx-elements": [
				"error",
				{
					additionalHoistableComponents: [],
					additionalStaticFactories: [],
					environment: "standard",
				},
			],
			"small-rules/prefer-hoisted-jsx-object-properties": "error",
			"small-rules/require-named-effect-functions": [
				"error",
				{
					environment: "standard",
					hooks: [
						{ name: "useEffect", allowAsync: false },
						{ name: "useLayoutEffect", allowAsync: false },
						{ name: "useInsertionEffect", allowAsync: false },
					],
				},
			],
			"small-rules/require-react-display-names": ["error", { environment: "standard" }],
		},
	},
);

export default configuration;
