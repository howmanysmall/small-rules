import { describe } from "vitest";
import rule from "$oxc-rules/use-hook-at-top-level";

import { jsx } from "./rule-testers";

describe("use-hook-at-top-level", () => {
	// @ts-expect-error -- shut up
	jsx.run("use-hook-at-top-level", rule, {
		invalid: [
			// Conditional execution - if statement
			{
				code: `
function Component() {
    if (condition) {
        useEffect(() => {});
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Conditional execution - ternary operator
			{
				code: `
function Component() {
    const x = condition ? useCallback(() => {}) : null;
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Conditional execution - logical AND
			{
				code: `
function Component() {
    condition && useEffect(() => {});
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Conditional execution - logical OR
			{
				code: `
function Component() {
    condition || useMemo(() => {});
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Conditional execution - switch statement
			{
				code: `
function Component() {
    switch (value) {
        case 1:
            useMemo(() => {});
            break;
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Early return
			{
				code: `
function Component() {
    if (condition) return null;
    useEffect(() => {});
}
`,
				errors: [{ messageId: "afterEarlyReturn" }],
			},

			// Multiple early returns
			{
				code: `
function Component() {
    if (a) return null;
    if (b) return null;
    useEffect(() => {});
}
`,
				errors: [{ messageId: "afterEarlyReturn" }],
			},

			// Loop - for statement
			{
				code: `
function Component() {
    for (let i = 0; i < 10; i++) {
        useState(i);
    }
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Loop - while statement
			{
				code: `
function Component() {
    while (condition) {
        useEffect(() => {});
    }
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Loop - do-while statement
			{
				code: `
function Component() {
    do {
        useMemo(() => {});
    } while (condition);
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Loop - for-of statement
			{
				code: `
function Component() {
    for (const item of items) {
        useCallback(() => {});
    }
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Loop - for-in statement
			{
				code: `
function Component() {
    for (const key in object) {
        useState(0);
    }
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Nested function - arrow function
			{
				code: `
function Component() {
    const helper = () => {
        useState(0);
    };
}
`,
				errors: [{ messageId: "nestedFunction" }],
			},

			// Nested function - function expression
			{
				code: `
function Component() {
    const helper = function() {
        useEffect(() => {});
    };
}
`,
				errors: [{ messageId: "nestedFunction" }],
			},

			// Nested function - function declaration
			{
				code: `
function Component() {
    function helper() {
        useMemo(() => {});
    }
}
`,
				errors: [{ messageId: "nestedFunction" }],
			},

			// Try block
			{
				code: `
function Component() {
    try {
        useEffect(() => {});
    } catch (error) {}
}
`,
				errors: [{ messageId: "tryBlockHook" }],
			},

			// Catch block
			{
				code: `
function Component() {
    try {
        something();
    } catch (error) {
        useState(0);
    }
}
`,
				errors: [{ messageId: "tryBlockHook" }],
			},

			// Recursive call
			{
				code: `
function useRecursive() {
    const callback = useCallback(() => {
        useRecursive();
    }, []);
}
`,
				errors: [{ messageId: "recursiveHookCall" }],
			},

			// Custom hook - arrow function
			{
				code: `
const useCustom = () => {
    if (condition) {
        useState(0);
    }
};
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// React Lua - useBinding in conditional
			{
				code: `
function Component() {
    if (condition) {
        useBinding(0);
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// React Lua - useBinding in loop
			{
				code: `
function Component() {
    for (let i = 0; i < 10; i++) {
        useBinding(i);
    }
}
`,
				errors: [{ messageId: "loopHook" }],
			},

			// Complex nesting
			{
				code: `
function Component() {
    if (a) {
        if (b) {
            useEffect(() => {});
        }
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
			},

			// Hook after conditional with early return
			{
				code: `
function Component() {
    if (loading) return <div>Loading</div>;
    useMemo(() => {});
}
`,
				errors: [{ messageId: "afterEarlyReturn" }],
			},

			// Configuration: onlyHooks should only check specified hooks
			{
				code: `
function Component() {
    if (condition) {
        useState(0);
        useEffect(() => {});
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
				options: [{ onlyHooks: ["useState"] }],
			},

			// Configuration: importSources - should check React hooks
			{
				code: `
import { useState } from 'react';
function Component() {
    if (condition) {
        useState(0);
    }
}
`,
				errors: [{ messageId: "conditionalHook" }],
				options: [{ importSources: { "my-ecs": false, react: true } }],
			},
		],
		valid: [
			// Basic top-level call
			`
function Component() {
    useEffect(() => {});
}
`,

			// Multiple hooks at top level
			`
function Component() {
    useState(0);
    useEffect(() => {});
    useMemo(() => {});
}
`,

			// Conditional logic inside hook
			`
function Component() {
    useEffect(() => {
        if (condition) {
            doSomething();
        }
    });
}
`,

			// Custom hook
			`
function useCustom() {
    const [state, setState] = useState(0);
    useEffect(() => {});
    return state;
}
`,

			// Arrow function component
			`
const Component = () => {
    useEffect(() => {});
};
`,

			// Function expression component
			`
const Component = function() {
    useState(0);
};
`,

			// Finally block (always executes)
			`
function Component() {
    try {
        something();
    } finally {
        useEffect(() => {});
    }
}
`,

			// Non-hook function calls in conditionals (should not error)
			`
function Component() {
    if (condition) {
        doSomething();
    }
}
`,

			// Hook before early return
			`
function Component() {
    useEffect(() => {});
    if (condition) return null;
}
`,

			// Hook IN return statement (not after)
			`
function Component() {
    return useMemo(() => ({ value: 1 }), []);
}
`,

			// Hook IN return statement with complex expression
			`
function usePixel() {
    const binding = useBinding(0);
    return useMemo(
        () => ({
            scale: (value) => binding.map(b => value * b),
        }),
        [],
    );
}
`,

			// Non-component function (hooks don't apply)
			`
function helper() {
    if (condition) {
        useEffect(() => {});
    }
}
`,

			// React Lua - useBinding at top level
			`
function Component() {
    const [binding, setBinding] = useBinding(0);
}
`,

			// React Lua - useBinding in custom hook
			`
function useCustomBinding() {
    const [binding, setBinding] = useBinding(0);
    return binding;
}
`,

			// Member expression hook call
			`
function Component() {
    React.useEffect(() => {});
}
`,

			// Multiple custom hooks
			`
function useMultiple() {
    useEffect(() => {});
    useCallback(() => {});
    useMemo(() => {});
}
`,

			// Hooks with all standard names
			`
function Component() {
    useState(0);
    useEffect(() => {});
    useContext(Context);
    useReducer(reducer, initial);
    useCallback(() => {});
    useMemo(() => {});
    useRef(null);
    useImperativeHandle(ref, () => ({}));
    useLayoutEffect(() => {});
    useDebugValue("label");
}
`,

			// Component with props
			`
function Component(props) {
    useEffect(() => {
        console.log(props);
    });
}
`,

			// Arrow function with implicit return
			`
const Component = () => {
    const value = useMemo(() => expensive());
    return value;
};
`,

			// Hooks in object method that looks like component
			`
    const obj = {
        Component() {
            useState(0);
        }
    };
    `,
			// Hooks in class method that looks like component
			`
    class Foo {
        Component() {
            useState(0);
        }
    }
    `,

			// All React Lua hooks
			`
    function Component() {
        useState(0);
    useEffect(() => {});
        useBinding(0);
    }
    `,

			// Configuration: importSources - no matching import should fall back to checking the hook
			{
				code: `
    function Component() {
        useState(0);
    }
    `,
				options: [{ importSources: { react: true } }],
			},

			// Configuration: ignoreHooks - should ignore specified hooks
			{
				code: `
    function Component() {
        if (condition) {
        useEntity(0);
        useComponent(0);
    }
    useState(0);
}
`,
				options: [{ ignoreHooks: ["useEntity", "useComponent"] }],
			},

			// Configuration: onlyHooks - should only check specified hooks
			{
				code: `
function Component() {
    useEntity(0);
    if (condition) {
        useComponent(0);
    }
    useCustomHook(0);
}
`,
				options: [{ onlyHooks: ["useState", "useEffect"] }],
			},

			// Configuration: importSources - should ignore ECS hooks
			{
				code: `
import { useState } from 'react';
import { useState as useEcsState } from 'my-ecs';
function Component() {
    useState(0);
    if (condition) {
        useEcsState(0);
    }
}
`,
				options: [{ importSources: { "my-ecs": false, react: true } }],
			},

			// Configuration: importSources with member expressions
			{
				code: `
function Component() {
    if (condition) {
        ECS.useState(0);
    }
    React.useState(0);
}
`,
				options: [{ importSources: { ECS: false, React: true } }],
			},
		],
	});
});
