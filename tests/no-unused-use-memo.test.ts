import { describe } from "vitest";
import rule from "$oxc-rules/no-unused-use-memo";

import { ts } from "./rule-testers";

describe("no-unused-use-memo", () => {
	// @ts-expect-error -- Shut up
	ts.run("no-unused-use-memo", rule, {
		invalid: [
			{
				code: `
import { useMemo } from "react";

useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

React.useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useMemo } from "react";

void useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

void React.useMemo(() => 1, []);
`,
				errors: [{ messageId: "unusedUseMemo" }],
				options: [{ environment: "standard" }],
			},
		],
		valid: [
			{
				code: `
import { useMemo } from "react";

const value = useMemo(() => 1, []);
`,
				options: [{ environment: "standard" }],
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
