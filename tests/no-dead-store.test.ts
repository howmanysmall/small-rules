import { describe } from "vitest";
import rule from "$oxc-rules/no-dead-store";

import { ts } from "./rule-testers";

describe("no-dead-store", () => {
	ts.run("no-dead-store", rule, {
		invalid: [
			{
				code: `function refresh() {
  let snapshot = readDisk();
  snapshot = readNetwork();
  return snapshot;
}`,
				documentation: { id: "fail", title: "Value replaced before use" },
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function reserveSlot() { const reservation = allocate(); notifyReady(); }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function finish() { let phase; phase = begin(); publish(phase); phase = complete(); }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function choose(enabled: boolean) { let handler = fallback(); if (enabled) handler = primary(); else handler = secondary(); return handler; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function decode() { const { header, payload } = readPacket(); return payload; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function choose(enabled: boolean) { let value = initial(); value = enabled ? primary() : secondary(); return value; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function nested(first: boolean, second: boolean) { let value = initial(); if (first) { if (second) value = one(); else value = two(); } else value = three(); return value; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function ternary(flag: boolean) { let value = initial(); flag ? (value = one()) : (value = two()); return value; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function isolated() { let value = initial(); function replace() { value = next(); } replace(); }",
				errors: [{ messageId: "deadStore" }, { messageId: "deadStore" }],
			},
			{
				code: "function chained(first: boolean, second: boolean) { let value = initial(); if (first) value = one(); else if (second) value = two(); else value = three(); return value; }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function destructure() { let value = initial(); ({ value } = next()); }",
				errors: [{ messageId: "deadStore" }, { messageId: "deadStore" }],
			},
			{
				code: "function repeated(flag: boolean) { let value = load(); if (flag) { value = one(); value = two(); } consume(value); }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function repeatedTernary(flag: boolean) { let value = load(); flag ? ((value = one()), (value = two())) : noop(); consume(value); }",
				errors: [{ messageId: "deadStore" }],
			},
			{
				code: "function guard(flag: boolean) { let value = load(); if (flag) { value = replace(); return; } value = fallback(); }",
				errors: [{ messageId: "deadStore" }, { messageId: "deadStore" }, { messageId: "deadStore" }],
			},
		],
		valid: [
			{
				code: `function render(verbose: boolean) {
  const label = makeLabel();
  if (verbose) printLabel(label);
}`,
				documentation: { id: "pass", title: "Value used conditionally" },
			},
			"let processState = createState();",
			"function createReader() { const document = openDocument(); return () => document; }",
			"function migrate() { let version = currentVersion(); version = upgrade(version); return version; }",
			"function recover() { let checkpoint; try { checkpoint = saveCheckpoint(); execute(); } catch { restore(checkpoint); } }",
			"function register() { const _registration = subscribe(); }",
			"function defaults(value = initialize()) { value++; return value; }",
			"function sentinels() { let a = null; let b = false; let c = true; let d = ''; let e = -1; let f = 0; let g = 1; let h = undefined; let i = []; let j = {}; let k = void 0; consume(a, b, c, d, e, f, g, h, i, j, k); }",
			"function clear() { let value = load(); consume(value); value = null; }",
			"function unpack() { const { kept, ...remaining } = packet(); consume(remaining); }",
			"function branch(flag: boolean) { let value = load(); flag && (value = replace()); consume(value); }",
			"function repeat(items: Array<number>) { let value = load(); for (const item of items) value = item; consume(value); }",
			"function select(kind: number) { let value = load(); switch (kind) { case 1: value = one(); break; default: value = other(); } consume(value); }",
			"function guarded() { let value = load(); try { value = replace(); } finally { consume(value); } }",
			"function caught() { let value = load(); try { run(); } catch { value = recover(); } consume(value); }",
			"function ignoredCatch() { let value = load(); try { value = replace(); } catch { recover(); } consume(value); }",
			"function optional(flag: boolean) { let value = load(); if (flag) value = replace(); consume(value); }",
			"function tested() { let value = load(); if (value) consume(value); }",
			"function ternaryTest() { let value = load(); consume(value ? one() : two()); }",
			"function separate() { let value = load(); function inner() { value = replace(); } consume(value); inner(); }",
			"function declared() { let value: number; value = 1; return value; }",
			"function enumValue() { enum State { Ready = compute() } return State.Ready; }",
			"function separatePaths(first: boolean, second: boolean) { let value = load(); if (first) { if (second) value = one(); } if (!first) { if (!second) value = two(); } consume(value); }",
			`function countInLoop(items: Array<unknown>) {
  let count = 0;
  for (const item of items) {
    if (item) count += 1;
    count += compute(item);
  }
  return count;
}`,
			[
				"function findBest(items: Array<string>) {",
				"  let best: string | undefined;",
				"  let bestRank = -1;",
				"  for (const item of items) {",
				"    const rank = getRank(item);",
				"    if (rank > bestRank) {",
				"      bestRank = rank;",
				"      best = item;",
				"    }",
				"  }",
				"  return best;",
				"}",
			].join("\n"),
			"function separateConditions(first: boolean, second: boolean) { let value = load(); first ? (value = one()) : noop(); second ? (value = two()) : noop(); consume(value); }",
			"function generateTuple() { for (let index = 0; index < 10; index += 1) run(); }",
			`function process(items: Array<number>) {
  let x = 0;
  for (const item of items) {
    if (item > 0) {
      x = item;
    } else {
      consume(x);
    }
  }
}`,
			"function unrelatedTernaries(a: boolean, b: boolean, c: boolean, d: boolean) { let value = load(); a ? (b ? (value = one()) : noop()) : noop(); c ? (d ? (value = two()) : noop()) : noop(); consume(value); }",
			{
				code: `function f(x: any) { let score = 0; switch (x.type) { case "arr": score = 1; break; default: score = 2; } return score; }`,
			},
			[
				"function scoreByKind(kind: string) {",
				"  let score = 0;",
				"  switch (kind) {",
				'    case "array": {',
				"      if (kind.length > 0) {",
				"        score = computeScore(kind);",
				"        break;",
				"      }",
				"      score = 1;",
				"      break;",
				"    }",
				"    default:",
				"      score = 2;",
				"  }",
				"  return score;",
				"}",
			].join("\n"),
			[
				"function scan(items: Array<number>) {",
				"  let best = -1;",
				"  for (const item of items) {",
				"    if (item > 0) {",
				"      best = item;",
				"      break;",
				"    }",
				"    best = 0;",
				"  }",
				"  return best;",
				"}",
			].join("\n"),
			"function earlyExit(flag: boolean) { let value = load(); if (flag) { value = replace(); consume(value); return; } consume(value); }",
		],
	});
});
