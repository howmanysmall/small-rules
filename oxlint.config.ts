// oxlint-disable small-rules/prevent-abbreviations -- ok.
import { isentinel } from "@isentinel/eslint-config/oxlint";
import { ALL_REACT_DOCTOR_RULES } from "oxlint-plugin-react-doctor";

const reactDoctorRules = Object.fromEntries(
	Object.entries(ALL_REACT_DOCTOR_RULES).map(([key, value]) => {
		if (key.includes("nextjs-") || key.includes("preact-")) return [key, "off" as const];
		return [key, value];
	}),
);

const config = isentinel(
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
		ignores: [
			"**/{dist,do-not-sync-ever,node_modules}/**",
			"**/*.js",
			"scripts/dupes-viewer.html",
			"scripts/clis/**/*.ts",
		],
		roblox: false,
		rules: {
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
					semanticComments: ["v8 ignore next"],
				},
			],
			complexity: "off",
			curly: ["error", "multi-line"],
			"default-case": "off",
			"id-length": [
				"error",
				{
					exceptionPatterns: ["^_"],
					exceptions: ["_", "x", "y", "z", "a", "b", "$"],
					max: 45,
				},
			],
			"import/exports-last": "off",
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
			"node/callback-return": "off",
			"node/no-sync": "off",
			"one-var": "off",
			"oxc/no-async-await": "off",
			"oxc/no-const-enum": "off",
			"oxc/no-optional-chaining": "off",
			"oxc/no-rest-spread-properties": "off",
			"prefer-named-capture-group": "off",
			"small-rules/ban-instances": "off",
			"small-rules/ban-react-fc": "off",
			"small-rules/enforce-ianitor-check-type": "off",
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
			"ts/prefer-readonly-parameter-types": "off",
			"ts/switch-exhaustiveness-check": [
				"error",
				{
					allowDefaultCaseForExhaustiveSwitch: true,
					considerDefaultExhaustiveForUnions: true,
					requireDefaultForNonUnion: false,
				},
			],
			"unicorn/no-array-callback-reference": "off",
			"unicorn/no-new-array": "error",
			"unicorn/no-process-exit": "off",
			"unicorn/numeric-separators-style": "off",
			"unicorn/prefer-event-target": "off",
			"unicorn/prefer-math-trunc": "off",
			"unicorn/switch-case-braces": "off",
			"unused-imports/no-unused-vars": "off",
			"vue/no-dupe-keys": "off",
		},
		settings: {
			vitest: { typecheck: true },
		},
		spellCheck: false,
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
);

export default config;
