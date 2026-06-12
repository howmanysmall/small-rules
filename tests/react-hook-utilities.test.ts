import { describe, expect, it } from "vitest";
import {
	classifyDependencies,
	countSetStateCalls,
	DependenciesKind,
	getEffectCallback,
	getHookName,
	isSetterIdentifier,
	walkAst,
} from "$oxc-utilities/react-hook-utilities";
import { RuleTester } from "eslint";
import { defineRule } from "oxlint-plugin-utilities";

import type { IsStaticArrayExpression } from "$oxc-utilities/react-hook-utilities";
import type { Visitor } from "oxlint-plugin-utilities";

const tester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

const isStaticArray: IsStaticArrayExpression<object> = () => true;

describe("getHookName utility", () => {
	const hookNameMessages: Record<string, string> = {
		none: "none",
		useCallback: "useCallback",
		useEffect: "useEffect",
		useMemo: "useMemo",
		useState: "useState",
	};

	const hookNameRule = defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					const name = getHookName(node);
					if (name !== undefined && name in hookNameMessages) {
						context.report({ messageId: name, node });
					} else {
						context.report({ messageId: "none", node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: hookNameMessages, schema: [], type: "problem" },
	});

	describe("direct identifier call", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("hook-name", hookNameRule, {
			invalid: [
				{ code: "useState(null)", errors: [{ messageId: "useState" }] },
				{ code: "useEffect(() => {})", errors: [{ messageId: "useEffect" }] },
				{ code: "useMemo(() => 1, [])", errors: [{ messageId: "useMemo" }] },
			],
			valid: [],
		});
	});

	describe("member expression call (React.useState)", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("hook-name", hookNameRule, {
			invalid: [{ code: "React.useState(null)", errors: [{ messageId: "useState" }] }],
			valid: [],
		});
	});

	describe("nested call expression callee returns none", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("hook-name", hookNameRule, {
			invalid: [{ code: "getFactory()", errors: [{ messageId: "none" }] }],
			valid: [],
		});
	});
});

describe("isSetterIdentifier behavior", () => {
	it("matches setter pattern setX where X is uppercase", () => {
		expect.assertions(4);

		expect(isSetterIdentifier("setState")).toBe(true);
		expect(isSetterIdentifier("setCount")).toBe(true);
		expect(isSetterIdentifier("setIsVisible")).toBe(true);
		expect(isSetterIdentifier("setA")).toBe(true);
	}, 1_000);

	it("rejects lowercase after set", () => {
		expect.assertions(3);

		expect(isSetterIdentifier("setstate")).toBe(false);
		expect(isSetterIdentifier("setter")).toBe(false);
		expect(isSetterIdentifier("setup")).toBe(false);
	}, 1_000);

	it("rejects names not starting with set", () => {
		expect.assertions(2);

		expect(isSetterIdentifier("state")).toBe(false);
		expect(isSetterIdentifier("resetState")).toBe(false);
	}, 1_000);

	it("rejects empty and short strings", () => {
		expect.assertions(2);

		expect(isSetterIdentifier("")).toBe(false);
		expect(isSetterIdentifier("s")).toBe(false);
	}, 1_000);
});

describe("getEffectCallback utility", () => {
	const callbackRule = defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					const name = getHookName(node);
					if (name !== "useEffect") return;

					const callback = getEffectCallback(node);
					context.report({ messageId: callback === undefined ? "none" : "found", node });
				},
			} satisfies Visitor;
		},
		meta: {
			messages: { found: "found", none: "none" },
			schema: [],
			type: "problem",
		},
	});

	describe("arrow function argument is found", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect(() => { doWork(); })", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("function expression argument is found", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect(function cleanup() { doWork(); })", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("no arguments returns none", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect()", errors: [{ messageId: "none" }] }],
			valid: [],
		});
	});

	describe("non-function first argument returns none", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect(myRef)", errors: [{ messageId: "none" }] }],
			valid: [],
		});
	});
});

describe("countSetStateCalls behavior", () => {
	const countMessages: Record<string, string> = {
		"0": "0",
		"1": "1",
		"2": "2",
		"3": "3",
	};

	const hookTestRule = defineRule({
		create(context): Visitor {
			return {
				ArrowFunctionExpression(node): void {
					const count = countSetStateCalls(node);
					const key = String(count);
					if (key in countMessages) {
						context.report({ messageId: key, node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: countMessages, schema: [], type: "problem" },
	});

	describe("setter calls inside arrow function body", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setState(1); setCount(2); doSomething(); }", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("no setter calls", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { doSomething(); }", errors: [{ messageId: "0" }] }],
			valid: [],
		});
	});

	describe("nested setter calls", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setOuter(setInner(true)); }", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("lowercase-after-set identifiers not counted", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setup(); settings(); }", errors: [{ messageId: "0" }] }],
			valid: [],
		});
	});
});

describe("walkAst utility", () => {
	const walkerMessages: Record<string, string> = { "2": "2", "4": "4" };

	const walkerTestRule = defineRule({
		create(context): Visitor {
			return {
				ArrowFunctionExpression(node): void {
					const types = new Array<string>();
					walkAst(node, (child): void => {
						types.push(child.type);
					});
					const key = String(types.length);
					if (key in walkerMessages) {
						context.report({ messageId: key, node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: walkerMessages, schema: [], type: "problem" },
	});

	describe("arrow function with expression body", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("walk-ast", walkerTestRule, {
			invalid: [{ code: "() => 42", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("arrow function with block statement body", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("walk-ast", walkerTestRule, {
			invalid: [{ code: "() => { return x; }", errors: [{ messageId: "4" }] }],
			valid: [],
		});
	});
});

describe("classifyDependencies utility", () => {
	const classifyMessages: Record<string, string> = {
		missing: "missing",
		spread: "spread",
	};

	const classifyRule = defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					const name = getHookName(node);
					if (name !== "useEffect") return;

					const kind = classifyDependencies(
						context.sourceCode,
						node.arguments[0],
						new Set(),
						{},
						isStaticArray,
					);
					if (kind === DependenciesKind.MissingOrOmitted) {
						context.report({ messageId: "missing", node });
					} else if (kind === DependenciesKind.DynamicOrUnknown) {
						context.report({ messageId: "spread", node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: classifyMessages, schema: [], type: "problem" },
	});

	describe("undefined argument (no deps)", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect()", errors: [{ messageId: "missing" }] }],
			valid: [],
		});
	});

	describe("spread element argument", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect(() => {}, ...deps)", errors: [{ messageId: "spread" }] }],
			valid: [],
		});
	});
});
