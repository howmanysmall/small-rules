import { describe, expect, it } from "vitest";
import { resolveRelativeImport } from "$oxc-utilities/resolve-import";

describe("resolveRelativeImport", () => {
	it("should not resolve package import specifiers", () => {
		expect.assertions(1);

		// Arrange
		const importSource = "react";
		const sourceFile = "/project/src/component.tsx";

		// Act
		const result = resolveRelativeImport(importSource, sourceFile);

		// Assert
		expect(result).toStrictEqual({ found: false });
	});
});
