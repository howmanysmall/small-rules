import { describe } from "vitest";
import rule from "$oxc-rules/no-table-create-map";

import { ts } from "./rule-testers";

describe("no-table-create-map", () => {
	ts.run("no-table-create-map", rule, {
		invalid: [
			{
				code: "const mapped = table.create(total).map((_, index) => index);",
				documentation: { id: "fail", title: "table creation followed by map" },
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: "const mapped = table.create(total, fallback).map((value) => value);",
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: "const mapped = (table.create(total, fallback) satisfies Array<number>).map((value) => value);",
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: 'const mapped = table["create"](total, fallback).map((value) => value);',
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: "const mapped = new Array<Reward>(size).map(() => makeReward());",
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: "const mapped = new Array<Reward>(size, seed).map((value) => value);",
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
			{
				code: 'const mapped = new Array<number>(size, 0)["map"]((value) => value + 1);',
				errors: [{ messageId: "avoidConstructThenMap" }],
			},
		],
		valid: [
			`
const rewards = new Array<RewardData<RewardType.Item>>(entries);
for (const index of $range(1, entries)) {
    rewards[index - 1] = makeReward(index);
}
`,
			`
const baseRewards = table.create(entries, ItemId.PotionLuck1);
const rewards = baseRewards.map((value) => value);
`,
			"const rewards = table.create(entries, 0).filter((value) => value > 0).map((value) => value);",
			`
const table = {
    create(size: number, fill?: number) {
        return fill === undefined ? [] : [fill];
    },
};
const mapped = table.create(5, 0).map((value) => value);
`,
			`
class Array<TValue> {
    constructor(_size: number, _fill?: TValue) {}
    map(_callback: (value: TValue) => TValue) {
        return [];
    }
}
const mapped = new Array<number>(5, 0).map((value) => value);
`,
			{
				code: "table.create(entries);",
				documentation: { id: "pass", title: "table creation without mapping" },
			},
			"new Array<number>(entries);",
			"new Array<number>(a, b, c).map((value) => value);",
			"const mapped = table.create?.(entries, 0).map((value) => value);",
			"const mapped = table.make(entries, 0).map((value) => value);",
			"const mapped = services.table.create(entries, 0).map((value) => value);",
			"const mapped = new Set<number>(entries).map((value) => value);",
		],
	});
});
