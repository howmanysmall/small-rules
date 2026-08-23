import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-shape-in-symbol-names";
import { tsx } from "$test/rule-testers";

describe("no-shape-in-symbol-names", () => {
	tsx.run("no-shape-in-symbol-names", rule, {
		invalid: [
			{
				code: "interface UserShape { id: string }",
				errors: [{ messageId: "forbiddenSymbolName" }],
				documentation: { id: "fail", title: "'shape' in a TypeScript symbol" },
			},
			{ code: "class ShapeFactory {}", errors: [{ messageId: "forbiddenSymbolName" }] },
			{ code: "class X { #shapeCache = 1; }", errors: [{ messageId: "forbiddenSymbolName" }] },
			{ code: "const view = <Shape />;", errors: [{ messageId: "forbiddenSymbolName" }] },
			{ code: "interface SHAPEModel { id: string }", errors: [{ messageId: "forbiddenSymbolName" }] },
		],
		valid: [
			{
				code: "interface User { id: string }",
				documentation: { id: "pass", title: "domain-named symbol" },
			},
			"const userFactory = createUser;",
			"const owner = <OwnerPanel />;",
			"interface DomainModel { id: string }",
		],
	});
});
