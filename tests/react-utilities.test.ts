import { describe, expect, it } from "vitest";
import {
	getEnvironment,
	getReactSources,
	getReactSourcesFromOptions,
	isEnvironment,
} from "$oxc-utilities/react-utilities";

describe("react utilities", () => {
	it("recognizes supported environments", () => {
		expect.assertions(4);

		expect(isEnvironment("roblox-ts")).toBe(true);
		expect(isEnvironment("standard")).toBe(true);
		expect(isEnvironment("react")).toBe(false);
		expect(isEnvironment(undefined)).toBe(false);
	});

	it("defaults unknown options to roblox-ts", () => {
		expect.assertions(4);

		expect(getEnvironment(undefined)).toBe("roblox-ts");
		expect(getEnvironment({ environment: "roblox-ts" })).toBe("roblox-ts");
		expect(getEnvironment({ environment: "react" })).toBe("roblox-ts");
		expect(getReactSourcesFromOptions({ environment: "react" }).has("@rbxts/react")).toBe(true);
	});

	it("returns standard React sources for the standard environment", () => {
		expect.assertions(4);

		const sources = getReactSources("standard");

		expect(sources.has("react")).toBe(true);
		expect(sources.has("react-dom")).toBe(true);
		expect(sources.has("@rbxts/react")).toBe(false);
		expect(getReactSourcesFromOptions({ environment: "standard" })).toBe(sources);
	});
});
