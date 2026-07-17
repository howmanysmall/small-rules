import { describe, expect, it } from "vitest";

import {
	createReleaseHistory,
	getReleaseContentEntry,
	releaseHistoryEmptyState,
} from "../documentation/src/data/release-history";

describe("documentation release history", () => {
	it("returns the documented empty state when no releases exist", () => {
		expect.assertions(1);

		expect(createReleaseHistory([])).toStrictEqual({
			emptyState: releaseHistoryEmptyState,
			entries: [],
			kind: "empty",
		});
	});

	it("sorts populated release entries by semantic version", () => {
		expect.assertions(1);
		const history = createReleaseHistory([
			{ body: "Patch notes", id: "v2.7.1" },
			{ body: "Major notes", id: "v3.0.0" },
			{ body: "Release notes", id: "v2.7.0" },
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
			getReleaseContentEntry({ body: "Release notes", filePath: "src/content/releases/v2.7.0.md", id: "v270" }),
		).toStrictEqual({ body: "Release notes", id: "v2.7.0" });
	});
});
