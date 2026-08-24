import nodePath from "node:path";
import { expect } from "vitest";
import { fuzz } from "@vitiate/core";
import { FuzzedDataProvider } from "@vitiate/fuzzed-data-provider";

import rule from "$oxc-rules/react/prefer-padding-components";

import { createRuleExecutor } from "./rule-harness/execute";

import type { NormalizedValidCase } from "./rule-harness/types";

const PADDING_MODES: ReadonlyArray<"directional" | "equal" | "unequal"> = ["directional", "equal", "unequal"];
const EXPRESSION_WRAPPERS: ReadonlyArray<"array" | "object" | "parentheses" | "property"> = [
	"array",
	"object",
	"parentheses",
	"property",
];
const FILENAME = nodePath.join(
	import.meta.dirname,
	"fixtures",
	"prefer-padding-components",
	"with-components",
	"src",
	"screens",
	"fuzz.tsx",
);
const execute = createRuleExecutor("prefer-padding-components", rule);

function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}

function createExpression(provider: FuzzedDataProvider, prefix: string): string {
	let expression = `${prefix}${bytesToHex(provider.consumeBytes(12))}`;
	const depth = provider.consumeIntegralInRange(0, 6);

	for (let index = 0; index < depth; index += 1) {
		switch (provider.pickValue(EXPRESSION_WRAPPERS)) {
			case "array": {
				expression = `[${expression}]`;
				break;
			}
			case "object": {
				expression = `({ value: ${expression} })`;
				break;
			}
			case "parentheses": {
				expression = `(${expression})`;
				break;
			}
			case "property": {
				expression = `({ nested: [${expression}] }).nested`;
				break;
			}
		}
	}

	return expression;
}

function createCase(code: string): NormalizedValidCase {
	return {
		code,
		filename: FILENAME,
		kind: "valid",
		language: "tsx",
		options: [],
		settings: {},
		sourceType: "module",
	};
}

function expectedMessageId(mode: "directional" | "equal" | "unequal"): string | undefined {
	if (mode === "equal") return "preferEqualPadding";
	if (mode === "directional") return "preferDirectionalPadding";
	return undefined;
}

fuzz(
	"classifies structurally nested padding values without recursion failures",
	(data): void => {
		const provider = new FuzzedDataProvider(data);
		const mode = provider.pickValue(PADDING_MODES);
		const first = createExpression(provider, "first");
		const second = createExpression(provider, "second");
		const third = createExpression(provider, "third");
		let paddingLeft = second;
		let paddingRight = third;
		if (mode === "equal") {
			paddingLeft = first;
			paddingRight = first;
		} else if (mode === "directional") {
			paddingRight = second;
		}
		const code = `import { DirectionalPadding } from "../ui/directional-padding";
import EqualPadding from "../ui/equal-padding";

export function Example() {
	return <uipadding PaddingBottom={${first}} PaddingLeft={${paddingLeft}} PaddingRight={${paddingRight}} PaddingTop={${first}} />;
}`;
		const result = execute(createCase(code));
		const messageId = expectedMessageId(mode);

		expect(result.diagnostics.map((diagnostic) => diagnostic.messageId)).toStrictEqual(
			messageId === undefined ? [] : [messageId],
		);
	},
	{ maxLen: 512 },
);
