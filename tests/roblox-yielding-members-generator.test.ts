import { describe, expect, it } from "vitest";

import {
	catalogHasYieldingMember,
	createYieldingMemberCatalog,
	parseClasses,
	renderCatalog,
} from "../scripts/utilities/roblox-yielding-members";
import { classHasYieldingMember } from "../src/generated/roblox-yielding-members";

const apiDump = {
	Classes: [
		{
			Members: [{ MemberType: "Function", Name: "WaitForChild", Tags: ["CanYield"] }],
			Name: "Instance",
			Superclass: "<<<ROOT>>>",
		},
		{
			Members: [{ MemberType: "Function", Name: "GetFriendsAsync", Tags: ["Yields"] }],
			Name: "Players",
			Superclass: "Instance",
		},
		{ Members: [], Name: "ServiceProvider", Superclass: "Instance" },
	],
};

describe("roblox yielding-member catalog generation", () => {
	it("resolves direct and inherited yielding members", () => {
		expect.assertions(4);

		const catalog = createYieldingMemberCatalog(parseClasses(apiDump));

		expect(catalogHasYieldingMember(catalog, "Players", "GetFriendsAsync")).toBe(true);
		expect(catalogHasYieldingMember(catalog, "Players", "WaitForChild")).toBe(true);
		expect(catalogHasYieldingMember(catalog, "ServiceProvider", "WaitForChild")).toBe(true);
		expect(catalogHasYieldingMember(catalog, "Players", "GetAsync")).toBe(false);
	});

	it("stores each yielding declaration only on its declaring class", () => {
		expect.assertions(3);

		const catalog = createYieldingMemberCatalog(parseClasses(apiDump));

		expect(catalog.instanceMembers).toStrictEqual(["WaitForChild"]);
		expect(catalog.yieldingMembers.get("Players")).toStrictEqual(["GetFriendsAsync"]);
		expect(catalog.yieldingMembers.has("ServiceProvider")).toBe(false);
	});

	it("deduplicates repeated yielding-member groups in generated output", () => {
		expect.assertions(2);

		const rendered = renderCatalog(
			parseClasses({
				Classes: [
					{
						Members: [
							{ MemberType: "Function", Name: "IntersectAsync", Tags: ["Yields"] },
							{ MemberType: "Function", Name: "SubtractAsync", Tags: ["Yields"] },
							{ MemberType: "Function", Name: "UnionAsync", Tags: ["Yields"] },
						],
						Name: "BasePart",
						Superclass: "Instance",
					},
					{ Members: [], Name: "Instance", Superclass: "<<<ROOT>>>" },
					{ Members: [], Name: "Part", Superclass: "BasePart" },
					{ Members: [], Name: "WedgePart", Superclass: "BasePart" },
				],
			}),
		);

		const yieldingMemberGroup = "IntersectAsync,SubtractAsync,UnionAsync";
		expect(rendered.split(yieldingMemberGroup)).toHaveLength(2);
		expect(rendered.split("WedgePart")).toHaveLength(2);
	});

	it("resolves generated universal instance members", () => {
		expect.assertions(3);

		expect(classHasYieldingMember("Player", "WaitForChild")).toBe(true);
		expect(classHasYieldingMember("Player", "MissingMember")).toBe(false);
		expect(classHasYieldingMember("ExternalPlayer", "WaitForChild")).toBe(false);
	});

	it("resolves class-specific yielding members through the memoized lookup", () => {
		expect.assertions(4);

		expect(classHasYieldingMember("DataStore", "GetAsync")).toBe(true);
		// Repeat lookups exercise the cached member set rather than re-splitting the packed list.
		expect(classHasYieldingMember("DataStore", "UpdateAsync")).toBe(true);
		expect(classHasYieldingMember("DataStore", "MissingMember")).toBe(false);
		expect(classHasYieldingMember("Folder", "MissingMember")).toBe(false);
	});
});
