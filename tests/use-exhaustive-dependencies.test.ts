import { describe } from "vitest";
import rule from "$oxc-rules/use-exhaustive-dependencies";
import parser from "@typescript-eslint/parser";

import { jsx, ts } from "./rule-testers";

describe("use-exhaustive-dependencies", () => {
	// @ts-expect-error - RuleTester types are incorrect for suggestions
	jsx.run("use-exhaustive-dependencies", rule, {
		invalid: [
			// Missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Missing multiple dependencies
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("");
    useEffect(() => {
        console.log(count, name);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependencies",
						suggestions: [
							{
								desc: "Add missing dependencies to array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("");
    useEffect(() => {
        console.log(count, name);
    }, [count, name]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("");
    useEffect(() => {
        console.log(count, name);
    }, [count, name]);
}
`,
			},

			// Missing dependencies array
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    });
}
`,
				errors: [
					{
						messageId: "missingDependenciesArray",
						suggestions: [
							{
								desc: "Add dependencies array: [count]",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Unnecessary dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, [count]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'count' from dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, []);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, []);
}
`,
			},

			// Unstable dependency - inline function
			{
				code: `
function Component() {
    const handler = () => {};
    useEffect(() => {
        handler();
    }, [handler]);
}
`,
				errors: [{ messageId: "unstableDependency" }],
			},

			// Unstable dependency - inline object
			{
				code: `
function Component() {
    const config = {};
    useEffect(() => {
        console.log(config);
    }, [config]);
}
`,
				errors: [{ messageId: "unstableDependency" }],
			},

			// Missing dependency in useCallback
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const callback = useCallback(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const callback = useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    const callback = useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Missing dependency in useMemo
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const value = useMemo(() => {
        return count * 2;
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const value = useMemo(() => {
        return count * 2;
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    const value = useMemo(() => {
        return count * 2;
    }, [count]);
}
`,
			},

			// Missing dependency in useLayoutEffect
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Missing dependency with member expression
			{
				code: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj.prop' to dependencies array",
								output: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, [obj.prop]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, [obj.prop]);
}
`,
			},

			// Member expression - dependency too specific
			{
				code: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, [obj.nested.value]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'obj.nested.value' from dependencies array",
								output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, []);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested);
    }, []);
}
`,
			},

			// Missing dependency in useImperativeHandle (closure at index 1)
			{
				code: `
function Component(ref) {
    const [value, setValue] = useState(0);
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'value' to dependencies array",
								output: `
function Component(ref) {
    const [value, setValue] = useState(0);
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), [value]);
}
`,
							},
						],
					},
				],
				output: `
function Component(ref) {
    const [value, setValue] = useState(0);
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), [value]);
}
`,
			},

			// React Lua - useBinding with missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    const [binding, setBinding] = useBinding(() => count);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    const [binding, setBinding] = useBinding(() => count);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    const [binding, setBinding] = useBinding(() => count);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Multiple hooks with missing dependencies
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
    useCallback(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
    useCallback(() => {
        console.log(count);
    }, []);
}
`,
							},
						],
					},
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
    useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
    useCallback(() => {
        console.log(count);
    }, [count]);
}
`,
			},

			// Prop dependency missing
			{
				code: `
function Component(props) {
    useEffect(() => {
        console.log(props.value);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'props.value' to dependencies array",
								output: `
function Component(props) {
    useEffect(() => {
        console.log(props.value);
    }, [props.value]);
}
`,
							},
						],
					},
				],
				output: `
function Component(props) {
    useEffect(() => {
        console.log(props.value);
    }, [props.value]);
}
`,
			},

			// Optional chaining - missing dependency
			{
				code: `
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj?.prop' to dependencies array",
								output: `
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj?.prop]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj?.prop]);
}
`,
			},

			// Optional chaining - chained access missing
			{
				code: `
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj?.nested?.value' to dependencies array",
								output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, [obj?.nested?.value]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, [obj?.nested?.value]);
}
`,
			},

			// Non-null assertion - missing dependency (strips ! for dependency array)
			{
				code: `
function Component({ foo }) {
    useMemo(() => foo!.bar, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'foo.bar' to dependencies array",
								output: `
function Component({ foo }) {
    useMemo(() => foo!.bar, [foo.bar]);
}
`,
							},
						],
					},
				],
				languageOptions: { parser },
				output: `
function Component({ foo }) {
    useMemo(() => foo!.bar, [foo.bar]);
}
`,
			},

			// Shorthand property IS a capture - should detect missing dependency
			{
				code: `
function Component() {
    const cellPadding = { x: 1 };
    useMemo(() => ({ cellPadding }), []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'cellPadding' to dependencies array",
								output: `
function Component() {
    const cellPadding = { x: 1 };
    useMemo(() => ({ cellPadding }), [cellPadding]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const cellPadding = { x: 1 };
    useMemo(() => ({ cellPadding }), [cellPadding]);
}
`,
			},

			// Computed property key IS a capture - should detect missing dependency
			{
				code: `
function Component() {
    const key = "prop";
    const value = 1;
    useMemo(() => ({ [key]: value }), [value]);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'key' to dependencies array",
								output: `
function Component() {
    const key = "prop";
    const value = 1;
    useMemo(() => ({ [key]: value }), [key, value]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const key = "prop";
    const value = 1;
    useMemo(() => ({ [key]: value }), [key, value]);
}
`,
			},

			// Coverage: Non-const variable decl should not be stable
			{
				code: `
function Component() {
    let a = 1;
    useEffect(() => {
        console.log(a);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'a' to dependencies array",
								output: `
function Component() {
    let a = 1;
    useEffect(() => {
        console.log(a);
    }, [a]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    let a = 1;
    useEffect(() => {
        console.log(a);
    }, [a]);
}
`,
			},
			// Sparse dependency arrays ignore empty slots while fixing missing dependencies
			{
				code: `
function Component() {
    const count = props.count;
    useEffect(() => {
        console.log(count);
    }, [,]);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const count = props.count;
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const count = props.count;
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
			},
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(count + 1);
    }, [setCount]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'setCount' from dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(count + 1);
    }, []);
}
`,
							},
						],
					},
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(count + 1);
    }, [count, setCount]);
}
`,
							},
						],
					},
				],
				options: [{ reportUnnecessaryStableDependencies: true }],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(count + 1);
    }, []);
}
`,
			},
			{
				code: `
function Component() {
    const count = props.count;
    function handler() {
        console.log(count);
    }
    useEffect(handler, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const count = props.count;
    function handler() {
        console.log(count);
    }
    useEffect(handler, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const count = props.count;
    function handler() {
        console.log(count);
    }
    useEffect(handler, [count]);
}
`,
			},
			{
				code: `
function Component({ count }) {
    const handler = () => {
        console.log(count);
    };
    useEffect(handler, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component({ count }) {
    const handler = () => {
        console.log(count);
    };
    useEffect(handler, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component({ count }) {
    const handler = () => {
        console.log(count);
    };
    useEffect(handler, [count]);
}
`,
			},
			{
				code: `
function Component() {
    const obj = { value: 1 };
    useMemo(() => obj["value"], []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'obj[\"value\"]' to dependencies array",
								output: `
function Component() {
    const obj = { value: 1 };
    useMemo(() => obj["value"], [obj["value"]]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const obj = { value: 1 };
    useMemo(() => obj["value"], [obj["value"]]);
}
`,
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [value + 1]);
}
`,
				errors: [
					{
						messageId: "unnecessaryDependency",
						suggestions: [
							{
								desc: "Remove 'value + 1' from dependencies array",
								output: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, []);
}
`,
							},
						],
					},
				],
				output: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, []);
}
`,
			},
			{
				code: `
function Component() {
    const value = Math["random"]();
    useEffect(() => {
        console.log(value);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'value' to dependencies array",
								output: `
function Component() {
    const value = Math["random"]();
    useEffect(() => {
        console.log(value);
    }, [value]);
}
`,
							},
						],
					},
				],
				output: `
function Component() {
    const value = Math["random"]();
    useEffect(() => {
        console.log(value);
    }, [value]);
}
`,
			},
			{
				code: `
function Component() {
    const { stable, ...rest } = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'rest' to dependencies array",
								output: `
function Component() {
    const { stable, ...rest } = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, [rest]);
}
`,
							},
						],
					},
				],
				options: [{ hooks: [{ name: "useCustomState", stableResult: ["stable"] }] }],
				output: `
function Component() {
    const { stable, ...rest } = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, [rest]);
}
`,
			},
			{
				code: `
function Component() {
    const [stable, ...rest] = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'rest' to dependencies array",
								output: `
function Component() {
    const [stable, ...rest] = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, [rest]);
}
`,
							},
						],
					},
				],
				options: [{ hooks: [{ name: "useCustomState", stableResult: [0] }] }],
				output: `
function Component() {
    const [stable, ...rest] = useCustomState();
    useEffect(() => {
        console.log(rest);
    }, [rest]);
}
`,
			},
		],
		valid: [
			// Coverage: TSSatisfiesExpression and other TS nodes
			{
				code: `
function Component() {
    const a = 1 as any;
    const b = (2 as const) satisfies number;
    useEffect(() => {
        console.log(a, b);
    }, [a, b]);
}
`,
				languageOptions: { parser },
			},
			// Coverage: Stable result as single number
			{
				code: `
function Component() {
    const [_, setter] = useCustomState();
    useEffect(() => {
        setter();
    }, []);
}
`,
				options: [
					{
						hooks: [{ name: "useCustomState", stableResult: 1 }],
					},
				],
			},
			// Coverage: Stable result as object property names
			{
				code: `
function Component() {
    const { stable } = useCustomObject();
    useEffect(() => {
        stable();
    }, []);
}
`,
				options: [
					{
						hooks: [{ name: "useCustomObject", stableResult: ["stable"] }],
					},
				],
			},
			// Custom hook entries without closure indices only contribute stable results
			{
				code: `
function Component() {
    const count = props.count;
    useIgnoredEffect(() => {
        console.log(count);
    }, []);
}
`,
				options: [
					{
						hooks: [{ name: "useIgnoredEffect" }],
					},
				],
			},
			{
				code: `
function Component() {
    const value = 1;
    useEffect(() => {
        console.log("ok");
    }, [value]);
}
`,
				options: [{ reportUnnecessaryDependencies: false, reportUnnecessaryStableDependencies: true }],
			},
			{
				code: `
function Component() {
    useCustomHook(() => {
        console.log("closure exists");
    });
}
`,
				options: [{ hooks: [{ closureIndex: 1, dependenciesIndex: 2, name: "useCustomHook" }] }],
			},
			{
				code: `
function Component() {
    useEffect(missingCallback, []);
}
`,
			},
			// Correct dependencies
			`
function Component() {
    const a = 1;
    useEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// Multiple correct dependencies
			`
function Component() {
    const a = 1;
    const b = 2;
    useEffect(() => {
        console.log(a, b);
    }, [a, b]);
}
`,

			// Spread element in dependency array
			`
function Component({ deps }) {
    useEffect(() => {
        console.log(deps);
    }, [...deps]);
}
`,

			// Spread element with other dependencies
			`
function Component({ deps }) {
    const a = 1;
    useEffect(() => {
        console.log(a, deps);
    }, [a, ...deps]);
}
`,

			// No dependencies needed - no captures
			`
function Component() {
    useEffect(() => {
        console.log("hello");
    }, []);
}
`,

			// UseState setter is stable
			`
function Component() {
    const [state, setState] = useState(0);
    useEffect(() => {
        setState(1);
    }, []);
}
`,

			// UseState with state in deps
			`
function Component() {
    const [state, setState] = useState(0);
    useEffect(() => {
        console.log(state);
        setState(1);
    }, [state]);
}
`,

			// UseReducer dispatch is stable
			`
function Component() {
    const [state, dispatch] = useReducer(reducer, initial);
    useEffect(() => {
        dispatch({ type: "INCREMENT" });
    }, []);
}
`,

			// UseRef is stable
			`
function Component() {
    const ref = useRef(null);
    useEffect(() => {
        console.log(ref.current);
    }, []);
}
`,

			// React Lua - useBinding is fully stable
			`
function Component() {
    const [binding, setBinding] = useBinding(0);
    useEffect(() => {
        setBinding(1);
        console.log(binding);
    }, []);
}
`,

			// Imported values don't need dependencies
			`
import { helper } from "./utils";
function Component() {
    useEffect(() => {
        helper();
    }, []);
}
`,

			// Constants are stable
			`
const CONSTANT = 10;
function Component() {
    useEffect(() => {
        console.log(CONSTANT);
    }, []);
}
`,

			// Member expression with correct dependency
			`
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj.prop);
    }, [obj]);
}
`,

			// Member expression - exact match
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useEffect(() => {
        console.log(obj.nested.value);
    }, [obj.nested.value]);
}
`,

			// UseCallback with correct dependencies
			`
function Component() {
    const a = 1;
    const callback = useCallback(() => {
        console.log(a);
    }, [a]);
}
`,

			// UseMemo with correct dependencies
			`
function Component() {
    const a = 1;
    const value = useMemo(() => {
        return a * 2;
    }, [a]);
}
`,

			// UseLayoutEffect with correct dependencies
			`
function Component() {
    const a = 1;
    useLayoutEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// UseImperativeHandle with correct dependencies
			`
function Component(ref) {
    const value = 1;
    useImperativeHandle(ref, () => ({
        getValue: () => value
    }), [value]);
}
`,

			// Destructured props
			`
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [value]);
}
`,

			// Function parameter
			`
function Component(callback) {
    useEffect(() => {
        callback();
    }, [callback]);
}
`,

			// No dependencies array with no captures
			`
function Component() {
    useEffect(() => {
        console.log("hello");
    });
}
`,

			// Conditional logic inside hook
			`
function Component() {
    const a = 1;
    useEffect(() => {
        if (condition) {
            console.log(a);
        }
    }, [a]);
}
`,

			// React namespace hook
			`
function Component() {
    const a = 1;
    React.useEffect(() => {
        console.log(a);
    }, [a]);
}
`,

			// All standard hooks with correct deps
			`
function Component() {
    const a = 1;
    useEffect(() => { console.log(a); }, [a]);
    useLayoutEffect(() => { console.log(a); }, [a]);
    useCallback(() => { console.log(a); }, [a]);
    useMemo(() => a, [a]);
}
`,

			// UseTransition startTransition is stable
			`
function Component() {
    const [isPending, startTransition] = useTransition();
    useEffect(() => {
        startTransition(() => {
            // transition
        });
    }, []);
}
`,

			// Props with stable setter
			`
function Component(props) {
    const [state, setState] = useState(0);
    useEffect(() => {
        setState(props.value);
    }, [props.value]);
}
`,

			// Computed property access
			`
function Component() {
    const obj = { prop: 1 };
    const key = "prop";
    useEffect(() => {
        console.log(obj[key]);
    }, [obj, key]);
}
`,

			// React Lua - multiple useBinding calls
			`
function Component() {
    const [binding1] = useBinding(0);
    const [binding2] = useBinding(0);
    useEffect(() => {
        console.log(binding1, binding2);
    }, []);
}
`,

			// Global built-ins should not be reported as dependencies
			`
function Component() {
    useEffect(() => {
        const arr = new Array();
    }, []);
}
`,

			// TypeScript type parameters should not be dependencies (simplified without generic syntax)
			`
function Component() {
    const setMemorySafeState = useCallback((newState) => {
        // Type annotations like SetStateAction<S> would be here in real code
        setState(newState);
    }, []);
}
`,

			// React.joinBindings returns a stable binding
			`
function Component() {
    const joined = React.joinBindings({ a, b });
    useEffect(() => {
        console.log(joined);
    }, []);
}
`,

			// Binding.map() returns a stable binding
			`
function Component() {
    const binding = useBinding(0);
    const mapped = binding.map(x => x * 2);
    useEffect(() => {
        console.log(mapped);
    }, []);
}
`,

			// React.joinBindings().map() chained call is stable
			`
function Component() {
    const scaleBinding = React.joinBindings({ a, b }).map(({ a, b }) => a + b);
    useMemo(() => {
        return scaleBinding.map(scale => scale * 2);
    }, []);
}
`,

			// Module-level constants should not be dependencies
			`
const log = { Warning: () => {}, Info: () => {} };
function Component() {
    useEffect(() => {
        log.Warning("test");
        log.Info("info");
    }, []);
}
`,

			// Outer function scope should not be dependencies
			`
function useOuter() {
    const helper = () => {};

    function useInner() {
        useEffect(() => {
            helper();
        }, []);
    }
}
`,

			// Component-scope literal constant is stable
			`
function Component() {
    const x = 1;
    const y = "string";
    const z = null;
    useEffect(() => {
        console.log(x, y, z);
    }, []);
}
`,
			`
function Component() {
    const value = 10;
    useMemo(() => {
        if (value === undefined) return null;
        return value;
    }, [value]);
}
`,
			`
function Component() {
    useCallback(() => {
        return Promise.resolve();
    }, []);
}
`,
			`
function Component() {
    useEffect(() => {
        console.log(Math.PI);
    }, []);
}
`,
			`
function Component() {
    useMemo(() => {
        const arr = new Array();
        return arr;
    }, []);
}
`,
			`
function Component() {
    useEffect(() => {
        const map = new Map();
        const set = new Set();
        const date = new Date();
    }, []);
}
`,
			// Local loop variable in useMemo with shadowing
			`
function Component() {
    const i = 10;
    const items = [1, 2, 3];
    useMemo(() => {
        for (let i = 0; i < items.length; i++) {
            console.log(i);
        }
    }, [items]);
}
`,
			// Shadowing variable in nested block
			`
function Component() {
    const local = 10;
    useMemo(() => {
        {
            let local = 0;
            console.log(local);
        }
    }, []);
}
`,

			// Optional chaining - basic
			`
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj?.prop]);
}
`,

			// Optional chaining - chained access
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested?.value, [obj?.nested?.value]);
}
`,

			// Optional chaining - mixed (optional then regular)
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj?.nested.value, [obj?.nested.value]);
}
`,

			// Optional chaining - mixed (regular then optional)
			`
function Component() {
    const obj = { nested: { value: 1 } };
    useMemo(() => obj.nested?.value, [obj.nested?.value]);
}
`,

			// Optional chaining - parent dependency covers optional access
			`
function Component() {
    const obj = { prop: 1 };
    useMemo(() => obj?.prop, [obj]);
}
`,

			// Optional chaining with method call
			`
function Component({ obj }) {
    useMemo(() => obj?.method(), [obj]);
}
`,

			// Array.map() - should only require the array, not the method
			`
function Component({ items }) {
    useMemo(() => items.map(x => x * 2), [items]);
}
`,

			// Chained method calls - should only require the root object
			`
function Component({ items }) {
    useMemo(() => items.filter(x => x > 1).map(x => x * 2), [items]);
}
`,

			// Deep chained methods
			`
function Component({ data }) {
    useMemo(() => data.users.filter(x => x > 0).map(x => x * 2).slice(0, 2), [data.users]);
}
`,

			// Method call on nested property
			`
function Component({ obj }) {
    useMemo(() => obj.nested.items.map(x => x * 2), [obj.nested.items]);
}
`,

			// Non-null assertion - should require the root object
			{
				code: `
function Component({ foo }) {
    useMemo(() => foo!.bar, [foo]);
}
`,
				languageOptions: { parser },
			},

			// Nested non-null assertions
			{
				code: `
function Component({ foo }) {
    useMemo(() => foo!.bar!.baz, [foo]);
}
`,
				languageOptions: { parser },
			},

			// Mixed optional chaining and non-null assertion
			{
				code: `
function Component({ foo }) {
    useMemo(() => foo?.bar!.baz, [foo]);
}
`,
				languageOptions: { parser },
			},

			// Non-null assertion with method call
			{
				code: `
function Component({ obj }) {
    useMemo(() => obj!.items.map(x => x * 2), [obj]);
}
`,
				languageOptions: { parser },
			},

			// Object literal with property name same as outer variable - only value is a capture
			`
function Component() {
    const cellPadding = { x: 1 };
    const resolvedCellPadding = cellPadding ?? { x: 0 };
    useMemo(() => ({ cellPadding: resolvedCellPadding }), [resolvedCellPadding]);
}
`,

			// Object literal with multiple properties - only values are captures
			`
function Component() {
    const a = 1;
    const b = 2;
    useMemo(() => ({ a, b: b * 2 }), [a, b]);
}
`,

			// Computed property key IS a capture
			`
function Component() {
    const key = "prop";
    const value = 1;
    useMemo(() => ({ [key]: value }), [key, value]);
}
`,

			// Recursive useCallback - self-reference should NOT be a dependency
			`
function Component() {
    const toggle = useCallback((key) => {
        if (key === "other") {
            toggle("self");
        }
    }, []);
}
`,

			// Recursive useCallback with other dependencies
			`
function Component() {
    const [count] = useState(0);
    const toggle = useCallback((key) => {
        console.log(count);
        if (key === "other") {
            toggle("self");
        }
    }, [count]);
}
`,

			// UseMemo returning a function that references itself via closure variable
			`
function Component() {
    const factorial = useMemo(() => {
        const compute = (n) => n <= 1 ? 1 : n * compute(n - 1);
        return compute;
    }, []);
}
`,

			// Multiple assigned variables - none should be dependencies
			`
function Component() {
    const [state, toggle] = useCustomHook(() => {
        toggle();
    }, []);
}
`,
		],
	});

	// @ts-expect-error - RuleTester types are incorrect for suggestions
	jsx.run("use-exhaustive-dependencies", rule, {
		invalid: [
			// Custom hook with missing dependency
			{
				code: `
function Component() {
    const [count, setCount] = useState(0);
    useCustomHook(() => {
        console.log(count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component() {
    const [count, setCount] = useState(0);
    useCustomHook(() => {
        console.log(count);
    }, [count]);
}
`,
							},
						],
					},
				],
				options: [
					{
						hooks: [
							{
								closureIndex: 0,
								dependenciesIndex: 1,
								name: "useCustomHook",
							},
						],
					},
				],
				output: `
function Component() {
    const [count, setCount] = useState(0);
    useCustomHook(() => {
        console.log(count);
    }, [count]);
}
`,
			},
			// Unlisted object properties from a stable custom hook are still required
			{
				code: `
function Component() {
    const { setter, value } = useCustomState();
    useEffect(() => {
        value();
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'value' to dependencies array",
								output: `
function Component() {
    const { setter, value } = useCustomState();
    useEffect(() => {
        value();
    }, [value]);
}
`,
							},
						],
					},
				],
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: ["setter"],
							},
						],
					},
				],
				output: `
function Component() {
    const { setter, value } = useCustomState();
    useEffect(() => {
        value();
    }, [value]);
}
`,
			},
		],
		valid: [
			// Disable reportUnnecessaryDependencies
			{
				code: `
function Component() {
    const b = 1;
    useEffect(() => {}, [b]);
}
`,
				options: [
					{
						reportUnnecessaryDependencies: false,
					},
				],
			},

			// Disable reportMissingDependenciesArray
			{
				code: `
function Component() {
    const a = 1;
    useEffect(() => {
        console.log(a);
    });
}
`,
				options: [
					{
						reportMissingDependenciesArray: false,
					},
				],
			},

			// Custom hook with correct dependencies
			{
				code: `
function Component() {
    const a = 1;
    useCustomHook(() => {
        console.log(a);
    }, [a]);
}
`,
				options: [
					{
						hooks: [
							{
								closureIndex: 0,
								dependenciesIndex: 1,
								name: "useCustomHook",
							},
						],
					},
				],
			},

			// Custom hook with stable result
			{
				code: `
function Component() {
    const setter = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: true,
							},
						],
					},
				],
			},

			// Custom hook with stable array index
			{
				code: `
function Component() {
    const [state, setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: [1],
							},
						],
					},
				],
			},

			// Custom hook with stable object property
			{
				code: `
function Component() {
    const { setter } = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: ["setter"],
							},
						],
					},
				],
			},
			{
				code: `
function Component() {
    const { setter: setValue = () => {} } = useCustomState();
    useEffect(() => {
        setValue(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: ["setter"],
							},
						],
					},
				],
			},
			{
				code: `
function Component() {
    const { "set-value": setValue } = useCustomState();
    useEffect(() => {
        setValue(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: ["set-value"],
							},
						],
					},
				],
			},
			{
				code: `
function Component() {
    const { setter, ...rest } = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: ["setter"],
							},
						],
					},
				],
			},

			// Coverage: React.useEffect
			`
function Component() {
    React.useEffect(() => {}, []);
}
`,
			// Coverage: Computed property in dependency
			`
function Component() {
    const key = "prop";
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj[key]);
    }, [obj[key]]);
}
`,
			{
				code: `
function Component() {
    const a = 1;
    const b = 2;
    const c = true;
    const d = 4;
    useEffect(() => {
        console.log(a, b, c, d);
    }, [a && b, c ? d : a]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [+value, \`\${value}\`]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [(value as number)!]);
}
`,
				languageOptions: { parser },
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [condition ? value : fallback]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component() {
    const obj = { prop: 1 };
    useEffect(() => {
        console.log(obj);
    }, [obj?.prop]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [value as number]);
}
`,
				languageOptions: { parser },
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component({ value }) {
    useEffect(() => {
        console.log(value);
    }, [value + 1]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component() {
    const value = 1;
    const fallback = 0;
    useEffect(() => {
        console.log(value, fallback);
    }, [value ?? fallback]);
}
`,
				options: [{ reportUnnecessaryDependencies: false }],
			},
			{
				code: `
function Component() {
    const value = 1;
    useEffect(() => {
        type Value = typeof value;
        const local: Value = 1;
        console.log(local);
    }, []);
}
`,
				languageOptions: { parser },
			},
			`
function Component() {
    function helper() {}
    useEffect(() => {
        helper();
    }, []);
}
`,
			// Coverage: Stable unary expression
			`
function Component() {
    const a = -1;
    useEffect(() => {
        console.log(a);
    }, []);
}
`,
			// Coverage: Function reference as hook argument
			`
function Component() {
    const handler = useCallback(() => {}, []);
    useEffect(handler, []);
}
`,
			`
const count = 0;
const handler = () => {
    console.log(count);
};

function Component() {
    useEffect(handler, []);
}
`,
			// Non-callback hook arguments are ignored
			`
function Component() {
    const handler = 1;
    useEffect(handler, []);
}
`,
			`
function Component() {
    useEffect(createHandler(), []);
}
`,
			// Non-array dependency argument is ignored
			`
function Component() {
    const count = props.count;
    useEffect(() => {
        console.log(count);
    }, getDependencies());
}
`,
			// Computed member hook names are ignored
			`
function Component() {
    const count = props.count;
    React["useEffect"](() => {
        console.log(count);
    }, []);
}
`,
			// Sparse stable result destructuring still counts concrete indexes
			{
				code: `
function Component() {
    const [, , setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: [2],
							},
						],
					},
				],
			},
			{
				code: `
function Component() {
    const [setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				options: [
					{
						hooks: [
							{
								name: "useCustomState",
								stableResult: [0],
							},
						],
					},
				],
			},
		],
	});

	describe("t4 behavior lock: option-sensitive and import-sensitive interactions", () => {
		// @ts-expect-error - RuleTester types are incorrect for suggestions
		jsx.run("use-exhaustive-dependencies - reportUnnecessaryStableDependencies", rule, {
			invalid: [
				{
					code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [setCount]);
}
`,
					errors: [
						{
							messageId: "unnecessaryDependency",
							suggestions: [
								{
									desc: "Remove 'setCount' from dependencies array",
									output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
								},
							],
						},
						{
							messageId: "missingDependency",
							suggestions: [
								{
									desc: "Add 'count' to dependencies array",
									output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count, setCount]);
}
`,
								},
							],
						},
					],
					options: [{ reportUnnecessaryStableDependencies: true }],
					output: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, []);
}
`,
				},
			],
			valid: [
				{
					code: `
function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        console.log(count);
    }, [count]);
}
`,
					options: [{ reportUnnecessaryStableDependencies: true }],
				},
			],
		});

		// @ts-expect-error - RuleTester types are incorrect for suggestions
		jsx.run("use-exhaustive-dependencies - resolveExpressionDependencies false", rule, {
			invalid: [
				{
					code: `
function Component({ count }) {
    useEffect(() => {
        console.log(count);
    }, [count + 1]);
}
`,
					errors: [
						{
							messageId: "missingDependency",
							suggestions: [
								{
									desc: "Add 'count' to dependencies array",
									output: `
function Component({ count }) {
    useEffect(() => {
        console.log(count);
    }, [count, count + 1]);
}
`,
								},
							],
						},
					],
					options: [{ reportUnnecessaryDependencies: false, resolveExpressionDependencies: false }],
					output: `
function Component({ count }) {
    useEffect(() => {
        console.log(count);
    }, [count, count + 1]);
}
`,
				},
			],
			valid: [
				{
					code: `
function Component() {
    const obj = { prop: 1 };
    const key = "prop";
    useEffect(() => {
        console.log(obj[key]);
    }, [obj]);
}
`,
					options: [{ resolveExpressionDependencies: false }],
				},
			],
		});
	});
});

describe("use-exhaustive-dependencies - coverage locks", () => {
	// @ts-expect-error - RuleTester types are incorrect for suggestions
	jsx.run("use-exhaustive-dependencies - coverage locks", rule, {
		invalid: [
			{
				code: `
function Component() {
    const [setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'setter' to dependencies array",
								output: `
function Component() {
    const [setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, [setter]);
}
`,
							},
						],
					},
				],
				options: [{ hooks: [{ name: "useCustomState", stableResult: [1] }] }],
				output: `
function Component() {
    const [setter] = useCustomState();
    useEffect(() => {
        setter(1);
    }, [setter]);
}
`,
			},
		],
		valid: [
			{
				code: `
const tracker = createTracker();

function Component() {
    useEffect(() => {
        tracker.flush();
    }, []);
}
`,
			},
			{
				code: `
const DEFAULT_TITLE = "Home";

function Component({ count }) {
    const deps = [count];
    useEffect(() => {
        console.log(DEFAULT_TITLE, count);
    }, deps);
}
`,
			},
		],
	});

	// @ts-expect-error - RuleTester types are incorrect for suggestions
	ts.run("use-exhaustive-dependencies - type assertion coverage locks", rule, {
		invalid: [
			{
				code: `
function Component({ count }) {
    useEffect(() => {
        console.log(<number>count);
    }, []);
}
`,
				errors: [
					{
						messageId: "missingDependency",
						suggestions: [
							{
								desc: "Add 'count' to dependencies array",
								output: `
function Component({ count }) {
    useEffect(() => {
        console.log(<number>count);
    }, [count]);
}
`,
							},
						],
					},
				],
				output: `
function Component({ count }) {
    useEffect(() => {
        console.log(<number>count);
    }, [count]);
}
`,
			},
		],
		valid: [],
	});
});
