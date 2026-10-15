#!/usr/bin/env bun

import { faker } from "@faker-js/faker";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";

faker.seed(42);

function nextInteger(minimum: number, maximum: number): number {
	return faker.number.int({ max: maximum, min: minimum });
}

const length = 10_000;
const strings = Array.from<string>({ length });

for (let index = 0; index < length; index += 1) {
	if (nextInteger(0, 1) === 1) {
		strings[index] = "";
		continue;
	}
	const sentence = faker.word.words(nextInteger(1, 20));
	strings[index] = sentence;
}

summary(() => {
	barplot(() => {
		bench('.trim() === ""', () => {
			for (const value of strings) do_not_optimize(value.trim() === "");
		});
		bench(".trim().length === 0", () => {
			for (const value of strings) do_not_optimize(value.trim().length === 0);
		});
	});
});

await run({});
