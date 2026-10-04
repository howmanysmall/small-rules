import { test as it } from "vitest";

import { startsWithVerb as importedStartsWithVerb } from "$oxc-utilities/english-utilities";

const FUNCTION_NAMES = [
	"getValue",
	"handleClick",
	"isVisible",
	"shouldRender",
	"toString",
	"fileName",
	"fooBar",
	"userProfile",
	"PascalCase",
	"create",
];

const EXTRA_ALLOW_LIST = ["foo", "user", "widget", "component", "service"];
const EXTRA_DENY_LIST = ["get", "set", "handle", "make", "build"];

const startsWithVerb = importedStartsWithVerb;

it("startsWithVerb", async ({ bench }) => {
	await bench.compare(
		bench("default options", () => {
			for (const functionName of FUNCTION_NAMES) startsWithVerb(functionName, {});
		}),
		bench("extra allow and deny lists", () => {
			for (const functionName of FUNCTION_NAMES) {
				startsWithVerb(functionName, { extraAllowList: EXTRA_ALLOW_LIST, extraDenyList: EXTRA_DENY_LIST });
			}
		}),
	);
});
