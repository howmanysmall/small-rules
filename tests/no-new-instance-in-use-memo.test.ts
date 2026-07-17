import { describe } from "vitest";
import rule from "$oxc-rules/no-new-instance-in-use-memo";

import { ts } from "./rule-testers";

describe("no-new-instance-in-use-memo", () => {
	ts.run("no-new-instance-in-use-memo", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo(() => {
    return new Instance("Model");
}, []);
`,
				documentation: { id: "fail", title: "New instance inside memo" },
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const value = useMemo(() => {
    const model = new Instance("Model");
    const part = new Instance("Part");
    return [model, part];
}, []);
`,
				errors: [
					{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" },
					{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" },
				],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const parts = useMemo(() => {
    return [1, 2, 3].map(() => new Instance("Part"));
}, []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import * as React from "@rbxts/react";

const model = React.useMemo(() => new Instance("Model"), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo as memo } from "@rbxts/react";

const model = memo(() => new Instance("Model"), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const value = useMemo(() => new Vector3(1, 2, 3), []);
`,
				errors: [{ data: { constructorName: "Vector3" }, messageId: "noNewInUseMemo" }],
				options: [{ constructors: ["Vector3"] }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function createUnitModel(unitId: string) {
    const model = new Instance("Model");
    model.Name = unitId;
    return model;
}

const unitModel = useMemo(() => createUnitModel("abc"), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = () => new Instance("Part");
const part = useMemo(createPart, []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = function() {
    return new Instance("Part");
};

const part = useMemo(createPart, []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = () => new Instance("Part");
const aliasPart = createPart;
const part = useMemo(aliasPart, []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = () => new Instance("Part");
const aliasPart = createPart;
const first = useMemo(aliasPart, []);
const second = useMemo(aliasPart, []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function makeLeaf() {
    return new Instance("Part");
}

function makeBranch() {
    return makeLeaf();
}

const value = useMemo(() => makeBranch(), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function makeLeaf() {
    return new Instance("Part");
}

function makeBranch() {
    makeLeaf();
    return makeLeaf();
}

const value = useMemo(() => makeBranch(), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const model = useMemo(() => new Instance("Model"), []);
`,
				errors: [{ data: { constructorName: "Instance" }, messageId: "noNewInUseMemo" }],
				options: [{ environment: "standard" }],
			},
		],
		valid: [
			{
				code: `
function useMemo(factory) {
    return factory();
}

const model = useMemo(() => new Instance("Model"), []);
`,
				documentation: { id: "pass", title: "Non-React memo function" },
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

useMemo();
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo("not a callback", []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo(missingCallback, []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = condition ? () => new Instance("Part") : () => new Instance("Model");
const model = useMemo(createPart, []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function Component(createPart: () => Instance) {
    return useMemo(createPart, []);
}
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

let createPart: (() => Instance) | undefined;
const part = useMemo(createPart, []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = missingCallback;
const part = useMemo(createPart, []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo(() => new constructors.Instance("Model"), []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = new Instance("Model");
const memoized = useMemo(() => model, []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const size = useMemo(() => new Vector3(1, 2, 3), []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo(() => new Instance("Model"), []);
`,
				options: [{ constructors: [] }],
			},
			{
				code: `
import { useMemo } from "react";

const model = useMemo(() => new Instance("Model"), []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const model = useMemo(() => new Instance("Model"), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = () => new Instance("Part");
const part = createPart();
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function makeLeaf() {
    return new Instance("Part");
}

function makeBranch() {
    return makeLeaf();
}

const value = useMemo(() => makeBranch(), []);
`,
				options: [{ maxHelperTraceDepth: 0 }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

function makeLeaf() {
    return new Instance("Part");
}

function makeBranch() {
    return makeLeaf();
}

const value = useMemo(() => makeBranch(), []);
`,
				options: [{ maxHelperTraceDepth: 1 }],
			},
			{
				code: `
import React from "@rbxts/react";

const value = React.useMemo(() => ({ value: 1 }), []);
`,
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const createPart = aliasPart;
const aliasPart = createPart;

const value = useMemo(createPart, []);
`,
			},
		],
	});
});
