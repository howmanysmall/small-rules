import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/anti-slop/no-reduce-accumulator-copy";

const error = { messageId: "accumulatorCopy" };

describe("no-reduce-accumulator-copy", () => {
	ts.run("no-reduce-accumulator-copy", rule, {
		invalid: [
			{
				code: "const byId = items.reduce((accumulator, item) => Object.assign({}, accumulator, { [item.id]: item }), {});",
				errors: [{ messageId: "accumulatorCopy" }],
				documentation: { id: "fail", title: "Object.assign copy of the accumulator" },
			},
			{ code: "items.reduceRight((acc, item) => Object.assign({}, acc, item), {});", errors: [error] },
			{ code: "items.reduce((acc, item, index, array) => Object.assign({}, acc, item), {});", errors: [error] },
			{ code: "items.reduce(acc => Object.assign({}, acc), {});", errors: [error] },
			{
				code: "items.reduce(function merge(acc, item) { return Object.assign({}, acc, item); }, {});",
				errors: [error],
			},
			{
				code: "items.reduce(function (acc, item) { return Object.assign({}, item, acc); }, {});",
				errors: [error],
			},
			{ code: "items['reduce'](((acc, item) => Object['assign']({}, acc, item)), {});", errors: [error] },
			{ code: "items.reduce((acc = {}, item) => Object.assign({}, acc, item), {});", errors: [error] },
			{
				code: "items.reduce((acc, item) => { const alias = acc; return Object.assign({}, alias, item); }, {});",
				errors: [error],
			},
			{ code: "items.reduce((acc, item) => Object.assign({}, acc as State, item), {});", errors: [error] },
			{
				code: "items.reduce((acc, item) => { const next = Object.assign({}, acc); next[item.id] = item; return next; }, {});",
				errors: [error],
			},
			{ code: "items.reduce((acc, item) => acc.concat([item]), []);", errors: [error] },
			{
				code: "items.reduceRight((acc, item, index) => acc['concat']([item]), [] as Item[]);",
				errors: [error],
			},
			{
				code: "items.reduce((acc, item) => { const next = acc.slice(); next.push(item); return next; }, []);",
				errors: [error],
			},
			{
				code: "items.reduce((acc, item) => { const alias = acc; return alias.concat(item); }, []);",
				errors: [error],
			},
			{ code: "const initial = []; items.reduce((acc, item) => acc.concat(item), initial);", errors: [error] },
			{
				code: "const initial: readonly Item[] = load(); items.reduce((acc, item) => acc.concat(item), initial);",
				errors: [error],
			},
			{
				code: "const initial: ReadonlyArray<Item> = load(); items.reduce((acc, item) => acc.concat(item), initial);",
				errors: [error],
			},
			{
				code: "const initial: ([Item]) = load(); items.reduce((acc, item) => acc.concat(item), initial);",
				errors: [error],
			},
			{
				code: "const source = []; items.reduce((acc, item) => acc.concat(item), source.filter(Boolean));",
				errors: [error],
			},
			{
				code: "items.reduce((acc, item) => { const next = Array.from(acc); next.push(item); return next; }, []);",
				errors: [error],
			},
			{ code: "items.reduce((acc, item) => acc.toSpliced(acc.length, 0, item), []);", errors: [error] },
			{ code: "items.reduce((acc, item) => acc.toSorted(), []);", errors: [error] },
			{ code: "items.reduce((acc, item) => acc.toReversed(), []);", errors: [error] },
			{ code: "items.reduce((acc, item) => acc.with(0, item), []);", errors: [error] },
		],
		valid: [
			{
				code: [
					"const byId = items.reduce<Record<string, Item>>((accumulator, item) => {",
					"\taccumulator[item.id] = item;",
					"\treturn accumulator;",
					"}, {});",
				].join("\n"),
				documentation: { id: "pass", title: "mutating a locally owned accumulator" },
			},
			"items.reduce((acc, item) => { acc.push(item); return acc; }, []);",
			"items.reduce((acc, item) => Object.assign(acc, item), {});",
			"items.reduce((acc, item) => Object.assign(acc, acc, item), {});",
			"items.reduce((acc, item) => Object.assign({}, ...acc), {});",
			"items.reduce((acc, item) => Object.assign(...acc), {});",
			"items.reduce((acc, item) => Array.from(), []);",
			"items.reduce((acc, item) => { acc[item.id] = { ...item }; return acc; }, {});",
			"items.reduce((acc, item) => { acc.push(Object.assign({}, item)); return acc; }, []);",
			"items.reduce((acc, item) => { acc.push(item.slice()); return acc; }, []);",
			"items.reduce((acc, item) => acc.concat(item), '');",
			"items.reduce((acc, item) => acc.concat(item), customCollection);",
			"items.reduce((acc, item) => acc.concat(item));",
			"items.reduce((acc, item) => acc.concat(item), load());",
			"items.reduce((acc, item) => acc.concat(item), source.map(format));",
			"const source = []; items.reduce((acc, item) => acc.concat(item), source[method]());",
			"const source = []; items.reduce((acc, item) => acc.concat(item), source.at(0));",
			"let initial = []; initial = load(); items.reduce((acc, item) => acc.concat(item), initial);",
			"const initial: Set<Item> = load(); items.reduce((acc, item) => acc.concat(item), initial);",
			"const initial: Item = load(); items.reduce((acc, item) => acc.concat(item), initial);",
			"const first = second; const second = first; items.reduce((acc, item) => acc.concat(item), first);",
			"function copy(acc) { return Object.assign({}, acc); }",
			"items.map((acc, item) => Object.assign({}, acc));",
			"items.reduce(reducer, {});",
			"items.reduce((acc, item) => Object.assign({}, acc), {}, extra);",
			"items.reduce(...args);",
			"items.reduce(() => Object.assign({}, acc), {});",
			"items.reduce((acc, item) => acc.concat(item), ...initial);",
			"function run(initial) { return items.reduce((acc, item) => acc.concat(item), initial); }",
			"let initial: Item[] = []; initial = load(); items.reduce((acc, item) => acc.concat(item), initial);",
			"items.reduce(([first], item) => Object.assign({}, first), {});",
			"reduce((acc, item) => Object.assign({}, acc), {});",
			"items[method]((acc, item) => Object.assign({}, acc), {});",
			"items.reduce((acc, item) => { acc[method](); return acc; }, []);",
			"items.reduce((acc, item) => { copy(acc); return acc; }, {});",
			"items.reduce((acc, item) => { function copy(acc) { return Object.assign({}, acc); } return acc; }, {});",
			"items.reduce((acc, item) => { const snapshot = () => Object.assign({}, acc); return acc; }, {});",
			"items.reduce((acc, item) => { { const acc = {}; Object.assign({}, acc); } return acc; }, {});",
			"items.reduce((acc, item) => { const [alias] = acc; return Object.assign({}, alias); }, {});",
			"items.reduce((acc, item) => { const alias = other; return Object.assign({}, alias); }, {});",
			"items.reduce((acc, item) => { const first = second; const second = first; return Object.assign({}, first); }, {});",
			"const Object = custom; items.reduce((acc, item) => Object.assign({}, acc), {});",
			"function run(Object) { return items.reduce((acc, item) => Object.assign({}, acc), {}); }",
			"const Array = custom; items.reduce((acc, item) => Array.from(acc), []);",
			"items.reduce((acc, item) => { let alias = acc; alias = item; return Object.assign({}, alias); }, {});",
			"items.reduce((acc, item) => [...acc, item], []);",
			"items.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});",
		],
	});
});
