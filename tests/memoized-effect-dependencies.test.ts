import { describe } from "vitest";
import rule from "$oxc-rules/memoized-effect-dependencies";

import { ts } from "./rule-testers";

describe("memoized-effect-dependencies", () => {
	// @ts-expect-error -- Shut up
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
		],
	});

	describe("t4 behavior lock: import aliasing and scope resolution", () => {
		// @ts-expect-error -- Shut up
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

		// @ts-expect-error -- Shut up
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

		// @ts-expect-error -- Shut up
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

		// @ts-expect-error -- Shut up
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
});
