import { describe, expect, it } from "vitest";

import localRules from ".";
import preferExistingGuard from "./prefer-existing-guard";
import preferNodeTypeConstant from "./prefer-node-type-constant";
import preferSharedStringConstant from "./prefer-shared-string-constant";

describe("local-rules", () => {
	it("registers every rule in the local plugin", () => {
		expect.assertions(2);

		expect(localRules.meta?.name).toBe("local");
		expect(localRules.rules).toStrictEqual({
			"prefer-existing-guard": preferExistingGuard,
			"prefer-node-type-constant": preferNodeTypeConstant,
			"prefer-shared-string-constant": preferSharedStringConstant,
		});
	});
});
