import { describe, it } from "vitest";

import { mergeIntoStackTop } from "$oxc-utilities/stack-utilities";

describe("mergeIntoStackTop", () => {
	it("should merge updates into the top entry only", ({ expect }) => {
		expect.assertions(1);

		const stack = [
			{ inLoop: false, inTry: false },
			{ inLoop: false, inTry: false },
		];

		mergeIntoStackTop(stack, { inLoop: true });

		expect(stack).toStrictEqual([
			{ inLoop: false, inTry: false },
			{ inLoop: true, inTry: false },
		]);
	});

	it("should leave an empty stack empty", ({ expect }) => {
		expect.assertions(1);

		const stack = new Array<{ inLoop: boolean }>();
		mergeIntoStackTop(stack, { inLoop: true });

		expect(stack).toStrictEqual([]);
	});
});
