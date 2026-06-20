import { describe, expect, it } from "vitest";

const expectedRuleNames: ReadonlyArray<string> = [
	"array-type-generic",
	"ban-instances",
	"ban-react-fc",
	"ban-types",
	"directive-disable-enable-pair",
	"directive-no-aggregating-enable",
	"directive-no-duplicate-disable",
	"directive-no-restricted-disable",
	"directive-no-unlimited-disable",
	"directive-no-unused-enable",
	"directive-no-use",
	"directive-require-description",
	"enforce-ianitor-check-type",
	"memoized-effect-dependencies",
	"no-array-constructor-elements",
	"no-array-constructor-index-assignment",
	"no-array-size-assignment",
	"no-async-constructor",
	"no-cascading-set-state",
	"no-color3-constructor",
	"no-commented-code",
	"no-constant-condition-with-break",
	"no-error",
	"no-events-in-events-callback",
	"no-giant-component",
	"no-god-components",
	"no-ianitor-in-function-body",
	"no-ianitor-success-access",
	"no-identity-map",
	"no-increment-decrement",
	"no-inline-property-on-memo-component",
	"no-instance-methods-without-this",
	"no-native-properties-spread",
	"no-new-instance-in-use-memo",
	"no-print",
	"no-redundant-aspect-ratio-constraint",
	"no-render-helper-functions",
	"no-spec-file-extension",
	"no-static-react-create-element",
	"no-table-create-map",
	"no-task-wait",
	"no-underscore-react-props",
	"no-unused-imports",
	"no-unused-use-memo",
	"no-use-memo-simple-expression",
	"no-useless-constants",
	"no-useless-default",
	"no-useless-use-effect",
	"no-useless-use-memo",
	"no-useless-use-spring",
	"no-warn",
	"only-type-imports",
	"prefer-class-properties",
	"prefer-constant-dispatch",
	"prefer-context-stack",
	"prefer-early-return",
	"prefer-expect-assertions",
	"prefer-hoisted-jsx-elements",
	"prefer-hoisted-jsx-object-properties",
	"prefer-idiv",
	"prefer-local-portal-component",
	"prefer-math-min-max",
	"prefer-modding-inspect",
	"prefer-module-scope-constants",
	"prefer-padding-components",
	"prefer-pascal-case-enums",
	"prefer-sequence-overloads",
	"prefer-single-world-query",
	"prefer-singular-enums",
	"prefer-ternary-conditional-rendering",
	"prefer-udim2-shorthand",
	"prefer-use-reducer",
	"prevent-abbreviations",
	"react-hooks-strict-return",
	"require-async-suffix",
	"require-module-level-instantiation",
	"require-named-effect-functions",
	"require-paired-calls",
	"require-react-component-keys",
	"require-react-display-names",
	"require-switch-case-braces",
	"require-throw-error-capture",
	"require-unicode-regex",
	"rerender-memo-with-default-value",
	"strict-component-boundaries",
	"use-exhaustive-dependencies",
	"use-hook-at-top-level",
];

describe("small-rules plugin", () => {
	describe("plugin metadata", () => {
		it("has the correct plugin name", async () => {
			expect.assertions(1);

			const smallRules = await import("$small-rules");

			expect(smallRules.default.meta?.name).toBe("small-rules");
		}, 5000);

		it("exports every registered rule", async () => {
			expect.assertions(2);

			const smallRules = await import("$small-rules");
			const ruleNames = Object.keys(smallRules.default.rules).toSorted();

			expect(ruleNames).toStrictEqual(expectedRuleNames);
			expect(ruleNames).toHaveLength(87);
		}, 5000);
	});
});
