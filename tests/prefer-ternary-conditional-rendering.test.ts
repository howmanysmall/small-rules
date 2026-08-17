import { describe } from "vitest";
import rule from "$oxc-rules/react/prefer-ternary-conditional-rendering";

import { jsx } from "./rule-testers";

describe("prefer-ternary-conditional-rendering", () => {
	jsx.run("prefer-ternary-conditional-rendering", rule, {
		invalid: [
			{
				code: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined && <uigradient key="ui-gradient" Color={gradient} />}{gradient === undefined && <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
				output: `
function Component({ gradient, gradientToUse, rarityStyle }) {
    return <>{gradient !== undefined ? <uigradient key="ui-gradient" Color={gradient} /> : <AnimatedGradient key="animated-gradient" colorValue={gradientToUse} rotation={45} sweepingSpeed={rarityStyle?.sweepingSpeed ?? 0} />}</>;
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
				documentation: { id: "fail", title: "Paired conditional JSX branches" },
			},
			{
				code: "function Component({ flag }) { return <>{flag && <A />}{!flag && <B />}</>; }",
				output: "function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{mode !== "x" && <B />}</>; }',
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: 'function Component({ mode }) { return <>{mode === "x" && <A />}{"x" !== mode && <B />}</>; }',
				output: 'function Component({ mode }) { return <>{mode === "x" ? <A /> : <B />}</>; }',
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component() { return <>{isReady() && <A />}{!isReady() && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ mode }) { return <>{mode === getMode() && <A />}{mode !== getMode() && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ state }) { return <>{state.value === 1 && <A />}{state.value !== 1 && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ state }) { return <>{state[mode] === 1 && <A />}{state[mode] !== 1 && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ value, items }) { return <>{isReady(value, ...items) && <A />}{!isReady(value, ...items) && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ flag, active }) { return <>{flag && active && <A />}{!(flag && active) && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ value, offset }) { return <>{!(value + offset) && <A />}{value + offset && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component() { return <>{this === target && <A />}{this !== target && <B />}</>; }",
				output: "function Component() { return <>{this === target ? <A /> : <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ flag }) { return <>{!flag && <A />}{flag && <B />}</>; }",
				output: "function Component({ flag }) { return <>{!flag ? <A /> : <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ flag }) { return <>{1 === flag && <A />}{flag !== 1 && <B />}</>; }",
				output: "function Component({ flag }) { return <>{1 === flag ? <A /> : <B />}</>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
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
				output: `
function Component({ flag }) {
    return (
        <>
            {flag ? <><A /></> : <><B /></>}
        </>
    );
}
`,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ flag }) { return <frame>{flag && <A />}{!flag && <B />}</frame>; }",
				output: "function Component({ flag }) { return <frame>{flag ? <A /> : <B />}</frame>; }",
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ isReady, value }) { return <>{isReady?.(value) && <A />}{!isReady?.(value) && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ service }) { return <>{service?.state === this && <A />}{this !== service?.state && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: 'function Component({ getMode, mode, items }) { return <>{getMode(mode, ...items) === "x" && <A />}{"x" !== getMode(mode, ...items) && <B />}</>; }',
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component({ flag }) { return <>{!!flag && <A />}{!flag && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "function Component() { return <>{new.target && <A />}{!new.target && <B />}</>; }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "class Component { #state; render() { return <>{this.#state === 1 && <A />}{this.#state !== 1 && <B />}</>; } }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "class Component { #state; render(value) { return <>{(#state in value) === true && <A />}{(#state in value) !== true && <B />}</>; } }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
			{
				code: "class Base { value; } class Component extends Base { render() { return <>{super.value === target && <A />}{super.value !== target && <B />}</>; } }",
				output: null,
				errors: [{ messageId: "preferTernaryConditionalRendering" }],
			},
		],
		valid: [
			{
				code: "function Component({ flag }) { return <>{flag ? <A /> : <B />}</>; }",
				documentation: { id: "pass", title: "Explicit JSX ternary" },
			},
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
			"function Component({ isReady }) { return <>{isReady?.() === true && <A />}{isReady() !== true && <B />}</>; }",
			"function Component({ isReady, isDone }) { return <>{isReady() === true && <A />}{isDone() !== true && <B />}</>; }",
			"function Component({ isReady, left, right }) { return <>{isReady(...left) && <A />}{!isReady(...right) && <B />}</>; }",
			"function Component({ isReady, items }) { return <>{isReady(...items) && <A />}{!isReady(items) && <B />}</>; }",
			"function Component({ state, mode }) { return <>{state[mode] === 1 && <A />}{state.other !== 1 && <B />}</>; }",
			"function Component({ first, second }) { return <>{first.value === 1 && <A />}{second.value !== 1 && <B />}</>; }",
			"function Component({ service, target }) { return <>{service?.state === target && <A />}{service.state !== target && <B />}</>; }",
			'function Component({ state }) { return <>{state.value === 1 && <A />}{state["value"] !== 1 && <B />}</>; }',
			'function Component({ mode }) { return <>{mode === "x" && <A />}{mode === "x" && <B />}</>; }',
		],
	});
});
