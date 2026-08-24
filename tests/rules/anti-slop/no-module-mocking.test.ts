import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-module-mocking";
import { ts } from "$test/rule-testers";

describe("no-module-mocking", () => {
	ts.run("no-module-mocking", rule, {
		invalid: [
			{
				code: "vi.mock('./user-store');",
				errors: [{ messageId: "moduleMock" }],
				documentation: { id: "fail", title: "Vitest module mock" },
			},
			{ code: "jest.mock('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: "vi['doMock']('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: "jest.unstable_mockModule('./user-store');", errors: [{ messageId: "moduleMock" }] },
			{ code: 'import { vi } from "vitest"; vi.mock("./user-store");', errors: [{ messageId: "moduleMock" }] },
			{
				code: 'import { jest } from "@jest/globals"; jest.mock("./user-store");',
				errors: [{ messageId: "moduleMock" }],
			},
			{
				code: 'import { vi as testFramework } from "vitest"; testFramework.mock("./owner");',
				errors: [{ messageId: "moduleMock" }],
			},
			{
				code: 'import { "vi" as framework } from "vitest"; framework.mock("./owner");',
				errors: [{ messageId: "moduleMock" }],
			},
		],
		valid: [
			{
				code: "const store = new InMemoryUserStore();",
				documentation: { id: "pass", title: "real test implementation" },
			},
			"vi.spyOn(store, 'save');",
			"jest.resetModules();",
			"const vi = { mock() {} }; vi.mock();",
			"function test(jest: { mock(): void }) { jest.mock(); }",
			'import { vi as localVi } from "./helpers"; localVi.mock("./module");',
			"const { jest } = frameworks; jest.mock();",
			'vi[method]("./owner");',
			'createFramework().mock("./owner");',
			'anything.mock("./owner");',
			'mockDirectly("./owner");',
			'import vi from "vitest"; vi.mock("./owner");',
			'import * as vitest from "vitest"; vitest.mock("./owner");',
			"class Child extends Parent { method() { super.mock(); } }",
		],
	});
});
