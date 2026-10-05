import { describe, expect, it } from "vitest";

import localRules from ".";
import preferNodeTypeConstant from "./prefer-node-type-constant";

describe("local-rules", () => {
	it("registers the rule in the local plugin", () => {
		expect.assertions(2);

		expect(localRules.meta?.name).toBe("local");
		expect(localRules.rules["prefer-node-type-constant"]).toBe(preferNodeTypeConstant);
	});
});
