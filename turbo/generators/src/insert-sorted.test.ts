import { describe, it } from "vitest";

import { insertSorted } from "./insert-sorted";

const ENTRY_REGEXP = /^\t"(?<key>[^"]+)",$/u;

describe("insertSorted", () => {
	it("inserts before the first entry that sorts after it", ({ expect }) => {
		expect.assertions(1);

		const lines = ["[", '\t"alpha",', '\t"gamma",', "]"];
		insertSorted(lines, [0, 3], ENTRY_REGEXP, '\t"beta",');

		expect(lines).toStrictEqual(["[", '\t"alpha",', '\t"beta",', '\t"gamma",', "]"]);
	});

	it("appends after the last entry when nothing sorts after it", ({ expect }) => {
		expect.assertions(1);

		const lines = ["[", '\t"alpha",', '\t"beta",', "]"];
		insertSorted(lines, [0, 3], ENTRY_REGEXP, '\t"omega",');

		expect(lines).toStrictEqual(["[", '\t"alpha",', '\t"beta",', '\t"omega",', "]"]);
	});

	it("ignores matching lines outside the range", ({ expect }) => {
		expect.assertions(1);

		const lines = ['\t"zeta",', "[", '\t"alpha",', "]"];
		insertSorted(lines, [1, 3], ENTRY_REGEXP, '\t"beta",');

		expect(lines).toStrictEqual(['\t"zeta",', "[", '\t"alpha",', '\t"beta",', "]"]);
	});

	it("throws when the range holds no matching line", ({ expect }) => {
		expect.assertions(1);

		expect(() => {
			insertSorted(["[", "]"], [0, 1], ENTRY_REGEXP, '\t"alpha",');
		}).toThrow(`Found no line matching ${ENTRY_REGEXP.source}.`);
	});
});
