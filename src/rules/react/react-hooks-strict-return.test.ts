import { describe } from "vitest";
import { js } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/react/react-hooks-strict-return";

const errors = [{ messageId: "tooManyReturnValues" }];

describe("react-hooks-strict-return", () => {
	js.run("react-hooks-strict-return", rule, {
		invalid: [
			// Direct array with 3+ elements
			{
				code: "function useFoo() { return [1, 2, 3] }",
				errors: [{ messageId: "tooManyReturnValues" }],
				documentation: { id: "fail", title: "Hook returns too many values" },
			},

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

			// Spread through a chain of array initializers
			{
				code: "function useFoo() { const a = [1, 2]; const b = [...a]; const c = [...b, 3]; return c; }",
				errors,
			},

			// Returns inside blocks of the hook itself still belong to the hook
			{ code: "function useFoo(flag) { if (flag) { return [1, 2, 3]; } return [1]; }", errors },
			{ code: "function useFoo(list) { for (const item of list) { return [item, 1, 2]; } return [1]; }", errors },
			{ code: "function useFoo() { try { return [1, 2, 3]; } catch { return [1]; } }", errors },

			// A named function expression that is a hook
			{ code: "const foo = function useFoo() { return [1, 2, 3]; };", errors },

			// A nested callback does not hide the hook's own return
			{ code: "function useItems() { items.forEach((item) => { return [item]; }); return [1, 2, 3]; }", errors },

			// A hook declared inside another hook is checked on its own
			{ code: "function useOuter() { function useInner() { return [1, 2, 3]; } return useInner; }", errors },
			{
				code: "const useOuter = () => { const useInner = () => { return [1, 2, 3]; }; return useInner; };",
				errors,
			},
			{
				code: "function useOuter() { const make = () => { function useInner() { return [1, 2, 3]; } return useInner; }; return make; }",
				errors,
			},
			{
				code: "function useOuter() { function useInner() { return [1, 2, 3]; } return [4, 5, 6]; }",
				errors: [{ messageId: "tooManyReturnValues" }, { messageId: "tooManyReturnValues" }],
			},
		],
		valid: [
			// 1 or 2 element arrays are fine
			{
				code: "function useFoo() { return [1] }",
				documentation: { id: "pass", title: "Hook returns one value" },
			},
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

			// Undeclared global reference (covers getVariableByName returning
			// undefined)
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

			// A self-referencing spread initializer terminates
			{ code: "function useLoop() { const a = [...a]; return a; }" },
			{ code: "function useLoop() { const a = [...b]; const b = [...a]; return a; }" },

			// A return inside a nested callback is not the hook's return
			{
				code: [
					"function useItems() {",
					"\tconst sorted = useMemo(() => { return [a, b, c, d, e]; }, []);",
					"\titems.forEach((item) => { return [item, 1, 2, 3, 4]; });",
					"\treturn sorted;",
					"}",
				].join("\n"),
			},
			{ code: "function useFoo() { return () => { return [1, 2, 3]; }; }" },
			{ code: "function useFoo() { function helper() { return [1, 2, 3]; } return helper; }" },
			{ code: "const useFoo = () => { const run = function () { return [1, 2, 3]; }; return run; };" },
			{ code: "function useFoo() { const run = () => { const bar = [1, 2, 3]; return bar; }; return run; }" },
			{ code: "function useOuter() { function inner() { return [1, 2, 3]; } return [inner, 1]; }" },
		],
	});
});
