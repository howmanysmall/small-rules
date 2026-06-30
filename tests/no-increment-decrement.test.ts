import { describe } from "vitest";
import rule from "$oxc-rules/no-increment-decrement";

import { js } from "./rule-testers";

describe("no-increment-decrement", () => {
	js.run("no-increment-decrement", rule, {
		invalid: [
			{
				code: "size++;",
				errors: [{ messageId: "noIncrement" }],
				options: [{ allowAutofix: true }],
				output: "size += 1;",
			},
			{
				code: "++size;",
				errors: [{ messageId: "noIncrement" }],
				options: [{ allowAutofix: true }],
				output: "size += 1;",
			},
			{
				code: "size--;",
				errors: [{ messageId: "noDecrement" }],
				options: [{ allowAutofix: true }],
				output: "size -= 1;",
			},
			{
				code: "--size;",
				errors: [{ messageId: "noDecrement" }],
				options: [{ allowAutofix: true }],
				output: "size -= 1;",
			},
			{
				code: "obj.prop++;",
				errors: [{ messageId: "noIncrement" }],
				options: [{ allowAutofix: true }],
				output: "obj.prop += 1;",
			},
			{
				code: "for (let i = 0; i < 10; i++);",
				errors: [{ messageId: "noIncrement" }],
				options: [{ allowAutofix: true }],
				output: "for (let i = 0; i < 10; i += 1);",
			},
			{
				code: "for (let i = 10; i > 0; i--);",
				errors: [{ messageId: "noDecrement" }],
				options: [{ allowAutofix: true }],
				output: "for (let i = 10; i > 0; i -= 1);",
			},
			{
				code: "for (let i = 0; i < 10; ++i);",
				errors: [{ messageId: "noIncrement" }],
				options: [{ allowAutofix: true }],
				output: "for (let i = 0; i < 10; i += 1);",
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
			"size += 1;",
			"size -= 1;",
			"array[index] = value;",
			"const x = 1;",
			"foo(size);",
		],
	});
});
