import { describe } from "vitest";
import rule from "$oxc-rules/memoized-effect-dependencies";

import { ts } from "./rule-testers";

describe("memoized-effect-dependencies", () => {
	ts.run("memoized-effect-dependencies", rule, {
		invalid: [
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dep = () => {};
    React.useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

class Foo {}

function Component() {
    useEffect(() => {}, [() => {}, {}, [], new Foo()]);
}
`,
				errors: [
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
					{ messageId: "unmemoizedDependency" },
				],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function compute() {
    return {};
}

function Component() {
    const dep = compute();
    useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    const stableRef = useRef({});
    let dep = stableRef;
    useEffect(() => {}, [dep]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "aggressive" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const dependency = buildDependency();
    React.useLayoutEffect(() => {}, [dependency]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependencies = getDependencies();
    useEffect(() => {}, [...dependencies]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ mode: "moderate" }],
			},
			{
				code: `
import { useCustomEffect } from "@rbxts/react";

function Component() {
    const dependency = {};
    useCustomEffect(() => {}, [dependency]);
}
`,
				errors: [{ messageId: "unmemoizedDependency" }],
				options: [{ hooks: [{ name: "useCustomEffect" }] }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useMemo, useCallback } from "@rbxts/react";

function Component() {
    const memo = useMemo(() => ({}), []);
    const callback = useCallback(() => {}, []);
    useEffect(() => {}, [memo, callback]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {}, [setCount]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

const stable = {};

function Component() {
    useEffect(() => {}, [stable]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(props: { value: number }) {
    useEffect(() => {}, [props.value]);
}
`,
			},
			{
				code: `
import * as React from "@rbxts/react";

function Component() {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {}, [setCount]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const binding = React.useBinding(0);
    React.useEffect(() => {}, [binding]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component() {
    const memo = React.useMemo(() => ({}), []);
    const ref = React.useRef({});
    React.useEffect(() => {}, [memo, ref]);
}
`,
			},
			{
				code: `
import { useEffect, useTransition } from "@rbxts/react";

function Component() {
    const [pending, startTransition] = useTransition();
    useEffect(() => {}, [startTransition]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency = createDependency();
    useEffect(() => {}, [dependency]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [buildDependency()]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [, setCount] = useState(0);
    useEffect(() => {}, [setCount]);
}
`,
			},
			{
				code: `
import { useEffect, useMemo } from "react";

function Component() {
    const memo = useMemo(() => ({}), []);
    useEffect(() => {}, [memo]);
}
`,
				options: [{ environment: "standard" }],
			},
		],
	});

	describe("t4 behavior lock: import aliasing and scope resolution", () => {
		ts.run("memoized-effect-dependencies - renamed imports", rule, {
			invalid: [
				{
					code: `
import { useEffect as myEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    myEffect(() => {}, [dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
				},
			],
			valid: [
				{
					code: `
import { useEffect as myEffect, useMemo as myMemo, useCallback as myCallback } from "@rbxts/react";

function Component() {
    const memo = myMemo(() => ({}), []);
    const callback = myCallback(() => {}, []);
    myEffect(() => {}, [memo, callback]);
}
`,
				},
			],
		});

		ts.run("memoized-effect-dependencies - namespace import", rule, {
			invalid: [
				{
					code: `
import * as React from "@rbxts/react";

function Component() {
    const dep = {};
    React.useEffect(() => {}, [dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
				},
			],
			valid: [
				{
					code: `
import * as React from "@rbxts/react";

function Component() {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {}, [setCount]);
}
`,
				},
			],
		});

		ts.run("memoized-effect-dependencies - aggressive let reassignment", rule, {
			invalid: [
				{
					code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    let dep = useRef({});
    useEffect(() => {}, [dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "aggressive" }],
				},
			],
			valid: [
				{
					code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    const ref = useRef({});
    useEffect(() => {}, [ref]);
}
`,
					options: [{ mode: "aggressive" }],
				},
			],
		});

		ts.run("memoized-effect-dependencies - custom hooks option", rule, {
			invalid: [
				{
					code: `
import { useCustomEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useCustomEffect(() => {}, [dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ hooks: [{ name: "useCustomEffect" }] }],
				},
			],
			valid: [
				{
					code: `
import { useCustomEffect, useMemo } from "@rbxts/react";

function Component() {
    const memo = useMemo(() => ({}), []);
    useCustomEffect(() => {}, [memo]);
}
`,
					options: [{ hooks: [{ name: "useCustomEffect" }] }],
				},
			],
		});
	});

	describe("coverage behavior lock", () => {
		ts.run("memoized-effect-dependencies - dependency array shapes", rule, {
			invalid: [
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, [dep, dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }, { messageId: "unmemoizedDependency" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [buildDependency()]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component(props: { value: number }) {
    useEffect(() => {}, [props.value]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "aggressive" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, [, dep]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    let dependency;
    useEffect(() => {}, [dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
				{
					code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count, , resetCount] = useState(0);
    useEffect(() => {}, [resetCount]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "aggressive" }],
				},
				{
					code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count, { resetCount }] = useState(0);
    useEffect(() => {}, [resetCount]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "aggressive" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency = getFactory()();
    useEffect(() => {}, [dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency = {};
    useEffect(() => {}, [dependency, dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }, { messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
			],
			valid: [
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependencies = getDependencies();
    useEffect(() => {}, [...dependencies]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useEffect(() => {}, deps);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [value + 1]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, [missingDependency]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency = {};
    getEffect()(() => {}, [dependency]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    try {
        run();
    } catch (dependency) {
        useEffect(() => {}, [dependency]);
    }
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";
import { stableDependency } from "shared";

function Component() {
    useEffect(() => {}, [stableDependency]);
}
`,
				},
			],
		});

		ts.run("memoized-effect-dependencies - member hook forms", rule, {
			invalid: [
				{
					code: `
import React from "@rbxts/react";

function Component() {
    function buildDependency() {
        return {};
    }

    class Dependency {}

    React.useEffect(() => {}, [buildDependency, Dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }, { messageId: "unmemoizedDependency" }],
				},
			],
			valid: [
				{
					code: `
import React from "@rbxts/react";

function Component() {
    const dep = {};
    React["useEffect"](() => {}, [dep]);
}
`,
				},
				{
					code: `
import React from "@rbxts/react";

function Component() {
    const dep = {};
    getReact().useEffect(() => {}, [dep]);
}
`,
				},
				{
					code: `
import Other from "other";
import React from "@rbxts/react";

function Component() {
    const dep = {};
    Other.useEffect(() => {}, [dep]);
}
`,
				},
				{
					code: `
import { useEffect } from "other";

function Component() {
    const dep = {};
    useEffect(() => {}, [dep]);
}
`,
				},
			],
		});

		ts.run("memoized-effect-dependencies - stable hook destructuring", rule, {
			invalid: [
				{
					code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count] = useState(0);
    useEffect(() => {}, [count]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "aggressive" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";
import { useDependency } from "dependencies";

function Component() {
    const dependency = useDependency();
    useEffect(() => {}, [dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
				{
					code: `
import { useEffect } from "@rbxts/react";
import Other from "other";

function Component() {
    const dependency = Other.useRef({});
    useEffect(() => {}, [dependency]);
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ mode: "moderate" }],
				},
			],
			valid: [
				{
					code: `
import { useEffect, useReducer } from "@rbxts/react";

function reducer(state: number) {
    return state;
}

function Component() {
    const [, dispatch] = useReducer(reducer, 0);
    useEffect(() => {}, [dispatch]);
}
`,
				},
				{
					code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const fallback = () => {};
    const [count, setCount = fallback] = useState(0);
    useEffect(() => {}, [setCount]);
}
`,
				},
				{
					code: `
import { useEffect, useTransition } from "@rbxts/react";

function Component() {
    const [, ...transitionControls] = useTransition();
    useEffect(() => {}, [transitionControls]);
}
`,
				},
				{
					code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count] = useState(0);
    useEffect(() => {}, [count]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    let dependency = {};
    useEffect(() => {}, [dependency]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency: unknown = undefined;
    useEffect(() => {}, [dependency]);
}
`,
				},
				{
					code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const dependency = 1;
    useEffect(() => {}, [dependency]);
}
`,
				},
			],
		});

		ts.run("memoized-effect-dependencies - custom dependency index", rule, {
			invalid: [
				{
					code: `
import { useIndexedEffect } from "@rbxts/react";

function Component() {
    const dep = {};
    useIndexedEffect([dep], () => {});
}
`,
					errors: [{ messageId: "unmemoizedDependency" }],
					options: [{ hooks: [{ dependenciesIndex: 0, name: "useIndexedEffect" }] }],
				},
			],
			valid: [
				{
					code: `
import { useIndexedEffect, useMemo } from "@rbxts/react";

function Component() {
    const dep = useMemo(() => ({}), []);
    useIndexedEffect([dep], () => {});
}
`,
					options: [{ hooks: [{ dependenciesIndex: 0, name: "useIndexedEffect" }] }],
				},
			],
		});
	});
});
