import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/react/require-tsx-for-hooks";

const TS_FILE = "src/client/react/hooks/use-thing.ts";
const DECLARATION_FILE = "src/client/react/hooks/use-thing.d.ts";
const HOOK_ERROR = [{ messageId: "requireTsxForHooks" }];

describe("require-tsx-for-hooks", () => {
	ts.run("require-tsx-for-hooks", rule, {
		invalid: [
			{
				filename: "src/hooks/use-thing.ts",
				code: "export function useThing() { return 1; }",
				errors: [{ data: { name: "useThing" }, messageId: "requireTsxForHooks" }],
				documentation: { id: "fail", title: "Hook declared in a .ts file" },
			},
			{ filename: TS_FILE, code: "const useThing = () => 1;", errors: HOOK_ERROR },
			{ filename: TS_FILE, code: "export const useThing = function () { return 1; };", errors: HOOK_ERROR },
			{ filename: TS_FILE, code: "const use2Way = () => 1;", errors: HOOK_ERROR },
			{
				filename: TS_FILE,
				code: "function outer() {\n\tfunction useInner() { return 1; }\n\treturn useInner;\n}",
				errors: HOOK_ERROR,
			},
			{
				filename: "src/client/react/hooks/use-thing.test.ts",
				code: "function useThing() { return 1; }",
				errors: HOOK_ERROR,
			},
		],
		valid: [
			{
				filename: "src/hooks/use-thing.tsx",
				code: "export function useThing() { return 1; }",
				documentation: { id: "pass", title: "Hook declared in a .tsx file" },
				language: "tsx",
			},
			{ filename: DECLARATION_FILE, code: "export declare function useThing(): number;", language: "dts" },
			{ filename: TS_FILE, code: "export declare function useThing(): number;" },
			{ filename: TS_FILE, code: "export default function () { return 1; }" },
			{ filename: TS_FILE, code: "function user() { return 1; }" },
			{ filename: TS_FILE, code: "function use() { return 1; }" },
			{ filename: TS_FILE, code: "let useThing;" },
			{ filename: TS_FILE, code: "const [useThing] = handlers;" },
			{ filename: TS_FILE, code: "const useTree = rootNode !== undefined;" },
			{ filename: TS_FILE, code: "interface Api {\n\treadonly useItem: (itemId: string) => void;\n}" },
			{ filename: TS_FILE, code: 'export { useSpring } from "./use-spring";' },
			{
				filename: TS_FILE,
				code: [
					'import { useErrorBoundary as base } from "./use-error-boundary";',
					"export const useErrorBoundary = base;",
				].join("\n"),
			},
			{ filename: TS_FILE, code: "/**\n * Read it with `useAtom`.\n */\nexport const atom = 1;" },
		],
	});
});
