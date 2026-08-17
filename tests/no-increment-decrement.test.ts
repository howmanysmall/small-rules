import { describe } from "vitest";
import rule from "$oxc-rules/general/no-increment-decrement";

import { js } from "./rule-testers";

describe("no-increment-decrement", () => {
	js.run("no-increment-decrement", rule, {
		invalid: [
			{
				code: "size++;",
				output: "size += 1;",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noIncrement" }],
				documentation: { id: "fail", title: "Post-increment compound assignment fix" },
			},
			{
				code: "++size;",
				output: "size += 1;",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noIncrement" }],
			},
			{
				code: "size--;",
				output: "size -= 1;",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noDecrement" }],
			},
			{
				code: "--size;",
				output: "size -= 1;",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noDecrement" }],
			},
			{
				code: "obj.prop++;",
				output: "obj.prop += 1;",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noIncrement" }],
			},
			{
				code: "for (let i = 0; i < 10; i++);",
				output: "for (let i = 0; i < 10; i += 1);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noIncrement" }],
			},
			{
				code: "for (let i = 10; i > 0; i--);",
				output: "for (let i = 10; i > 0; i -= 1);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noDecrement" }],
			},
			{
				code: "for (let i = 0; i < 10; ++i);",
				output: "for (let i = 0; i < 10; i += 1);",
				options: [{ allowAutofix: true }],
				errors: [{ messageId: "noIncrement" }],
			},
			{
				code: "size++;",
				errors: [{ messageId: "noIncrement" }],
			},
		],
		valid: [
			"array[size++] = value;",
			"buffer.writeu8(bytes, position++, value);",
			"[dynamicCounterReference.current++];",
			"foo(arg++);",
			"while (count--);",
			"if (++size);",
			"x = size++;",
			"x = ++size;",
			"x = size--;",
			"x = --size;",
			{ code: "size += 1;", documentation: { id: "pass", title: "Compound assignment is allowed" } },
			"size -= 1;",
			"array[index] = value;",
			"const x = 1;",
			"foo(size);",
		],
	});
});
