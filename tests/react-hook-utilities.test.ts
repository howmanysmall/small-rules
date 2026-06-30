import { describe, expect, it } from "vitest";
import {
	classifyDependencies,
	countSetStateCalls,
	DependenciesKind,
	getBindingPropertyKeyName,
	getBindingPropertyValueIdentifier,
	getEffectCallback,
	getHookName,
	isSetterIdentifier,
	walkAst,
	walkAstSlop,
} from "$oxc-utilities/react-hook-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester } from "./rule-testers";

import type { IsStaticArrayExpression } from "$oxc-utilities/react-hook-utilities";
import type { Visitor } from "oxlint-plugin-utilities";

const tester = createRuleTester({ language: "js", sourceType: "module" });

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
		tester.run("hook-name", hookNameRule, {
			invalid: [{ code: "React.useState(null)", errors: [{ messageId: "useState" }] }],
			valid: [],
		});
	});

	describe("nested call expression callee returns none", () => {
		tester.run("hook-name", hookNameRule, {
			invalid: [{ code: "getFactory()", errors: [{ messageId: "none" }] }],
			valid: [],
		});
	});

	describe("computed member expression call returns none", () => {
		tester.run("hook-name", hookNameRule, {
			invalid: [{ code: "React['useState'](null)", errors: [{ messageId: "none" }] }],
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
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect(() => { doWork(); })", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("function expression argument is found", () => {
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect(function cleanup() { doWork(); })", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("no arguments returns none", () => {
		tester.run("effect-callback", callbackRule, {
			invalid: [{ code: "useEffect()", errors: [{ messageId: "none" }] }],
			valid: [],
		});
	});

	describe("non-function first argument returns none", () => {
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
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setState(1); setCount(2); doSomething(); }", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("no setter calls", () => {
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { doSomething(); }", errors: [{ messageId: "0" }] }],
			valid: [],
		});
	});

	describe("nested setter calls", () => {
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setOuter(setInner(true)); }", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("lowercase-after-set identifiers not counted", () => {
		tester.run("count-set-state", hookTestRule, {
			invalid: [{ code: "() => { setup(); settings(); }", errors: [{ messageId: "0" }] }],
			valid: [],
		});
	});
});

describe("walkAst utility", () => {
	const walkerMessages: Record<string, string> = { "2": "2", "4": "4", identifier: "identifier" };

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
				FunctionDeclaration(node): void {
					const types = new Set<string>();
					walkAst(node, (child): void => {
						types.add(child.type);
					});
					if (types.has("Identifier")) context.report({ messageId: "identifier", node });
				},
			} satisfies Visitor;
		},
		meta: { messages: walkerMessages, schema: [], type: "problem" },
	});

	describe("arrow function with expression body", () => {
		tester.run("walk-ast", walkerTestRule, {
			invalid: [{ code: "() => 42", errors: [{ messageId: "2" }] }],
			valid: [],
		});
	});

	describe("arrow function with block statement body", () => {
		tester.run("walk-ast", walkerTestRule, {
			invalid: [{ code: "() => { return x; }", errors: [{ messageId: "4" }] }],
			valid: [],
		});
	});

	describe("function declaration identifier child", () => {
		tester.run("walk-ast", walkerTestRule, {
			invalid: [{ code: "function useValue() { return value; }", errors: [{ messageId: "identifier" }] }],
			valid: [],
		});
	});
});

describe("walkAstSlop utility", () => {
	const slopMessages: Record<string, string> = { identifier: "identifier" };

	const slopRule = defineRule({
		create(context): Visitor {
			return {
				FunctionDeclaration(node): void {
					const types = new Set<string>();
					walkAstSlop(node, (child): void => {
						types.add(child.type);
					});
					if (types.has("Identifier")) context.report({ messageId: "identifier", node });
				},
			} satisfies Visitor;
		},
		meta: { messages: slopMessages, schema: [], type: "problem" },
	});

	describe("function declaration identifier child", () => {
		tester.run("walk-ast-slop", slopRule, {
			invalid: [{ code: "function useValue() { return value; }", errors: [{ messageId: "identifier" }] }],
			valid: [],
		});
	});
});

describe("binding property utilities", () => {
	const bindingMessages: Record<string, string> = {
		assigned: "assigned",
		identifier: "identifier",
		literal: "literal",
		missing: "missing",
	};

	const bindingRule = defineRule({
		create(context): Visitor {
			return {
				VariableDeclarator(node): void {
					if (node.id.type !== "ObjectPattern") return;

					for (const property of node.id.properties) {
						if (property.type !== "Property") continue;

						const keyName = getBindingPropertyKeyName(property);
						const valueIdentifier = getBindingPropertyValueIdentifier(property);
						if (keyName === "renamed" && valueIdentifier?.name === "local") {
							context.report({ messageId: "identifier", node: property });
							continue;
						}

						if (keyName === "literal" && valueIdentifier?.name === "literal") {
							context.report({ messageId: "literal", node: property });
							continue;
						}

						if (keyName === "assigned" && valueIdentifier?.name === "assigned") {
							context.report({ messageId: "assigned", node: property });
							continue;
						}

						if (keyName === undefined || valueIdentifier === undefined) {
							context.report({ messageId: "missing", node: property });
						}
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: bindingMessages, schema: [], type: "problem" },
	});

	describe("identifier, literal, assignment, and unsupported keys", () => {
		tester.run("binding-property-utilities", bindingRule, {
			invalid: [
				{
					code: "const { renamed: local, 'literal': literal, assigned = 1, 1: one, nested: { value } } = source;",
					errors: [
						{ messageId: "identifier" },
						{ messageId: "literal" },
						{ messageId: "assigned" },
						{ messageId: "missing" },
						{ messageId: "missing" },
					],
				},
			],
			valid: [],
		});
	});
});

describe("classifyDependencies utility", () => {
	const classifyMessages: Record<string, string> = {
		empty: "empty",
		missing: "missing",
		spread: "spread",
		static: "static",
	};

	const classifyRule = defineRule({
		create(context): Visitor {
			return {
				CallExpression(node): void {
					const name = getHookName(node);
					if (name !== "useEffect") return;

					const kind = classifyDependencies(
						context.sourceCode,
						node.arguments[1],
						new Set(),
						{},
						isStaticArray,
					);
					if (kind === DependenciesKind.MissingOrOmitted) context.report({ messageId: "missing", node });
					if (kind === DependenciesKind.EmptyArray) context.report({ messageId: "empty", node });
					if (kind === DependenciesKind.StaticArray) context.report({ messageId: "static", node });
					if (kind === DependenciesKind.DynamicOrUnknown) context.report({ messageId: "spread", node });
				},
			} satisfies Visitor;
		},
		meta: { messages: classifyMessages, schema: [], type: "problem" },
	});

	describe("undefined argument (no deps)", () => {
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect()", errors: [{ messageId: "missing" }] }],
			valid: [],
		});
	});

	describe("spread element argument", () => {
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect(() => {}, ...deps)", errors: [{ messageId: "spread" }] }],
			valid: [],
		});
	});

	describe("non-array dependency argument", () => {
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect(() => {}, deps)", errors: [{ messageId: "spread" }] }],
			valid: [],
		});
	});

	describe("empty dependency array", () => {
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect(() => {}, [])", errors: [{ messageId: "empty" }] }],
			valid: [],
		});
	});

	describe("static dependency array", () => {
		tester.run("classify-deps", classifyRule, {
			invalid: [{ code: "useEffect(() => {}, [dependency])", errors: [{ messageId: "static" }] }],
			valid: [],
		});
	});

	describe("dynamic dependency array", () => {
		const dynamicArrayRule = defineRule({
			create(context): Visitor {
				return {
					CallExpression(node): void {
						const name = getHookName(node);
						if (name !== "useEffect") return;

						const kind = classifyDependencies(
							context.sourceCode,
							node.arguments[1],
							new Set(),
							{},
							() => false,
						);
						if (kind === DependenciesKind.DynamicOrUnknown) context.report({ messageId: "spread", node });
					},
				} satisfies Visitor;
			},
			meta: { messages: classifyMessages, schema: [], type: "problem" },
		});

		tester.run("classify-dynamic-deps", dynamicArrayRule, {
			invalid: [{ code: "useEffect(() => {}, [dependency])", errors: [{ messageId: "spread" }] }],
			valid: [],
		});
	});
});
