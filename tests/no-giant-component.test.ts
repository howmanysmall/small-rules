import { describe } from "vitest";
import rule from "$oxc-rules/no-giant-component";

import { tsx } from "./rule-testers";

function buildComponentBody(innerLineCount: number): string {
	const lines = new Array<string>(innerLineCount);
	for (let index = 0; index < innerLineCount; index += 1) {
		lines[index] = `  call${index}();`;
	}
	return lines.join("\n");
}

const componentJustUnder = `function JustUnder() {\n${buildComponentBody(298)}\n}`;
const componentOverThreshold = `function Giant() {\n${buildComponentBody(299)}\n}`;
const arrowOverThreshold = `const GiantArrow = () => {\n${buildComponentBody(299)}\n};`;
const functionExpressionOverThreshold = `const GiantExpr = function() {\n${buildComponentBody(299)}\n};`;

describe("no-giant-component", () => {
	// @ts-expect-error - RuleTester types are stricter than the runtime rule shape
	tsx.run("no-giant-component", rule, {
		invalid: [
			{
				code: componentOverThreshold,
				errors: [{ messageId: "giantComponent" }],
			},
			{
				code: arrowOverThreshold,
				errors: [{ messageId: "giantComponent" }],
			},
			{
				code: functionExpressionOverThreshold,
				errors: [{ messageId: "giantComponent" }],
			},
		],
		valid: [
			"function SmallComponent() {\n  return <frame />;\n}",
			"const SmallArrow = () => {\n  return <frame />;\n};",
			"const SmallExpr = function() {\n  return <frame />;\n};",
			"function helperFunction() {\n  return 42;\n}",
			"const helperArrow = () => 42;",
			"const notAFunction = 42;",
			{
				code: componentJustUnder,
			},
		],
	});
});
