import { describe, expect, it } from "vitest";
import { addLocalComponentImportIdentifiers } from "$oxc-utilities/local-component-discovery";
import { RuleTester } from "eslint";
import { defineRule } from "oxlint-plugin-utilities";

import type { LocalComponentInspection } from "$oxc-utilities/local-component-discovery";
import type { CreateRule, Visitor } from "oxlint-plugin-utilities";

const COMPONENT_NAME = "Button";
const MATCHING_INSPECTION: LocalComponentInspection = { importStyle: "default", matches: true };
const NON_MATCHING_INSPECTION: LocalComponentInspection = { importStyle: undefined, matches: false };

const MESSAGES = { found: "found identifier" };

function createCollectorRule(inspection: LocalComponentInspection): CreateRule<readonly [], "found", readonly []> {
	return defineRule({
		create(context): Visitor {
			return {
				ImportDeclaration(node): void {
					const identifiers = new Set<string>();
					addLocalComponentImportIdentifiers(node, inspection, COMPONENT_NAME, identifiers);
					if (identifiers.size > 0) {
						context.report({ messageId: "found", node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: MESSAGES, schema: [], type: "problem" },
	});
}

describe("addLocalComponentImportIdentifiers via RuleTester", () => {
	const tester = new RuleTester({
		languageOptions: { ecmaVersion: 2022, sourceType: "module" },
	});

	const matchingRule = createCollectorRule(MATCHING_INSPECTION);
	const nonMatchingRule = createCollectorRule(NON_MATCHING_INSPECTION);

	describe("matching inspection - default import", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("adds identifier for default import", matchingRule, {
			invalid: [{ code: "import MyButton from './button';", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("non-matching inspection", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("does not add identifier", nonMatchingRule, {
			invalid: [],
			valid: [{ code: "import MyButton from './button';" }],
		});
	});

	describe("non-matching named import", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("named import with different name adds nothing", matchingRule, {
			invalid: [],
			valid: [{ code: "import { Card } from './components';" }],
		});
	});

	describe("string literal imported name", () => {
		// @ts-expect-error -- RuleTester.run() type mismatch
		tester.run("string literal imported name adds identifier", matchingRule, {
			invalid: [
				{ code: 'import { "Button" as MyButton } from "./components";', errors: [{ messageId: "found" }] },
			],
			valid: [],
		});
	});
});

describe("addLocalComponentImportIdentifiers accumulation", () => {
	const accumulatedIdentifiers = new Set<string>(["ExistingComponent"]);

	const accumulatorRule = defineRule({
		create(context): Visitor {
			return {
				ImportDeclaration(node): void {
					addLocalComponentImportIdentifiers(
						node,
						MATCHING_INSPECTION,
						COMPONENT_NAME,
						accumulatedIdentifiers,
					);
					if (accumulatedIdentifiers.has("ExistingComponent") && accumulatedIdentifiers.has("NewButton")) {
						context.report({ messageId: "accumulated", node });
					}
				},
			} satisfies Visitor;
		},
		meta: { messages: { accumulated: "accumulated" }, schema: [], type: "problem" },
	});

	const accumulationTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

	// @ts-expect-error -- RuleTester.run() type mismatch
	accumulationTester.run("adds to existing set without clearing", accumulatorRule, {
		invalid: [{ code: "import NewButton from './button';", errors: [{ messageId: "accumulated" }] }],
		valid: [],
	});
});

describe("addLocalComponentImportIdentifiers Oxc IdentifierName behavior", () => {
	it("named imports with IdentifierName type do not match Identifier check", () => {
		expect.assertions(3);

		const identifiers = new Set<string>();
		const node = {
			source: { type: "StringLiteral", value: "./components" },
			specifiers: [
				{
					imported: { name: "Button", type: "IdentifierName" },
					local: { name: "Button", type: "BindingIdentifier" },
					type: "ImportSpecifier",
				},
				{
					imported: { name: "Button", type: "IdentifierName" },
					local: { name: "RenamedButton", type: "BindingIdentifier" },
					type: "ImportSpecifier",
				},
			],
			type: "ImportDeclaration",
		};

		// @ts-expect-error -- Oxc IdentifierName node shape not expressible in espree-aligned types; structurally correct at runtime
		addLocalComponentImportIdentifiers(node, MATCHING_INSPECTION, COMPONENT_NAME, identifiers);

		expect(identifiers.has("Button")).toBe(false);
		expect(identifiers.has("RenamedButton")).toBe(false);
		expect(identifiers.size).toBe(0);
	}, 5000);
});
