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
			"nodePart.Shape = Enum.PartType.Ball;",
			"nodePart.Shape;",
			"obj.Shape = 1;",
			"const view2 = <Foo.Shape />;",
			"type T = Foo.Shape;",
			[
				"function createNodePart(node: vector, nodeIndex: number, parent: Folder): void {",
				'\tconst nodePart = new Instance("Part");',
				"\tnodePart.Shape = Enum.PartType.Ball;",
				"}",
			].join("\n"),
		],
	});
});
