import { describe, expect, it } from "vitest";

import {
	catalogHasYieldingMember,
	createYieldingMemberCatalog,
	parseClasses,
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

	it("resolves generated universal instance members", () => {
		expect.assertions(3);

		expect(classHasYieldingMember("Player", "WaitForChild")).toBe(true);
		expect(classHasYieldingMember("Player", "MissingMember")).toBe(false);
		expect(classHasYieldingMember("ExternalPlayer", "WaitForChild")).toBe(false);
	});
});
