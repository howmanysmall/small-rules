import { describe } from "vitest";
import rule from "$oxc-rules/prefer-use-reducer";

import { ts } from "./rule-testers";

describe("prefer-use-reducer", () => {
	ts.run("prefer-use-reducer", rule, {
		invalid: [
			{
				code: `
import { useState } from "@rbxts/react";

function Component() {
	const [firstValue] = useState(0);
	const [secondValue] = useState(0);
	const [thirdValue] = useState(0);
	const [fourthValue] = useState(0);
	const [fifthValue] = useState(0);
}
`,
				errors: [{ messageId: "excessiveUseState" }],
			},
			{
				code: `
import { useState } from "@rbxts/react";

const Component = () => {
	const [firstValue] = useState(0);
	const [secondValue] = useState(0);
	const [thirdValue] = useState(0);
	const [fourthValue] = useState(0);
	const [fifthValue] = useState(0);
};
`,
				errors: [{ messageId: "excessiveUseState" }],
			},
			{
				code: `
import { useState } from "@rbxts/react";

const Component = function () {
	const [firstValue] = useState(0);
	const [secondValue] = useState(0);
	const [thirdValue] = useState(0);
	const [fourthValue] = useState(0);
	const [fifthValue] = useState(0);
};
`,
				errors: [{ messageId: "excessiveUseState" }],
			},
		],
		valid: [
			{
				code: `
import { useState } from "@rbxts/react";

function Component() {
	const [firstValue] = useState(0);
	const [secondValue] = useState(0);
	const [thirdValue] = useState(0);
	const [fourthValue] = useState(0);
}
`,
			},
			{
				code: `
import { useState } from "@rbxts/react";

function component() {
	const [firstValue] = useState(0);
	const [secondValue] = useState(0);
	const [thirdValue] = useState(0);
	const [fourthValue] = useState(0);
	const [fifthValue] = useState(0);
}
`,
			},
			{
				code: `
import { useState } from "@rbxts/react";

function Component() {
	const [firstValue] = useState(0);
	if (true) {
		const [secondValue] = useState(0);
		const [thirdValue] = useState(0);
		const [fourthValue] = useState(0);
		const [fifthValue] = useState(0);
	}
}
`,
			},
			{
				code: `
import { useState as useStateAlias } from "@rbxts/react";

function Component() {
	const [firstValue] = useStateAlias(0);
	const [secondValue] = useStateAlias(0);
	const [thirdValue] = useStateAlias(0);
	const [fourthValue] = useStateAlias(0);
	const [fifthValue] = useStateAlias(0);
}
`,
			},
		],
	});
});
