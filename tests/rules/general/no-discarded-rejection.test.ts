import { describe } from "vitest";

import rule from "$oxc-rules/general/no-discarded-rejection";

import { ts } from "./rule-testers";

describe("no-discarded-rejection", () => {
	ts.run("no-discarded-rejection", rule, {
		invalid: [
			// Catches an explicit Promise rejection handler that erases the failure.
			{
				code: "Promise.resolve(request()).catch(() => undefined);",
				errors: [{ messageId: "noDiscardedRejection" }],
				documentation: { id: "fail", title: "discarded Promise rejection" },
			},
			{
				code: "Promise.reject(reason).catch(() => {});",
				errors: [{ messageId: "noDiscardedRejection" }],
			},
			{
				code: "new Promise(resolve => resolve()).catch(function () { return; });",
				errors: [{ messageId: "noDiscardedRejection" }],
			},
			{
				code: "const request = Promise.resolve(value);\nrequest.catch(() => { return undefined; });",
				errors: [{ messageId: "noDiscardedRejection" }],
			},
			{
				code: "Promise.resolve(value).catch(() => void 0);",
				errors: [{ messageId: "noDiscardedRejection" }],
			},
		],
		valid: [
			{
				code: "Promise.resolve(request()).catch((exception) => { logFailure(exception); });",
				documentation: { id: "pass", title: "recorded Promise rejection" },
			},
			"Promise.resolve(request()).catch(() => { failed.add(userId); return false; });",
			"Promise.resolve(request()).catch((exception) => { throw exception; });",
			"request.catch(() => undefined);",
			"const request = customPromiseLike();\nrequest.catch(() => {});",
			"const Promise = customPromiseConstructor;\nPromise.resolve(value).catch(() => {});",
			"function run(undefined: string) { Promise.resolve(value).catch(() => undefined); }",
			"Promise.resolve(value).catch(handler);",
			"Promise.resolve(value).finally(() => {});",
			"Promise.resolve(value).customOperation().catch(() => {});",
			"Promise.resolve(value).catch((exception = recordFailure()) => {});",
			"({ catch() {} }).catch(() => {});",
			"Promise.resolve(value).then(handler).catch(() => { recover(); });",
			"collection.catch(() => {});",
			"const request = request;\nrequest.catch(() => {});",
		],
	});
});
