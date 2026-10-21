import { fc } from "@fast-check/vitest";

import { defineFixableCase } from "./fixable-case";
import { expressionArbitrary, identifierArbitrary, wordArbitrary } from "./syntax";

import type { FixableCase } from "./fixable-case";

// A binding, the control flow that reads it, and a statement after the block,
// with no blank lines between them.
const requireReadableSpacing = defineFixableCase({
	language: "ts",
	render: ([module, name, value], id) => ({
		module: [`import "./${module}";`],
		statements: [`const ${name}${id} = ${value};`, `if (${name}${id}) {`, `${name}${id};`, "}", `${name}${id};`],
	}),
	rule: "require-readable-spacing",
	trigger: fc.tuple(wordArbitrary, identifierArbitrary, expressionArbitrary),
});

export const ANTI_SLOP_FIXABLE_CASES: ReadonlyArray<FixableCase> = [requireReadableSpacing];
