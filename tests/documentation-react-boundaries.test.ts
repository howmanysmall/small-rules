import { readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const frameworkBoundaryComponents = [
	"package-manager-tabs",
	"release-history",
	"rule-diagnostics",
	"rule-examples",
	"rule-options",
	"rule-page",
];

describe("documentation React boundaries", () => {
	it("keeps Astro only where Astro or Starlight owns the rendering boundary", () => {
		expect.assertions(1);

		const componentsDirectory = resolve(import.meta.dirname, "../documentation/src/components");
		const astroComponents = readdirSync(componentsDirectory)
			.filter((fileName) => extname(fileName) === ".astro")
			.map((fileName) => basename(fileName, ".astro"))
			.toSorted();

		expect(astroComponents).toStrictEqual(frameworkBoundaryComponents);
	});
});
