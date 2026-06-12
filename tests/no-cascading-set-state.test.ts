import { describe } from "vitest";
import rule from "$oxc-rules/no-cascading-set-state";

import { ts } from "./rule-testers";

describe("no-cascading-set-state", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("no-cascading-set-state", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	useEffect(() => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
		setThirdValue(thirdValue + 1);
	}, [firstValue, secondValue, thirdValue]);
}
`,
				errors: [{ messageId: "cascadingSetState" }],
			},
			{
				code: `
import { useLayoutEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	useLayoutEffect(() => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
		setThirdValue(thirdValue + 1);
	}, [firstValue, secondValue, thirdValue]);
}
`,
				errors: [{ messageId: "cascadingSetState" }],
			},
			{
				code: `
import { useMountEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	useMountEffect(() => {
		const applyUpdates = () => {
			setFirstValue(firstValue + 1);
			setSecondValue(secondValue + 1);
		};

		applyUpdates();
		setThirdValue(thirdValue + 1);
	});
}
`,
				errors: [{ messageId: "cascadingSetState" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);

	useEffect(() => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
	}, [firstValue, secondValue]);
}
`,
			},
			{
				code: `
import { useMemo, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	useMemo(() => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
		setThirdValue(thirdValue + 1);
	}, [firstValue, secondValue, thirdValue]);
}
`,
			},
			{
				code: `
import { useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	useCustomEffect(() => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
		setThirdValue(thirdValue + 1);
	}, [firstValue, secondValue, thirdValue]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);
	const [thirdValue, setThirdValue] = useState(0);

	const callback = () => {
		setFirstValue(firstValue + 1);
		setSecondValue(secondValue + 1);
		setThirdValue(thirdValue + 1);
	};

	useEffect(callback, [firstValue, secondValue, thirdValue]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
	const [firstValue, setFirstValue] = useState(0);
	const [secondValue, setSecondValue] = useState(0);

	useEffect(() => {
		store.setValue(firstValue);
		store.setValue(secondValue);
	}, [firstValue, secondValue]);
}
`,
			},
		],
	});
});
