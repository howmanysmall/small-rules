import { describe } from "vitest";

import rule from "$oxc-rules/react/no-unused-use-memo";

import { ts } from "./rule-testers";

describe("no-unused-use-memo", () => {
	ts.run("no-unused-use-memo", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "@rbxts/react";

useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				documentation: { id: "fail", title: "Unused memoized value" },
			},
			{
				code: `
import * as React from "react";

React.useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
				errors: [{ messageId: "unusedUseMemo" }],
			},
			{
				code: `
import { useMemo } from "react";

void useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
				errors: [{ messageId: "unusedUseMemo" }],
			},
			{
				code: `
import * as React from "react";

void React.useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
				errors: [{ messageId: "unusedUseMemo" }],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "@rbxts/react";

const value = useMemo(() => 1, []);
`,
				documentation: { id: "pass", title: "Consumed memoized value" },
			},
			{
				code: `
import { useMemo } from "react";

function Component() {
    return useMemo(() => 1, []);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

function use(value) {
    return value;
}

const value = useMemo(() => 1, []);
use(value);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
function useMemo(factory) {
    return factory();
}

useMemo(() => 1);
`,
			},
		],
	});
});
