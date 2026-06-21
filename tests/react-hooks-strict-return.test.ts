import { describe } from "vitest";
import rule from "$oxc-rules/react-hooks-strict-return";

import { js } from "./rule-testers";

const errors = [{ messageId: "tooManyReturnValues" }];

describe("react-hooks-strict-return", () => {
	// @ts-expect-error - This is dumb
	js.run("react-hooks-strict-return", rule, {
		invalid: [
			// Direct array with 3+ elements
			{ code: "function useFoo() { return [1, 2, 3] }", errors },

			// Variable reference to 3+ element array
			{ code: "function useFoo() { const bar = [1, 2, 3]; return bar; }", errors },

			// Variable from outer scope (covers line 29 - scope chain traversal)
			{ code: "const bar = [1, 2, 3]; function useFoo() { return bar; }", errors },

			// Arrow function with 3+ element array
			{ code: "const useFoo = () => { const bar = [1, 2, 3]; return bar; }", errors },

			// Sparse array with 3+ holes
			{ code: "function useFoo() { return [,,,] }", errors },

			// Spread of 3+ element array
			{ code: "function useFoo() { const bar = [1, 2, 3]; return [...bar] }", errors },
			{ code: "const useFoo = () => { const bar = [1, 2, 3]; return [...bar] }", errors },

			// Spread combining to 3+ elements
			{ code: "function useFoo() { const bar = [1, 2]; const baz = [3]; return [...bar, ...baz]; }", errors },

			// Inline array spread (covers lines 82-83)
			{ code: "function useFoo() { return [...[1, 2, 3, 4]]; }", errors },

			// Hook with other hooks inside
			{ code: "function useFoo() { useEffect(() => {}); return [1, 2, 3, 4]; }", errors },
			{ code: "function useFoo() { useSomeOtherHook(); return [1, 2, 3, 4]; }", errors },
			{ code: "function useFoo() { useSomeOtherHook(); useEffect(() => {}); return [1, 2, 3, 4]; }", errors },
		],
		valid: [
			// 1 or 2 element arrays are fine
			{ code: "function useFoo() { return [1] }" },
			{ code: "function useFoo() { return [1, 2] }" },
			{ code: "function useFoo() { const bar = [1, 2]; return bar; }" },
			{ code: "function useFoo() { const bar = [1, 2]; return [...bar]; }" },
			{ code: "function useFoo(rest) { return [...rest]; }" },
			{ code: "function useFoo() { return [...getValues()]; }" },
			{ code: "function useFoo() { return ['bar', () => {}] }" },
			{ code: "function useFoo() { return [1, [1, 2, 3].map(() => 1)] }" },
			{ code: "function useFoo() { const bar = [1]; const baz = [2]; return [...bar, ...baz]; }" },

			// Objects are always fine regardless of size
			{ code: "function useFoo() { return {one: 1, two: 2, three: 3} }" },
			{ code: "function useFoo() { const bar = {one: 1, two: 2, three: 3}; return bar }" },
			{ code: "function useFoo() { const bar = {one: 1, two: 2, three: 3}; return {...bar} }" },
			{ code: "function useFoo() { const bar = {one: 1, two: 2, three: 3}; return {...bar, four: 4} }" },

			// Non-hook functions can return anything
			{ code: "function foo() { return [1, 2, 3] }" },
			{ code: "function foo() { return [0, {one: 1, two: 2, three: 3}, 4, 5,] }" },

			// Other return types
			{ code: "function useFoo() { return null }" },
			{ code: "function useFoo() { return 1 }" },
			{ code: "function useFoo() {}" },
			{ code: "function useFoo() { return 'bar'; }" },

			// Unknown variable return (covers line 31 - undefined return path)
			{ code: "function useFoo(bar) { return bar; }" },

			// Undeclared global reference (covers getVariableByName returning undefined)
			{ code: "function useFoo() { return undeclaredGlobal; }" },

			// Hook + non-hook in same file
			{ code: "function useFoo() { return 'bar'; } function baz() { return [1, 2, 3, 4] }" },

			// Variable that's a single value
			{ code: "function useFoo() { const bar = 1; return [bar, () => {}]; }" },

			// Hooks with no return or undefined return
			{ code: "function useHookWithNoReturn() {}" },
			{ code: "function useHookUndefinedReturn() { return; }" },

			// Anonymous default export
			{ code: "export default function() { return; }" },
			{ code: "const useFoo = ({ value }) => [1, 2, 3];" },
		],
	});
});
