import { describe } from "vitest";
import rule from "$oxc-rules/no-useless-use-memo";

import { ts } from "./rule-testers";

describe("no-useless-use-memo", () => {
	// @ts-expect-error -- This is a dumb problem.
	ts.run("no-useless-use-memo", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const rotationConfiguration = useMemo(
	() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring),
	[],
);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";
import { AnimationLibrary } from "./animation-config";

const glowConfiguration = React.useMemo(() => AnimationLibrary.ReactSpring, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const COLOR = Color3.fromRGB(255, 255, 255);

const accent = useMemo(() => COLOR, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => ({ enabled: true, label: "Ready" }), ["Ready"]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => [1, 2, 3], []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ dependencyMode: "empty-or-omitted", environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => makeStatic(1), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard", staticGlobalFactories: ["makeStatic"] }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => {
	return 1;
}, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => \`ready\`, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1 + 2, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => true ? "a" : "b", []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => (1, 2), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary } from "./animation-config";

const value = useMemo(() => AnimationLibrary?.ReactSpring, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => -1, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => new Vector3(1, 2, 3), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring) as const)!, []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring) satisfies unknown), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => (<unknown>getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring)), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration<string>(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), []);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				errors: [{ messageId: "uselessUseMemo" }],
				options: [{ dependencyMode: "aggressive", environment: "standard" }],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

function Component({ theme }) {
	const value = useMemo(() => getAnimationConfiguration(theme, AnimationLibrary.ReactSpring), [theme]);
	return value;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

function Component({ theme }) {
	const value = useMemo(() => {
		const localValue = getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring);
		return localValue;
	}, []);
	return value;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				options: [{ dependencyMode: "empty-or-omitted", environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";
import { AnimationLibrary, SpringConfiguration, getAnimationConfiguration } from "./animation-config";

const value = useMemo(() => getAnimationConfiguration(SpringConfiguration.Sharp, AnimationLibrary.ReactSpring), [theme]);
`,
				options: [{ dependencyMode: "non-updating", environment: "standard" }],
			},
			{
				code: `
import { useMemo as useMemoHook } from "react";

useMemoHook(() => 1, []);
`,
			},
			{
				code: `
import { useMemo } from "react";

useMemo(() => (() => 1), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({
	...base,
}), []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function Component() {
	const value = useMemo(() => {
		doSomething();
		return 1;
	}, []);
	return value;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => [1, ...items], []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => [1, , 2], []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

useMemo();
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

useMemo("not a callback", []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => {
	1;
}, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => {
	return;
}, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

void useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
