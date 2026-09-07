#!/usr/bin/env bun

import { faker } from "@faker-js/faker";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";

import { toPascalCase as toPascalCaseOxc } from "$oxc-utilities/casing-utilities";
import { toPascalCase as toPascalCaseScript } from "$script-utilities/casing-utilities";

faker.seed(42);

function nextInteger(minimum: number, maximum: number): number {
	return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

const length = 10_000;
const strings = Array.from<string>({ length });

for (let index = 0; index < length; index += 1) {
	const sentence = faker.word.words(nextInteger(1, 20));
	strings[index] = sentence;
}

summary(() => {
	barplot(() => {
		bench("[scripts] casing-utilities", () => {
			for (const value of strings) do_not_optimize(toPascalCaseScript(value));
		});
		bench("[src] casing-utilities", () => {
			for (const value of strings) do_not_optimize(toPascalCaseOxc(value));
		});
	});
});

await run({});
