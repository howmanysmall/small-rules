import type smallRules from "$small-rules";

export type RuleName = keyof typeof smallRules.rules;
export type RuleCategoryKey = "general" | "naming" | "react" | "roblox";

export interface RuleManifestEntry {
	readonly name: RuleName;
	readonly exampleExemption?: string | undefined;
}

export interface RuleCategoryManifest {
	readonly key: RuleCategoryKey;
	readonly description: string;
	readonly label: string;
	readonly rules: ReadonlyArray<RuleManifestEntry>;
}

export interface RuleManifest {
	readonly categories: ReadonlyArray<RuleCategoryManifest>;
}

function defineRuleManifest<const TManifest extends RuleManifest>(manifest: TManifest): TManifest {
	return manifest;
}

export const ruleManifest = defineRuleManifest({
	categories: [
		{
			key: "react",
			description: "Rules for React Luau components, hooks, and JSX patterns.",
			label: "React Rules",
			rules: [
				{ name: "ban-react-fc" },
				{ name: "memoized-effect-dependencies" },
				{ name: "no-cascading-set-state" },
				{ name: "no-derived-state" },
				{ name: "no-chain-state-updates" },
				{ name: "no-event-handler" },
				{ name: "no-adjust-state-on-prop-change" },
				{ name: "no-reset-all-state-on-prop-change" },
				{ name: "no-pass-live-state-to-parent" },
				{ name: "no-pass-data-to-parent" },
				{ name: "no-external-store-subscription" },
				{ name: "no-initialize-state" },
				{
					name: "no-giant-component",
					exampleExemption:
						"Examples require components exceeding 300 lines, which are too long to display on a documentation page.",
				},
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
				{ name: "prefer-direct-hook-imports" },
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
			key: "roblox",
			description: "Rules for Roblox instances, Ianitor, Color3, UDim2, and other Roblox APIs.",
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
			key: "naming",
			description: "Rules for naming conventions, type style, and file naming.",
			label: "Naming & Conventions",
			rules: [
				{ name: "array-type-generic" },
				{ name: "ban-types" },
				{ name: "consistent-compound-words" },
				{ name: "no-spec-file-extension" },
				{ name: "prefer-pascal-case-enums" },
				{ name: "prefer-singular-enums" },
				{ name: "prevent-abbreviations" },
				{ name: "require-async-suffix" },
			],
		},
		{
			key: "general",
			description: "Rules for code quality, control flow, and common pitfalls.",
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
				{ name: "isolated-functions" },
				{ name: "no-dead-store" },
				{ name: "no-error" },
				{ name: "no-filter-map-chain" },
				{ name: "no-floating-point-equality" },
				{ name: "no-identity-map" },
				{ name: "no-increment-decrement" },
				{ name: "no-loop-iterable-mutation" },
				{ name: "no-restricted-property-assignment" },
				{ name: "no-trivial-assertions" },
				{ name: "no-unused-imports" },
				{ name: "no-use-of-empty-return-value" },
				{ name: "no-useless-constants" },
				{ name: "no-variadic-spread" },
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
