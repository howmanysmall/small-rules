import { describe } from "vitest";
import rule from "$oxc-rules/require-react-component-keys";
import parser from "@typescript-eslint/parser";

import { tsx } from "./rule-testers";

describe("require-react-component-keys with custom configurations", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	// And this test file intentionally passes the rule as-is for runtime validation.
	tsx.run("require-react-component-keys - custom iterationMethods", rule, {
		invalid: [
			// Custom iteration method in list - keys required in callback
			{
				code: `
function CustomIteration(items) {
    return items.customMap((item) => <div>{item}</div>);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ iterationMethods: ["customMap"] }],
			},
		],
		valid: [
			// Custom iteration method in list with key - should not error since key is present
			{
				code: `
function CustomIteration(items) {
    return items.customMap((item) => <div key={item.id}>{item}</div>);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ iterationMethods: ["customMap"] }],
			},
			// Custom iteration method 'each' not in list - should not be treated as iteration (no keys needed elsewhere)
			{
				code: `
function CustomEach(items) {
    // 'each' is not in iterationMethods, so not flagged as iteration
    items.each((item) => console.log(item));
    return <div>No keys needed here since it's top-level</div>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ iterationMethods: ["map", "filter"] }],
			},
			// Default iterations with custom key requirement
			{
				code: `
function DefaultIteration(items) {
    return items.map((item) => <div key={item.id}>{item}</div>);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ iterationMethods: ["map"] }],
			},
		],
	});

	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	// And this test file intentionally passes the rule as-is for runtime validation.
	tsx.run("require-react-component-keys - custom memoizationHooks", rule, {
		invalid: [
			// Default hooks with custom configuration - should error
			{
				code: `
function CustomNamedHooks() {
    const renderLayout = useCallback(() => {
        return <div />;
    }, []);
    return <div>{renderLayout()}</div>;
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ memoizationHooks: ["useCallback"] }],
			},
			// Custom hook in list but missing key - should error
			{
				code: `
function CustomMemoizedBad() {
    const renderLayout = useCustomMemo(() => {
        return <div />;
    }, []);
    return <div>{renderLayout()}</div>;
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ memoizationHooks: ["useCustomMemo"] }],
			},
		],
		valid: [
			// Default React hooks not in custom list - should not be treated as memoization (no keys forced elsewhere)
			{
				code: `
function WithoutKeys() {
    // 'useCallback' is not in memoizationHooks, so not flagged as memoization
    useCallback(() => {
        return console.log('callback');
    }, []);
    return <div>No keys needed here since it's top-level</div>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ memoizationHooks: [] }],
			},
			// Custom hook in list - should require keys when key is present
			{
				code: `
function CustomMemoized() {
    const renderLayout = useCustomMemo(() => {
        return <div key="memoized" />;
    }, []);
    return <div>{renderLayout()}</div>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ memoizationHooks: ["useCustomMemo"] }],
			},
		],
	});
});
