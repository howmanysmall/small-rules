import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
	renderBundleBanner,
	renderLicenseText,
	renderNoticesMarkdown,
	VENDORED_COMPONENTS,
} from "../scripts/utilities/vendored-notices";

const BANNER = renderBundleBanner();

const COMMENT_PREFIX = /^ \* ?/u;
const BANNER_TEXT = BANNER.split("\n")
	.map((line) => line.replace(COMMENT_PREFIX, ""))
	.join("\n");

const componentsMissingAttribution = VENDORED_COMPONENTS.filter(
	({ copyright, source }) => !BANNER.includes(copyright) || !BANNER.includes(source),
);

const componentsMissingPermission = VENDORED_COMPONENTS.filter(
	(component) => !BANNER_TEXT.includes(renderLicenseText(component)),
);

const componentsMissingCopyright = VENDORED_COMPONENTS.filter((component) => {
	const text = renderLicenseText(component);
	return text.includes("{{copyright}}") || !text.includes(component.copyright);
});

const vendoredPaths = VENDORED_COMPONENTS.flatMap(({ directory, files }) =>
	files.map((file) => `${directory}${file.local}`),
);
const expectedReadStatuses = vendoredPaths.map(() => "fulfilled");

describe("third-party notices", () => {
	it("keeps the notices file in sync with the catalog", async () => {
		expect.assertions(1);

		const onDisk = await readFile("THIRD-PARTY-NOTICES.md", "utf8");

		// Run `node --run generate:third-party-notices` when this fails.
		expect(onDisk).toBe(renderNoticesMarkdown());
	});

	it("reproduces every copyright line and source in the bundle banner", () => {
		expect.assertions(1);
		expect(componentsMissingAttribution).toStrictEqual([]);
	});

	it("reproduces every permission notice in the bundle banner", () => {
		expect.assertions(1);
		expect(componentsMissingPermission).toStrictEqual([]);
	});

	it("emits the banner as a legal comment so minification cannot drop it", () => {
		expect.assertions(2);
		expect(BANNER.startsWith("/*!")).toBe(true);
		expect(BANNER.endsWith("*/")).toBe(true);
	});

	it("substitutes the copyright line into every license template", () => {
		expect.assertions(1);
		expect(componentsMissingCopyright).toStrictEqual([]);
	});

	it("lists only files that exist on disk", async () => {
		expect.assertions(1);

		const reads = await Promise.allSettled(vendoredPaths.map(async (path) => readFile(path, "utf8")));

		expect(reads.map((result) => result.status)).toStrictEqual(expectedReadStatuses);
	});

	it("describes at least one vendored component", () => {
		expect.assertions(1);
		expect(VENDORED_COMPONENTS.length).toBeGreaterThan(0);
	});
});
