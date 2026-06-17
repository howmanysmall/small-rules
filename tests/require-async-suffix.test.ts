import { describe } from "vitest";
import rule from "$oxc-rules/require-async-suffix";

import { ts } from "./rule-testers";

const missingAsyncSuffixErrors = [{ messageId: "missingAsyncSuffix" }];

describe("require-async-suffix", () => {
	// @ts-expect-error -- RuleTester types do not match oxlint plugin utilities exactly.
	ts.run("require-async-suffix", rule, {
		invalid: [
			{
				code: `async function getAll(): Promise<string> {
	return "value";
}`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `const getAll = async (): Promise<string> => {
	return "value";
};`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `const getAll = async function (): Promise<string> {
	return "value";
};`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `class Bruh {
	public async getAll(): Promise<string> {
		return "value";
	}
}`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `class Bruh {
	public getAll = async (): Promise<string> => {
		return "value";
	};
}`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `const handlers = {
	async getAll(): Promise<string> {
		return "value";
	},
};`,
				errors: missingAsyncSuffixErrors,
			},
			{
				code: `const obj = {
	async fetch(request: Request): Promise<Response> {
		return new Response("ok");
	},
};`,
				errors: missingAsyncSuffixErrors,
			},
		],
		valid: [
			`async function getAllAsync(): Promise<string> {
	return "value";
}`,
			`const getAllAsync = async (): Promise<string> => {
	return "value";
};`,
			`const getAllAsync = async function (): Promise<string> {
	return "value";
};`,
			`class Bruh {
	public async getAllAsync(): Promise<string> {
		return "value";
	}
}`,
			`class Bruh {
	public getAllAsync = async (): Promise<string> => {
		return "value";
	};
}`,
			`const handlers = {
	async getAllAsync(): Promise<string> {
		return "value";
	},
};`,
			`function getAll(): string {
	return "value";
}`,
			`const getAll = (): string => {
	return "value";
};`,
			`const getAll = function (): string {
	return "value";
};`,
			`class Bruh {
	public getAll(): string {
		return "value";
	}
}`,
			`void (async () => {
	await getAllAsync();
})();`,
			// Object literal method shorthand passed as call argument — name is API-required
			`Bun.serve({
	async fetch(request: Request): Promise<Response> {
		return new Response("ok");
	},
});`,
			// Object literal method shorthand passed as new expression argument
			`new SomeServer({
	async fetch(request: Request): Promise<Response> {
		return new Response("ok");
	},
});`,
		],
	});
});
