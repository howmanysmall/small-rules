import { describe } from "vitest";
import rule from "$oxc-rules/require-named-effect-functions";

import { tsx } from "./rule-testers";

describe("require-named-effect-functions", () => {
	tsx.run("require-named-effect-functions", rule, {
		invalid: [
			// Arrow functions
			{
				code: `
useEffect(() => {
    print("effect");
}, []);
`,
				documentation: { id: "fail", title: "Anonymous effect callback" },
				errors: [{ messageId: "arrowFunction" }],
			},
			// Anonymous function expressions
			{
				code: `
useEffect(function() {
    console.log("effect");
}, []);
`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Arrow function with dependencies
			{
				code: `
useEffect(() => {
    console.log(count);
}, [count]);
`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// UseLayoutEffect with arrow function
			{
				code: `
useLayoutEffect(() => {
    console.log("layout effect");
}, []);
`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// UseInsertionEffect with arrow function
			{
				code: `
useInsertionEffect(() => {
    console.log("insertion effect");
}, []);
`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// Named function expression in roblox-ts mode (default)
			{
				code: `
useEffect(function handleEffect() {
    console.log("effect");
}, []);
`,
				errors: [{ messageId: "functionExpression" }],
			},
			// Member expression hook with arrow function
			{
				code: `
React.useEffect(() => {
    console.log("effect");
}, []);
`,
				errors: [{ messageId: "arrowFunction" }],
			},
			// Member expression hook with anonymous function (for line 29 coverage)
			{
				code: `
React.useLayoutEffect(function() {
    console.log("layout effect");
}, []);
`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Anonymous function with return
			{
				code: `
useEffect(function() {
    return () => {
        console.log("cleanup");
    };
}, []);
`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Identifier referencing function expression with inferred name (roblox-ts mode)
			{
				code: `
const anonymousFunc = function() {
    console.log("effect");
};
useEffect(anonymousFunc, []);
`,
				errors: [{ messageId: "anonymousFunction" }],
			},
			// Arrow function assigned to variable is invalid (doesn't have a real name)
			{
				code: `
const handleEffect = () => {
    console.log("effect");
};
useEffect(handleEffect, []);
`,
				errors: [{ messageId: "identifierReferencesArrow" }],
			},
			// Arrow function assigned to const in more complex case
			{
				code: `
const effect = () => {
    console.log("effect");
};
useEffect(effect, []);
`,
				errors: [{ messageId: "identifierReferencesArrow" }],
			},
			// Named function expression via identifier in roblox-ts mode
			{
				code: `
const effect = function handleEffect() {
    console.log("effect");
};
useEffect(effect, []);
`,
				errors: [{ messageId: "functionExpression" }],
			},
			// Async arrow function inline
			{
				code: `
useEffect(async () => {
    await fetchData();
}, []);
`,
				errors: [{ messageId: "asyncArrowFunction" }],
			},
			// Async named function expression inline
			{
				code: `
useEffect(async function handleEffect() {
    await fetchData();
}, []);
`,
				errors: [{ messageId: "asyncFunctionExpression" }],
			},
			// Async anonymous function expression inline
			{
				code: `
useEffect(async function() {
    await fetchData();
}, []);
`,
				errors: [{ messageId: "asyncAnonymousFunction" }],
			},
			// Async function declaration referenced via identifier
			{
				code: `
async function handleEffect() {
    await fetchData();
}
useEffect(handleEffect, []);
`,
				errors: [{ messageId: "identifierReferencesAsyncFunction" }],
			},
			// Async arrow via identifier (not allowed by default)
			{
				code: `
const effect = async () => {
    await fetchData();
};
useEffect(effect, []);
`,
				errors: [{ messageId: "identifierReferencesAsyncArrow" }],
			},
			// UseCallback result referenced via identifier
			{
				code: `
const incorrectUsage = useCallback(() => {
    print("Some property changed!");
}, []);
useEffect(incorrectUsage, [someProperty]);
`,
				errors: [{ messageId: "identifierReferencesCallback" }],
			},
			// Async useCallback result referenced via identifier
			{
				code: `
const asyncCallback = useCallback(async () => {
    await fetchData();
}, []);
useEffect(asyncCallback, [dep]);
`,
				errors: [{ messageId: "identifierReferencesCallback" }],
			},
			// UseMemo result referenced via identifier
			{
				code: `
const memoizedCallback = useMemo(() => () => {
    console.log("memoized");
}, []);
useEffect(memoizedCallback, []);
`,
				errors: [{ messageId: "identifierReferencesCallback" }],
			},
			// React.useCallback result referenced via identifier
			{
				code: `
const callback = React.useCallback(() => {
    console.log("callback");
}, []);
useEffect(callback, []);
`,
				errors: [{ messageId: "identifierReferencesCallback" }],
			},
		],
		valid: [
			// Named function reference (function declaration)
			{
				code: `
function handleEffect() {
    print("effect");
}
useEffect(handleEffect, []);
`,
				documentation: { id: "pass", title: "Named effect callback" },
			},
			// Function declaration referenced with cleanup
			{
				code: `
function myEffect() {
    console.log("effect");
    return () => console.log("cleanup");
}
useEffect(myEffect, []);
`,
			},
			// UseLayoutEffect with named function reference
			{
				code: `
function layoutHandler() {
    console.log("layout");
}
useLayoutEffect(layoutHandler, []);
`,
			},
			// UseInsertionEffect with named function reference
			{
				code: `
function insertionHandler() {
    console.log("insertion");
}
useInsertionEffect(insertionHandler, []);
`,
			},
			// Member expression hook with named function
			{
				code: `
function handleEffect() {
    console.log("effect");
}
React.useEffect(handleEffect, []);
`,
			},
			// Without dependencies array
			{
				code: `
function handleEffect() {
    console.log("effect");
}
useEffect(handleEffect);
`,
			},
			// Non-effect hooks should not be checked
			{
				code: `
useCallback(() => {
    console.log("callback");
}, []);
`,
			},
			// Regular function calls shouldn't be checked
			{
				code: `
myFunction(() => {
    console.log("not a hook");
});
`,
			},
			// Named function expression in standard mode
			{
				code: `
useEffect(function handleEffect() {
    console.log("effect");
}, []);
`,
				options: [
					{
						environment: "standard",
						hooks: [
							{ allowAsync: false, name: "useEffect" },
							{ allowAsync: false, name: "useLayoutEffect" },
							{ allowAsync: false, name: "useInsertionEffect" },
						],
					},
				],
			},
			// Named function expression via identifier in standard mode
			{
				code: `
const effect = function handleEffect() {
    console.log("effect");
};
useEffect(effect, []);
`,
				options: [
					{
						environment: "standard",
						hooks: [
							{ allowAsync: false, name: "useEffect" },
							{ allowAsync: false, name: "useLayoutEffect" },
							{ allowAsync: false, name: "useInsertionEffect" },
						],
					},
				],
			},
			// Imported function reference (can't resolve, assume valid)
			{
				code: `
import { handleEffect } from './effects';
useEffect(handleEffect, []);
`,
			},
			// Unresolved function reference (can't resolve, assume valid)
			{
				code: `
useEffect(handleEffect, []);
`,
			},
			// Declared variable without function initializer
			{
				code: `
let handleEffect;
useEffect(handleEffect, []);
`,
			},
			// Non-callback call result referenced via identifier
			{
				code: `
const handleEffect = createEffect();
useEffect(handleEffect, []);
`,
			},
			// Effect hook without a callback argument
			{
				code: "useEffect();",
			},
			// Non-function effect callback argument
			{
				code: "useEffect(123, []);",
			},
			// Async arrow via identifier with per-hook allowAsync enabled
			{
				code: `
const effect = async () => {
    await fetchData();
};
useEffect(effect, []);
`,
				options: [
					{
						hooks: [
							{ allowAsync: true, name: "useEffect" },
							{ allowAsync: false, name: "useLayoutEffect" },
							{ allowAsync: false, name: "useInsertionEffect" },
						],
					},
				],
			},
			// Async function declaration with per-hook allowAsync enabled
			{
				code: `
async function handleEffect() {
    await fetchData();
}
useEffect(handleEffect, []);
`,
				options: [
					{
						hooks: [
							{ allowAsync: true, name: "useEffect" },
							{ allowAsync: false, name: "useLayoutEffect" },
							{ allowAsync: false, name: "useInsertionEffect" },
						],
					},
				],
			},
			// Computed member access (getHookName returns undefined, rule doesn't check)
			{
				code: `
const hooks = { useEffect };
hooks['useEffect'](() => {
    console.log("effect");
}, []);
`,
			},
			// Outer scope function reference
			{
				code: `
function makeComponent() {
    function handleEffect() {
        console.log("effect");
    }
    return useEffect(handleEffect, []);
}
`,
			},
		],
	});

	describe("configuration options", () => {
		tsx.run("require-named-effect-functions-standard-mode", rule, {
			invalid: [
				// Arrow functions should still fail in standard mode
				{
					code: `
useEffect(() => {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "arrowFunction" }],
					options: [{ environment: "standard" }],
				},
				// Anonymous functions should still fail in standard mode
				{
					code: `
useEffect(function() {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "anonymousFunction" }],
					options: [{ environment: "standard" }],
				},
			],
			valid: [
				// Named function expression is allowed in standard mode
				{
					code: `
useEffect(function handleEffect() {
    console.log("effect");
}, []);
`,
					options: [{ environment: "standard" }],
				},
				// Named function reference still works
				{
					code: `
function effect() {
    console.log("effect");
}
useEffect(effect, []);
`,
					options: [{ environment: "standard" }],
				},
			],
		});

		tsx.run("require-named-effect-functions-sloptor-mode", rule, {
			invalid: [
				// Arrow functions should still fail in sloptor mode
				{
					code: `
useEffect(() => {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "arrowFunction" }],
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
				// Anonymous function expressions should still fail in sloptor mode
				{
					code: `
useEffect(function() {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "anonymousFunction" }],
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
				// Named function expressions are reported in plain roblox-ts mode
				{
					code: `
useEffect(function handleEffect() {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "functionExpression" }],
					options: [{ environment: "roblox-ts" }],
				},
			],
			valid: [
				// Named function expressions are allowed in sloptor mode (standard behavior)
				{
					code: `
useEffect(function handleEffect() {
    console.log("effect");
}, []);
`,
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
				// Named function expression via identifier is allowed in sloptor mode
				{
					code: `
const effect = function handleEffect() {
    console.log("effect");
};
useEffect(effect, []);
`,
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
				// Function declaration references are allowed in sloptor mode
				{
					code: `
function effect() {
    console.log("effect");
}
useEffect(effect, []);
`,
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
			],
		});

		tsx.run("require-named-effect-functions-inline-function-declarations", rule, {
			invalid: [
				// Standard mode: declaration reference is converted to an inline named function expression
				// and the now-unused single-reference declaration is removed
				{
					code: `
function doSomething(): void {}
useEffect(doSomething, []);
`,
					errors: [{ messageId: "identifierReferencesFunctionDeclaration" }],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
					output: `
useEffect(function doSomething(): void {}, []);
`,
				},
				// Sloptor mode: same conversion preserves parameters and annotations
				{
					code: `
function doSomething(amount: number): void {}
useEffect(doSomething, []);
`,
					errors: [{ messageId: "identifierReferencesFunctionDeclaration" }],
					options: [{ environment: "roblox-ts", inlineFunctionDeclarations: true, sloptor: true }],
					output: `
useEffect(function doSomething(amount: number): void {}, []);
`,
				},
				// Multiple references keep the declaration (inlining each call site would be safe,
				// but removing the declaration would break the other reference)
				{
					code: `
function doSomething(): void {}
useEffect(doSomething, []);
useEffect(doSomething, [a]);
`,
					errors: [
						{ messageId: "identifierReferencesFunctionDeclaration" },
						{ messageId: "identifierReferencesFunctionDeclaration" },
					],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
					output: `
function doSomething(): void {}
useEffect(function doSomething(): void {}, []);
useEffect(function doSomething(): void {}, [a]);
`,
				},
				// Exported declarations are kept (removing them would break the export)
				{
					code: `
export function doSomething(): void {}
useEffect(doSomething, []);
`,
					errors: [{ messageId: "identifierReferencesFunctionDeclaration" }],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
					output: `
export function doSomething(): void {}
useEffect(function doSomething(): void {}, []);
`,
				},
				// Declarations with attached comments are kept (removing them would orphan the comment)
				{
					code: `
// Some business logic
function doSomething(): void {}
useEffect(doSomething, []);
`,
					errors: [{ messageId: "identifierReferencesFunctionDeclaration" }],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
					output: `
// Some business logic
function doSomething(): void {}
useEffect(function doSomething(): void {}, []);
`,
				},
				// Single-reference declarations in nested scopes are removed with their indentation
				{
					code: `
function makeComponent() {
    function handleEffect() {
        console.log("effect");
    }
    return useEffect(handleEffect, []);
}
`,
					errors: [{ messageId: "identifierReferencesFunctionDeclaration" }],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
					output: `
function makeComponent() {
    return useEffect(function handleEffect() {
        console.log("effect");
    }, []);
}
`,
				},
				// Async declarations keep the async report without a fix
				{
					code: `
async function handleEffect() {
    await fetchData();
}
useEffect(handleEffect, []);
`,
					errors: [{ messageId: "identifierReferencesAsyncFunction" }],
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
				},
			],
			valid: [
				// Standard mode without the opt-in keeps declaration references allowed
				{
					code: `
function effect() {
    console.log("effect");
}
useEffect(effect, []);
`,
					options: [{ environment: "standard" }],
				},
				// Sloptor mode without the opt-in keeps declaration references allowed
				{
					code: `
function effect() {
    console.log("effect");
}
useEffect(effect, []);
`,
					options: [{ environment: "roblox-ts", sloptor: true }],
				},
				// Plain roblox-ts mode ignores the opt-in
				{
					code: `
function effect() {
    console.log("effect");
}
useEffect(effect, []);
`,
					options: [{ inlineFunctionDeclarations: true }],
				},
				// Ambient declarations have no body to inline
				{
					code: `
declare function doSomething(): void;
useEffect(doSomething, []);
`,
					options: [{ environment: "standard", inlineFunctionDeclarations: true }],
				},
			],
		});

		tsx.run("require-named-effect-functions-custom-hooks", rule, {
			invalid: [
				// Custom hook with arrow function
				{
					code: `
useCustomHook(() => {
    console.log("custom");
}, []);
`,
					errors: [{ messageId: "arrowFunction" }],
					options: [{ hooks: [{ allowAsync: false, name: "useCustomHook" }] }],
				},
			],
			valid: [
				// Empty hook option entries fall back to the default hooks
				{
					code: `
function handleEffect() {
    console.log("effect");
}
useEffect(handleEffect, []);
`,
					options: [{ hooks: [] }],
				},
				// Custom hook with named function
				{
					code: `
function handleCustom() {
    console.log("custom");
}
useCustomHook(handleCustom, []);
`,
					options: [{ hooks: [{ allowAsync: false, name: "useCustomHook" }] }],
				},
				// Default hooks should not be checked when custom hooks are specified
				{
					code: `
useEffect(() => {
    console.log("effect");
}, []);
`,
					options: [{ hooks: [{ allowAsync: false, name: "useCustomHook" }] }],
				},
			],
		});
	});

	describe("t4 behavior lock: import aliasing and getHookName interaction", () => {
		tsx.run("require-named-effect-functions - renamed hook import not detected", rule, {
			invalid: [],
			valid: [
				{
					code: `
import { useEffect as myEffect } from "@rbxts/react";

myEffect(() => {
    console.log("effect");
}, []);
`,
				},
			],
		});

		tsx.run("require-named-effect-functions - namespace import", rule, {
			invalid: [
				{
					code: `
import * as React from "@rbxts/react";

React.useEffect(() => {
    console.log("effect");
}, []);
`,
					errors: [{ messageId: "arrowFunction" }],
				},
			],
			valid: [
				{
					code: `
import * as React from "@rbxts/react";

function handleEffect() {
    console.log("effect");
}
React.useEffect(handleEffect, []);
`,
				},
			],
		});
	});
});
