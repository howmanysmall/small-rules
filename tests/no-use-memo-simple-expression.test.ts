import { describe } from "vitest";
import rule from "$oxc-rules/no-use-memo-simple-expression";

import { ts } from "./rule-testers";

describe("no-use-memo-simple-expression", () => {
	ts.run("no-use-memo-simple-expression", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1, []);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "@rbxts/react";

const count = 1;

const value = useMemo(() => {
	return count + 1;
}, [count]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const count = 5;

const value = useMemo(() => count % 2, [count]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const width = 5;
const height = 4;

const value = useMemo(() => width * height, [width, height]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const base = 2;

const value = useMemo(() => base ** 3, [base]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const theme = { colors: { primary: "blue" } };

const value = useMemo(() => theme.colors.primary, []);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => \`ready\`, []);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const count = 1;

const value = useMemo(() => (count), [count]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

const enabled = true;

const value = useMemo(() => !enabled, [enabled]);
`,
				errors: [{ messageId: "simpleMemo" }],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "react";

const value = useMemo(1, []);
`,
			},
			{
				code: `
import { useMemo } from "react";

const values = [1, 2, 3];
const index = 1;

const value = useMemo(() => values[index], [index]);
`,
			},
			{
				code: `
import { useMemo } from "react";

const status = "ready";

const value = useMemo(() => \`ready \${status}\`, [status]);
`,
			},
			{
				code: `
import { useMemo } from "react";

const count = 1;

const value = useMemo(() => count === 1, [count]);
`,
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => ({ enabled: true }), []);
`,
			},
			{
				code: `
import { useMemo } from "react";

const count = 1;

const value = useMemo(() => {
	const next = count + 1;
	return next;
}, [count]);
`,
			},
			{
				code: `
import { useMemo } from "react";

const count = 1;

const value = useMemo(() => {
	count;
}, [count]);
`,
			},
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => {
	return;
}, []);
`,
			},
			{
				code: `
import React from "react";

const value = React.useMemo(() => 1, []);
`,
			},
			{
				code: `
import { useMemo as memoize } from "react";

const value = memoize(() => 1, []);
`,
			},
		],
	});
});
