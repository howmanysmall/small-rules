import { readdirSync } from "node:fs";
import nodePath from "node:path";
import { describe, expect, it } from "vitest";

const frameworkBoundaryComponents = [
	"inline-markdown-text",
	"package-manager-tabs",
	"rule-diagnostics",
	"rule-examples",
	"rule-options",
	"rule-page",
];

describe("documentation React boundaries", () => {
	it("keeps Astro only where Astro or Starlight owns the rendering boundary", () => {
		expect.assertions(1);

		const componentsDirectory = nodePath.resolve(import.meta.dirname, "../documentation/src/components");
		const astroComponents = readdirSync(componentsDirectory)
			.filter((fileName) => nodePath.extname(fileName) === ".astro")
			.map((fileName) => nodePath.basename(fileName, ".astro"))
			.toSorted();

		expect(astroComponents).toStrictEqual(frameworkBoundaryComponents);
	});
});
