import { describe, expect, it } from "vitest";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester, js, ts, tsx } from "./rule-testers";

import type { Fix } from "oxlint-plugin-utilities";

describe("rule-testers languages", () => {
	js.run("language-smoke-js", reportProgramRule, {
		invalid: [{ code: "const value = 1;", errors: [{ messageId: "program" }] }],
		valid: [],
	});

	ts.run("language-smoke-ts", reportProgramRule, {
		invalid: [{ code: "const value: number = 1;", errors: [{ messageId: "program" }] }],
		valid: [],
	});

	tsx.run("language-smoke-tsx", reportProgramRule, {
		invalid: [{ code: "const element = <frame />;", errors: [{ messageId: "program" }] }],
		valid: [],
	});

	js.run("language-smoke-jsx-override", reportProgramRule, {
		invalid: [{ code: "const element = <frame />;", errors: [{ messageId: "program" }], language: "jsx" }],
		valid: [],
	});
});

describe("rule-testers source type", () => {
	js.run("source-type-script", sourceTypeRule, {
		invalid: [
			{
				code: "var value = 1;",
				errors: [{ messageId: "script" }],
				sourceType: "script",
			},
		],
		valid: ["const value = 1;"],
	});
});

describe("rule-testers createOnce", () => {
	const tester = createRuleTester({ language: "js" });

	tester.run("create-once-hooks", createOnceRule, {
		invalid: [{ code: "const value = 1;", errors: [{ messageId: "afterSecondCase" }] }],
		valid: ["const value = 1;"],
	});
});

describe("rule-testers scope", () => {
	js.run("scope-info", scopeRule, {
		invalid: [
			{
				code: "import { useMemo } from 'react'; const value = 1; function wrap(input) { const local = value + input; return useMemo(() => local, [local]); }",
				errors: [
					{ data: { name: "useMemo" }, messageId: "importBinding" },
					{ data: { name: "useMemo" }, messageId: "importBinding" },
					{ data: { name: "value" }, messageId: "moduleBinding" },
					{ data: { name: "input" }, messageId: "declaredParameter" },
				],
			},
		],
		valid: [],
	});
});

describe("rule-testers source code helpers", () => {
	js.run("source-code-helpers", sourceCodeRule, {
		invalid: [
			{
				code: "/* leading */\nconst value = 1; // trailing\nvalue;",
				errors: [
					{ messageId: "comments" },
					{ data: { text: "value" }, messageId: "text" },
					{ data: { token: "=" }, messageId: "tokenAfter" },
				],
			},
		],
		valid: [],
	});
});

describe("rule-testers fixes and suggestions", () => {
	js.run("fixes-and-suggestions", fixRule, {
		invalid: [
			{
				code: "const oldName = 1;",
				errors: [
					{
						messageId: "rename",
						suggestions: [{ messageId: "suggestRename", output: "const suggestedName = 1;" }],
					},
				],
				output: "const newName = 1;",
			},
		],
		valid: [],
	});

	js.run("count-only-suggestions", fixRule, {
		invalid: [
			{
				code: "const oldName = 1;",
				errors: [{ messageId: "rename", suggestions: 1 }],
				output: "const newName = 1;",
			},
		],
		valid: [],
	});

	js.run("output-null", reportProgramRule, {
		invalid: [{ code: "const value = 1;", errors: [{ messageId: "program" }], output: null }],
		valid: [],
	});
});

describe("rule-testers configuration validation", () => {
	it("should reject legacy parser configuration", () => {
		expect.assertions(1);
		const legacyLanguageOptionsKey = ["language", "Options"].join("");
		const legacyParserKey = ["pars", "er"].join("");
		const parserCase = {
			code: "const value = 1;",
			errors: [{ messageId: "program" }],
			[legacyLanguageOptionsKey]: { [legacyParserKey]: {} },
		};

		expect(() => {
			js.run("reject-parser", reportProgramRule, {
				invalid: [parserCase],
				valid: [],
			});
		}).toThrow("Legacy parser configuration is not supported");
	});

	it("should reject non-JSON options", () => {
		expect.assertions(1);
		expect(() => {
			js.run("reject-non-json-options", reportProgramRule, {
				invalid: [
					{
						code: "const value = 1;",
						errors: [{ messageId: "program" }],
						options: [{ value: undefined }],
					},
				],
				valid: [],
			});
		}).toThrow("options must be JSON-serializable");
	});
});

const reportProgramRule = defineRule({
	create(context) {
		return {
			Program(node): void {
				context.report({ messageId: "program", node });
			},
		};
	},
	meta: {
		messages: { program: "Program was visited." },
		type: "problem",
	},
});

const sourceTypeRule = defineRule({
	create(context) {
		return {
			Program(node): void {
				if (node.sourceType === "script") context.report({ messageId: "script", node });
			},
		};
	},
	meta: {
		messages: { script: "Script source type was preserved." },
		type: "problem",
	},
});

const createOnceRule = defineRule({
	createOnce(context) {
		let programs = 0;
		return {
			after(): void {
				if (programs === 2) context.report({ messageId: "afterSecondCase", node: context.sourceCode.ast });
			},
			before(): void {
				programs += 1;
			},
			Program(): void {
				// nobody gaf
			},
		};
	},
	meta: {
		messages: { afterSecondCase: "Second case completed." },
		type: "problem",
	},
});

const scopeRule = defineRule({
	create(context) {
		return {
			FunctionDeclaration(node): void {
				for (const variable of context.sourceCode.getDeclaredVariables(node)) {
					if (variable.name === "input") {
						context.report({ data: { name: variable.name }, messageId: "declaredParameter", node });
					}
				}
			},
			Identifier(node): void {
				if (node.name !== "useMemo" && node.name !== "value") return;
				const variable = context.sourceCode.getScope(node).set.get(node.name);
				if (variable?.defs[0]?.type === "ImportBinding") {
					context.report({ data: { name: node.name }, messageId: "importBinding", node });
				}
				if (variable?.scope.type === "module" && variable.defs[0]?.type === "Variable") {
					context.report({ data: { name: node.name }, messageId: "moduleBinding", node });
				}
			},
		};
	},
	meta: {
		messages: {
			declaredParameter: "{{name}} was declared as a parameter.",
			importBinding: "{{name}} was resolved as an import binding.",
			moduleBinding: "{{name}} was resolved as a module binding.",
		},
		type: "problem",
	},
});

const sourceCodeRule = defineRule({
	create(context) {
		return {
			"Program:exit"(node): void {
				const [statement] = node.body;
				if (statement === undefined) return;
				if (context.sourceCode.getAllComments().length !== 2) return;
				if (context.sourceCode.getCommentsBefore(statement).length === 1) return;
				context.report({ messageId: "comments", node });
			},
			VariableDeclarator(node): void {
				context.report({ messageId: "comments", node });
				context.report({
					data: { text: context.sourceCode.getText(node.id) },
					messageId: "text",
					node: node.id,
				});
				context.report({
					data: { token: context.sourceCode.getTokenAfter(node.id)?.value ?? "" },
					messageId: "tokenAfter",
					node: node.id,
				});
			},
		};
	},
	meta: {
		messages: {
			comments: "Comments were exposed.",
			text: "Text was '{{text}}'.",
			tokenAfter: "Next token was '{{token}}'.",
		},
		type: "problem",
	},
});

const fixRule = defineRule({
	create(context) {
		return {
			Identifier(node): void {
				if (node.name !== "oldName") return;
				context.report({
					fix(fixer): Fix {
						return fixer.replaceText(node, "newName");
					},
					messageId: "rename",
					node,
					suggest: [
						{
							fix(fixer): Fix {
								return fixer.replaceText(node, "suggestedName");
							},
							messageId: "suggestRename",
						},
					],
				});
			},
		};
	},
	meta: {
		fixable: "code",
		hasSuggestions: true,
		messages: {
			rename: "Rename this identifier.",
			suggestRename: "Rename using the suggestion.",
		},
		type: "suggestion",
	},
});
