import { faker } from "@faker-js/faker";
import { type } from "arktype";
import { Predicate } from "effect";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";

faker.seed(42);

function nextInteger(minimum: number, maximum: number): number {
	return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

const length = 10_000;
const anyData = Array.from<unknown>({ length });

for (let index = 0; index < length; index += 1) {
	switch (nextInteger(0, 11)) {
		case 0: {
			anyData[index] = faker.string.sample();
			break;
		}

		case 1: {
			anyData[index] = faker.number.int();
			break;
		}

		case 2: {
			anyData[index] = faker.datatype.boolean();
			break;
		}

		case 3: {
			// oxlint-disable-next-line unicorn/no-null -- shut up
			anyData[index] = null;
			break;
		}

		case 4: {
			anyData[index] = undefined;
			break;
		}

		case 5: {
			anyData[index] = {};
			break;
		}

		case 6: {
			anyData[index] = {
				[faker.string.alphanumeric(5)]: faker.string.sample(),
				[faker.string.alphanumeric(5)]: faker.number.int(),
			};
			break;
		}

		case 7: {
			anyData[index] = [faker.string.sample(), faker.number.int()];
			break;
		}

		case 8: {
			anyData[index] = faker.date.recent();
			break;
		}

		case 9: {
			anyData[index] = Symbol(faker.string.sample());
			break;
		}

		case 10: {
			anyData[index] = BigInt(faker.number.int({ max: 1000, min: 0 }));
			break;
		}

		default: {
			anyData[index] = (): void => {
				// do nothing
			};
			break;
		}
	}
}

const isRecord = type("Record<string, unknown>");

for (const data of anyData) {
	const arktype = isRecord.allows(data);
	const effect = Predicate.isObject(data);
	if (arktype !== effect) {
		throw new TypeError(`ArkType and Effect disagree on ${JSON.stringify(data)} (${arktype} vs ${effect})`);
	}
}

summary(() => {
	barplot(() => {
		bench("ArkType .allows", () => {
			for (const data of anyData) do_not_optimize(isRecord.allows(data));
		});
		bench("Effect", () => {
			for (const data of anyData) do_not_optimize(Predicate.isObject(data));
		});
	});
});

await run({});
