import { describe } from "vitest";

import rule from "$oxc-rules/anti-slop/no-conditional-empty-object-spread";
import { ts } from "$test/rule-testers";

describe("no-conditional-empty-object-spread", () => {
	ts.run("no-conditional-empty-object-spread", rule, {
		invalid: [
			{
				code: "const obj = { ...value, ...(cond ? {} : other) };",
				errors: [{ messageId: "avoid" }],
				documentation: { id: "fail", title: "conditional empty object spread" },
			},
			{
				code: "const obj = { ...value, ...(cond ? other : {}) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...(cond ? {} : { a: 1 }) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...(cond ? {} : other) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...(cond ? { a: 1 } : {}) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...(a ? b : {}) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...(a ? {} : b) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...value, ...(cond ? {} : getOther()) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...value, ...(cond ? getOther() : {}) };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...flag ? {} : spreadObj, extra: true };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...cond ? {} : other };",
				errors: [{ messageId: "avoid" }],
			},
			{
				code: "const obj = { ...cond ? other : {} };",
				errors: [{ messageId: "avoid" }],
			},
		],
		valid: [
			{
				code: "const obj = { ...value, ...(cond ? other : another) };",
				documentation: { id: "pass", title: "no empty object in either branch" },
			},
			{
				code: "const obj = { ...value, ...(cond ? { a: 1 } : { b: 2 }) };",
			},
			{
				code: "const arr = [...(cond ? {} : other)];",
			},
			{
				code: "const obj = { ...value };",
			},
			{
				code: "const obj = { ...cond ? { a: 1 } : { b: 2 } };",
			},
			{
				code: "const obj = { ...cond ? a : b };",
			},
			{
				code: "const obj = { ...(cond ? { a: 1 } : other) };",
			},
			{
				code: "const obj = { ...(cond ? other : { a: 1 }) };",
			},
		],
	});
});
