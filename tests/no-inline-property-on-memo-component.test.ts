import { describe } from "vitest";
import rule from "$oxc-rules/no-inline-property-on-memo-component";

import { tsx } from "./rule-testers";

describe("no-inline-property-on-memo-component", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-inline-property-on-memo-component", rule, {
		invalid: [
			{
				code: `
import { memo } from "@rbxts/react";

const MemoCard = memo(() => <div />);

const view = <MemoCard options={{ enabled: true }} />;
`,
				errors: [{ data: { name: "MemoCard", type: "object" }, messageId: "inlineProperty" }],
			},
			{
				code: `
import { memo } from "@rbxts/react";

const MemoList = memo(() => <div />);

const view = <MemoList items={[1, 2, 3]} />;
`,
				errors: [{ data: { name: "MemoList", type: "array" }, messageId: "inlineProperty" }],
			},
			{
				code: `
import React from "@rbxts/react";

const MemoPanel = React.memo(() => <div />);

const view = <MemoPanel onSelect={() => true} />;
`,
				errors: [{ data: { name: "MemoPanel", type: "function" }, messageId: "inlineProperty" }],
			},
			{
				code: `
import React from "@rbxts/react";

const MemoPanel = React.memo(() => <div />);

const view = <MemoPanel fallback={<></>} />;
`,
				errors: [{ data: { name: "MemoPanel", type: "JSX" }, messageId: "inlineProperty" }],
			},
		],
		valid: [
			{
				code: `
import { memo } from "@rbxts/react";

function Card() {
	return <div />;
}

const view = <Card options={{ enabled: true }} />;
`,
			},
			{
				code: `
import { memo } from "@rbxts/react";

const options = { enabled: true };
const MemoCard = memo(() => <div />);

const view = <MemoCard options={options} />;
`,
			},
			{
				code: `
import { memo } from "@rbxts/react";

const onSelect = () => true;
const MemoList = memo(() => <div />);

const view = <MemoList onSelect={onSelect} />;
`,
			},
			{
				code: `
import { memo as memoize } from "@rbxts/react";

const MemoCard = memoize(() => <div />);

const view = <MemoCard options={{ enabled: true }} />;
`,
			},
			{
				code: `
import React from "@rbxts/react";

const MemoPanel = React.memo(() => <div />);
const fallback = <></>;

const view = <MemoPanel fallback={fallback} />;
`,
			},
		],
	});
});
