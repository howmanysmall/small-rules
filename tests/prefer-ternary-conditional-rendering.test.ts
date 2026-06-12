import { describe } from "vitest";
import rule from "$oxc-rules/prefer-ternary-conditional-rendering";

import { jsx } from "./rule-testers";

describe("prefer-ternary-conditional-rendering", () => {
	// @ts-expect-error - This is dumb
	jsx.run("prefer-ternary-conditional-rendering", rule, {
		invalid: [
			{
				code: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined && <uigradient key="ui-gradient" Color={gradient} />}{gradient === undefined && <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined ? <uigradient key="ui-gradient" Color={gradient} /> : <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
			},
			{
				code: "function Component({ flag }) { return <>{flag && <A />}{!flag && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{mode !== "x" && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{"x" !== mode && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
			},
			{
				code: "function Component() { return <>{isReady() && <A />}{!isReady() && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ mode }) { return <>{mode === getMode() && <A />}{mode !== getMode() && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ state }) { return <>{state.value === 1 && <A />}{state.value !== 1 && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ state }) { return <>{state[mode] === 1 && <A />}{state[mode] !== 1 && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ value, items }) { return <>{isReady(value, ...items) && <A />}{!isReady(value, ...items) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ flag, active }) { return <>{flag && active && <A />}{!(flag && active) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ value, offset }) { return <>{!(value + offset) && <A />}{value + offset && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component() { return <>{this === target && <A />}{this !== target && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component() { return <>{this === target ? <A /> : <B />}</>; }",
			},
			{
				code: "function Component({ flag }) { return <>{!flag && <A />}{flag && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{!flag ? <A /> : <B />}</>; }",
			},
			{
				code: "function Component({ flag }) { return <>{1 === flag && <A />}{flag !== 1 && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <>{1 === flag ? <A /> : <B />}</>; }",
			},
			{
				code: `
function Component({ flag }) {
    return (
        <>
            {flag && <><A /></>}
            {!flag && <><B /></>}
        </>
    );
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: `
function Component({ flag }) {
    return (
        <>
            {flag ? <><A /></> : <><B /></>}
        </>
    );
}
`,
			},
			{
				code: "function Component({ flag }) { return <frame>{flag && <A />}{!flag && <B />}</frame>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: "function Component({ flag }) { return <frame>{flag ? <A /> : <B />}</frame>; }",
			},
			{
				code: "function Component({ isReady, value }) { return <>{isReady?.(value) && <A />}{!isReady?.(value) && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ service }) { return <>{service?.state === this && <A />}{this !== service?.state && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: 'function Component({ getMode, mode, items }) { return <>{getMode(mode, ...items) === "x" && <A />}{"x" !== getMode(mode, ...items) && <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component({ flag }) { return <>{!!flag && <A />}{!flag && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "function Component() { return <>{new.target && <A />}{!new.target && <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "class Component { #state; render() { return <>{this.#state === 1 && <A />}{this.#state !== 1 && <B />}</>; } }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
			{
				code: "class Component { #state; render(value) { return <>{(#state in value) === true && <A />}{(#state in value) !== true && <B />}</>; } }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				output: null,
			},
		],
		valid: [
			"function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
			"function Component({ first, second }) { return <>{first && <A />}{second && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && doThing()}{!flag && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && <A />}</>; }",
			'function Component({ mode }) { return <>{mode === "x" && <A />}text{mode !== "x" && <B />}</>; }',
			"function Component({ flag }) { return <>{flag && <A />}<Spacer />{!flag && <B />}</>; }",
			"function Component({ first, second, third }) { return <>{first === second && <A />}{first !== third && <B />}</>; }",
			"function Component({ first, second }) { return <>{first < second && <A />}{first > second && <B />}</>; }",
			"function Component({ flag }) { return <>{flag || <A />}{!flag && <B />}</>; }",
			"function Component({ flag }) { return <>{flag && <A />}{/* comment */}{!flag && <B />}</>; }",
			"function Component({ isReady, value, other }) { return <>{isReady(value) && <A />}{!isReady(value, other) && <B />}</>; }",
			"function Component({ isReady }) { return <>{isReady?.() && <A />}{!isReady() && <B />}</>; }",
			"function Component({ isReady, left, right }) { return <>{isReady(...left) && <A />}{!isReady(...right) && <B />}</>; }",
			"function Component({ state, mode }) { return <>{state[mode] === 1 && <A />}{state.other !== 1 && <B />}</>; }",
			"function Component({ first, second }) { return <>{first.value === 1 && <A />}{second.value !== 1 && <B />}</>; }",
			'function Component({ mode }) { return <>{mode === "x" && <A />}{mode === "x" && <B />}</>; }',
		],
	});
});
