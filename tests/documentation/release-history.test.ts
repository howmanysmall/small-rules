import { describe, expect, it } from "vitest";

import { createReleaseHistory, getReleaseContentEntry } from "$data/release-history";

describe("documentation release history", () => {
	// Catches an empty release list rendering a blank page instead of an
	// explanation that points at the GitHub releases page.
	it("renders an explanatory empty state pointing at GitHub releases when no releases exist", () => {
		expect.assertions(1);

		expect(createReleaseHistory([])).toStrictEqual({
			emptyState: {
				githubReleasesUrl: "https://github.com/howmanysmall/small-rules/releases",
				message: "No release notes have been published yet.",
			},
			entries: [],
			kind: "empty",
		});
	});

	it("sorts populated release entries by semantic version", () => {
		expect.assertions(1);
		const history = createReleaseHistory([
			{ id: "v2.7.1", body: "Patch notes" },
			{ id: "v3.0.0", body: "Major notes" },
			{ id: "v2.7.0", body: "Release notes" },
		]);

		expect(history).toMatchObject({
			entries: [
				{ body: "Major notes", version: { tag: "v3.0.0" } },
				{ body: "Patch notes", version: { tag: "v2.7.1" } },
				{ body: "Release notes", version: { tag: "v2.7.0" } },
			],
			kind: "populated",
		});
	});

	it("uses the release filename when Astro normalizes the collection id", () => {
		expect.assertions(1);

		expect(
			getReleaseContentEntry({ id: "v270", body: "Release notes", filePath: "src/content/releases/v2.7.0.md" }),
		).toStrictEqual({ id: "v2.7.0", body: "Release notes" });
	});
});
