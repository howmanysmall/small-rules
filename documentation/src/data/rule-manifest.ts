import type smallRules from "$small-rules";

export type RuleName = keyof typeof smallRules.rules;
export type RuleCategoryKey = "general" | "naming" | "react" | "roblox";

export interface RuleManifestEntry {
	readonly exampleExemption?: string;
	readonly name: RuleName;
}

export interface RuleCategoryManifest {
	readonly description: string;
	readonly key: RuleCategoryKey;
	readonly label: string;
	readonly rules: ReadonlyArray<RuleManifestEntry>;
}

export interface RuleManifest {
	readonly categories: ReadonlyArray<RuleCategoryManifest>;
}

export function defineRuleManifest<const TManifest extends RuleManifest>(manifest: TManifest): TManifest {
	return manifest;
}

export const ruleManifest = defineRuleManifest({
	categories: [
		{
			description: "Rules for React Luau components, hooks, and JSX patterns.",
			key: "react",
			label: "React Rules",
			rules: [
				{ name: "ban-react-fc" },
				{ name: "memoized-effect-dependencies" },
				{ name: "no-cascading-set-state" },
				{ name: "no-giant-component" },
				{ name: "no-god-components" },
				{ name: "no-inline-property-on-memo-component" },
				{ name: "no-new-instance-in-use-memo" },
				{ name: "no-render-helper-functions" },
				{ name: "no-static-react-create-element" },
				{ name: "no-underscore-react-props" },
				{ name: "no-unused-use-memo" },
				{ name: "no-use-memo-simple-expression" },
				{ name: "no-useless-use-effect" },
				{ name: "no-useless-use-memo" },
				{ name: "no-useless-use-spring" },
				{ name: "prefer-constant-dispatch" },
				{ name: "prefer-context-stack" },
				{ name: "prefer-hoisted-jsx-elements" },
				{ name: "prefer-hoisted-jsx-object-properties" },
				{ name: "prefer-local-portal-component" },
				{ name: "prefer-padding-components" },
				{ name: "prefer-ternary-conditional-rendering" },
				{ name: "prefer-use-reducer" },
				{ name: "react-hooks-strict-return" },
				{ name: "require-named-effect-functions" },
				{ name: "require-react-component-keys" },
				{ name: "require-react-display-names" },
				{ name: "rerender-memo-with-default-value" },
				{ name: "strict-component-boundaries" },
				{ name: "use-exhaustive-dependencies" },
				{ name: "use-hook-at-top-level" },
			],
		},
		{
			description: "Rules for Roblox instances, Ianitor, Color3, UDim2, and other Roblox APIs.",
			key: "roblox",
			label: "Roblox & Luau Rules",
			rules: [
				{ name: "no-array-constructor-index-assignment" },
				{ name: "ban-instances" },
				{ name: "enforce-ianitor-check-type" },
				{ name: "no-array-constructor-elements" },
				{ name: "no-array-size-assignment" },
				{ name: "no-async-in-system" },
				{ name: "no-color3-constructor" },
				{ name: "no-events-in-events-callback" },
				{ name: "no-ianitor-in-function-body" },
				{ name: "no-ianitor-success-access" },
				{ name: "no-instance-methods-without-this" },
				{ name: "no-native-properties-spread" },
				{ name: "no-print" },
				{ name: "no-redundant-aspect-ratio-constraint" },
				{ name: "no-table-create-map" },
				{ name: "no-task-wait" },
				{ name: "no-useless-default" },
				{ name: "no-warn" },
				{ name: "prefer-idiv" },
				{ name: "prefer-math-min-max" },
				{ name: "prefer-modding-inspect" },
				{ name: "prefer-sequence-overloads" },
				{ name: "prefer-single-world-query" },
				{ name: "prefer-udim2-shorthand" },
				{ name: "require-module-level-instantiation" },
			],
		},
		{
			description: "Rules for naming conventions, type style, and file naming.",
			key: "naming",
			label: "Naming & Conventions",
			rules: [
				{ name: "array-type-generic" },
				{ name: "ban-types" },
				{ name: "no-spec-file-extension" },
				{ name: "prefer-pascal-case-enums" },
				{ name: "prefer-singular-enums" },
				{ name: "prevent-abbreviations" },
				{ name: "require-async-suffix" },
			],
		},
		{
			description: "Rules for code quality, control flow, and common pitfalls.",
			key: "general",
			label: "General Logic & Style",
			rules: [
				{ name: "no-recursive" },
				{ name: "directive-disable-enable-pair" },
				{ name: "directive-no-aggregating-enable" },
				{ name: "directive-no-duplicate-disable" },
				{ name: "directive-no-restricted-disable" },
				{ name: "directive-no-unlimited-disable" },
				{ name: "directive-no-unused-enable" },
				{ name: "directive-no-use" },
				{ name: "directive-require-description" },
				{ name: "no-async-constructor" },
				{ name: "no-commented-code" },
				{ name: "no-constant-condition-with-break" },
				{ name: "no-error" },
				{ name: "no-identity-map" },
				{ name: "no-increment-decrement" },
				{ name: "no-restricted-property-assignment" },
				{ name: "no-unused-imports" },
				{ name: "no-useless-constants" },
				{ name: "only-type-imports" },
				{ name: "prefer-class-properties" },
				{ name: "prefer-early-return" },
				{ name: "prefer-expect-assertions" },
				{ name: "prefer-module-scope-constants" },
				{ name: "require-paired-calls" },
				{ name: "require-switch-case-braces" },
				{ name: "require-throw-error-capture" },
				{ name: "require-unicode-regex" },
			],
		},
	],
});

export function formatRuleTitle(name: RuleName): string {
	return name
		.split("-")
		.map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
		.join(" ");
}

export function getRuleCategoryPath(category: RuleCategoryManifest): string {
	return `rules/${category.key}`;
}

export function getRulePath(category: RuleCategoryManifest, name: RuleName): string {
	return `${getRuleCategoryPath(category)}/${name}`;
}
