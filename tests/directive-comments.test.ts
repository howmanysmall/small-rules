import { describe, expect, it } from "vitest";
import { toForceLocation } from "$oxc-utilities/directive-comments";

describe("directive comment locations", () => {
	it("clamps forced start column to valid range", () => {
		expect.assertions(1);

		const location = toForceLocation({
			end: { column: 58, line: 1 },
			start: { column: 0, line: 1 },
		});

		expect(location).toStrictEqual({
			end: { column: 58, line: 1 },
			start: { column: 0, line: 1 },
		});
	});
});
