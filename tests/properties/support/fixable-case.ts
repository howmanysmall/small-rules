import { fc } from "@fast-check/vitest";

import { fillerArbitrary, frameArbitrary, wrapInFrames } from "./syntax";

import type { Arbitrary } from "fast-check";

import type smallRules from "$small-rules";
import type { NormalizedValidCase, TestLanguage } from "@small-rules/rule-harness/types";

import type { Frame } from "./syntax";

type RuleName = keyof (typeof smallRules)["rules"];

/** Code a rule-specific generator contributes to a program. */
export interface TriggerParts {
	/** Module-level lines such as imports, hoisted and deduplicated. */
	readonly module?: ReadonlyArray<string>;
	/** Statements placed inside random enclosing frames among filler code. */
	readonly statements?: ReadonlyArray<string>;
}

interface FixableCaseSpecification<Value> {
	readonly filename?: string;
	/** Where `statements` may be nested. Defaults to any mix of frames. */
	readonly frames?: Arbitrary<ReadonlyArray<Frame>>;
	readonly language?: TestLanguage;
	readonly options?: ReadonlyArray<unknown>;
	/**
	 * Renders one trigger. `id` is unique per trigger within a program, so
	 * names suffixed with it never clash with another trigger.
	 */
	readonly render: (value: Value, id: number) => TriggerParts;
	readonly rule: RuleName;
	readonly trigger: Arbitrary<Value>;
}

export interface FixableCase {
	readonly createCase: (code: string) => NormalizedValidCase;
	readonly program: Arbitrary<string>;
	readonly rule: RuleName;
}

const DEFAULT_FILENAME_BY_LANGUAGE = {
	dts: "case.d.ts",
	js: "case.js",
	jsx: "case.jsx",
	ts: "case.ts",
	tsx: "case.tsx",
} satisfies Record<TestLanguage, string>;

interface Placement<Value> {
	readonly after: ReadonlyArray<string>;
	readonly before: ReadonlyArray<string>;
	readonly frames: ReadonlyArray<Frame>;
	readonly value: Value;
}

/**
 * Builds a program generator for one fixable rule: several triggers, each
 * nested in its own frames and surrounded by unrelated filler statements.
 *
 * @template Value - The data one trigger is rendered from.
 * @param specification - The rule, its trigger, and how to render it.
 * @returns The rule name, the program generator, and a test case factory.
 */
export function defineFixableCase<Value>(specification: FixableCaseSpecification<Value>): FixableCase {
	const language = specification.language ?? "tsx";
	const filename = specification.filename ?? DEFAULT_FILENAME_BY_LANGUAGE[language];
	const options = specification.options ?? [];
	const placement: Arbitrary<Placement<Value>> = fc.record({
		after: fillerArbitrary,
		before: fillerArbitrary,
		frames: specification.frames ?? fc.array(frameArbitrary, { size: "-1" }),
		value: specification.trigger,
	});

	return {
		createCase: (code) => ({
			code,
			filename,
			kind: "valid",
			language,
			options,
			settings: {},
			sourceType: "module",
		}),
		program: fc
			.array(placement, { minLength: 1, size: "-1" })
			.map((placements) => renderProgram(placements, specification.render)),
		rule: specification.rule,
	};
}

function renderProgram<Value>(
	placements: ReadonlyArray<Placement<Value>>,
	render: (value: Value, id: number) => TriggerParts,
): string {
	const moduleLines = new Set<string>();
	const bodies = new Array<string>();

	for (const [id, { after, before, frames, value }] of placements.entries()) {
		const { module = [], statements = [] } = render(value, id);
		for (const line of module) moduleLines.add(line);
		if (statements.length === 0) continue;
		bodies.push(wrapInFrames(frames, [...before, ...statements, ...after].join("\n")));
	}

	return [...moduleLines, ...bodies].join("\n");
}
