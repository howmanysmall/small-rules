import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	addLocalComponentImportIdentifiers,
	discoverLocalComponent,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import { defineRule } from "oxlint-plugin-utilities";

import { createRuleTester } from "./rule-testers";

import type { LocalComponentDefinition, LocalComponentInspection } from "$oxc-utilities/local-component-discovery";
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

describe("addLocalComponentImportIdentifiers via local rule runner", () => {
	const tester = createRuleTester({ language: "js", sourceType: "module" });

	const matchingRule = createCollectorRule(MATCHING_INSPECTION);
	const nonMatchingRule = createCollectorRule(NON_MATCHING_INSPECTION);

	describe("matching inspection - default import", () => {
		tester.run("adds identifier for default import", matchingRule, {
			invalid: [{ code: "import MyButton from './button';", errors: [{ messageId: "found" }] }],
			valid: [],
		});
	});

	describe("non-matching inspection", () => {
		tester.run("does not add identifier", nonMatchingRule, {
			invalid: [],
			valid: [{ code: "import MyButton from './button';" }],
		});
	});

	describe("non-matching named import", () => {
		tester.run("named import with different name adds nothing", matchingRule, {
			invalid: [],
			valid: [{ code: "import { Card } from './components';" }],
		});
	});

	describe("string literal imported name", () => {
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

	const accumulationTester = createRuleTester({ language: "js", sourceType: "module" });

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

describe("addLocalComponentImportIdentifiers", () => {
	it("should ignore namespace imports when collecting identifiers", () => {
		expect.assertions(1);

		// Arrange
		const identifiers = new Set<string>();
		const node = {
			source: { type: "Literal", value: "./button" },
			specifiers: [
				{
					local: { name: "ButtonModule", type: "Identifier" },
					type: "ImportNamespaceSpecifier",
				},
			],
			type: "ImportDeclaration",
		};

		// Act
		// @ts-expect-error -- Minimal ESTree shape for the public utility contract
		addLocalComponentImportIdentifiers(node, MATCHING_INSPECTION, COMPONENT_NAME, identifiers);

		// Assert
		expect(identifiers.size).toBe(0);
	});
});

describe("inspectRelativeLocalComponentImport", () => {
	it("should ignore unresolved relative imports", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("unresolved-import");
		const filename = join(project, "src", "screen.tsx");

		const node = {
			source: { value: "./missing-button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			filename,
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should ignore non-relative import sources and missing filenames", () => {
		expect.assertions(2);

		// Arrange
		const project = createProjectFixture("non-relative-import", {
			"src/button.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const bareImportNode = {
			source: { value: "package/button" },
			specifiers: [],
			type: "ImportDeclaration",
		};
		const relativeImportNode = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const bareInspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			bareImportNode,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);
		const missingFilenameInspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			relativeImportNode,
			"",
			createComponentDefinition(),
		);

		// Assert
		expect(bareInspection).toStrictEqual(NON_MATCHING_INSPECTION);
		expect(missingFilenameInspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should reject relative imports resolved to non-component extensions", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("json-import", {
			"src/button.json": '{ "Button": true }\n',
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button.json" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should ignore component files inside ignored directories", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("ignored-directory", {
			"src/screen.tsx": "export function Screen() { return null; }\n",
			"tests/button.tsx": "export default function Button() { return null; }\n",
		});

		const node = {
			source: { value: "../tests/button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should reject matching files that do not export the component", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("missing-export", {
			"src/button.tsx": "const Button = () => null;\nexport { somethingElse };\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should reject component files whose basename is not configured", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("wrong-basename", {
			"src/card.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./card" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should reject matching files that never mention the component name", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("missing-component-name", {
			"src/button.tsx": "export default function Link() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should reject relative imports resolved to declaration files", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("declaration-file", {
			"src/button.d.ts": "export default function Button(): null;\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should report named import style for named component exports", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("named-export", {
			"src/button.tsx": "export function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		// Act
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual({ importStyle: "named", matches: true });

		cleanupProjectFixture(project);
	});

	it("should require configured markers before matching a local component file", () => {
		expect.assertions(2);

		// Arrange
		const project = createProjectFixture("markers", {
			"src/button.tsx": "export default function Button() { return <frame />; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};

		const definition = {
			...createComponentDefinition(),
			markers: ["frame"],
		};
		const missingMarkerDefinition = {
			...createComponentDefinition(),
			markers: ["imagelabel"],
		};

		// Act
		const matchingInspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			definition,
		);
		const nonMatchingInspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			join(project, "src", "screen.tsx"),
			missingMarkerDefinition,
		);

		// Assert
		expect(matchingInspection).toStrictEqual(MATCHING_INSPECTION);
		expect(nonMatchingInspection).toStrictEqual(NON_MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});

	it("should keep matching after the regex cache evicts older entries", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("regex-cache", {
			"src/button.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		const node = {
			source: { value: "./button" },
			specifiers: [],
			type: "ImportDeclaration",
		};
		const filename = join(project, "src", "screen.tsx");

		// Act
		for (let index = 0; index < 70; index += 1) {
			inspectRelativeLocalComponentImport(
				// @ts-expect-error -- Minimal ESTree shape for the public utility contract
				node,
				filename,
				{ componentName: `Missing${index}`, fileNames: ["button"] },
			);
		}
		const inspection = inspectRelativeLocalComponentImport(
			// @ts-expect-error -- Minimal ESTree shape for the public utility contract
			node,
			filename,
			createComponentDefinition(),
		);

		// Assert
		expect(inspection).toStrictEqual(MATCHING_INSPECTION);

		cleanupProjectFixture(project);
	});
});

describe("discoverLocalComponent", () => {
	it("should return not found when there is no project root", () => {
		expect.assertions(1);

		// Arrange
		const directory = mkdtempSync(join(tmpdir(), "small-rules-local-component-no-root-"));

		// Act
		const discovery = discoverLocalComponent(join(directory, "src", "screen.tsx"), createComponentDefinition());

		// Assert
		expect(discovery).toStrictEqual({ found: false });

		rmSync(directory, { force: true, recursive: true });
	});

	it("should return a sibling import source without the file extension", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("sibling-component", {
			"src/button.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		// Act
		const discovery = discoverLocalComponent(join(project, "src", "screen.tsx"), createComponentDefinition());

		// Assert
		expect(discovery).toMatchObject({
			found: true,
			importSource: "./button",
			importStyle: "default",
		});

		cleanupProjectFixture(project);
	});

	it("should ignore indexed component candidates in ignored directories", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("ignored-index-directories", {
			".cache/button.tsx": "export default function Button() { return null; }\n",
			"src/button.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
			"tests/button.tsx": "export default function Button() { return null; }\n",
		});

		// Act
		const discovery = discoverLocalComponent(join(project, "src", "screen.tsx"), createComponentDefinition());

		// Assert
		expect(discovery).toMatchObject({
			found: true,
			importSource: "./button",
		});

		cleanupProjectFixture(project);
	});

	it("should reuse the cached project file index on repeated discovery", () => {
		expect.assertions(2);

		// Arrange
		const project = createProjectFixture("cached-index", {
			"src/button.tsx": "export default function Button() { return null; }\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});
		const sourceFile = join(project, "src", "screen.tsx");

		// Act
		const firstDiscovery = discoverLocalComponent(sourceFile, createComponentDefinition());
		const secondDiscovery = discoverLocalComponent(sourceFile, createComponentDefinition());

		// Assert
		expect(firstDiscovery).toMatchObject({ found: true, importSource: "./button" });
		expect(secondDiscovery).toMatchObject({ found: true, importSource: "./button" });

		cleanupProjectFixture(project);
	});

	it("should ignore declaration files while indexing project components", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("indexed-declaration-file", {
			"src/button.d.ts": "export default function Button(): null;\n",
			"src/screen.tsx": "export function Screen() { return null; }\n",
		});

		// Act
		const discovery = discoverLocalComponent(join(project, "src", "screen.tsx"), createComponentDefinition());

		// Assert
		expect(discovery).toStrictEqual({ found: false });

		cleanupProjectFixture(project);
	});

	it("should remove a trailing index segment from the discovered import source", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("index-component", {
			"src/components/button/index.tsx": "export default function Button() { return null; }\n",
			"src/screens/example.tsx": "export function Screen() { return null; }\n",
		});

		// Act
		const discovery = discoverLocalComponent(join(project, "src", "screens", "example.tsx"), {
			componentName: COMPONENT_NAME,
			fileNames: ["index"],
		});

		// Assert
		expect(discovery).toMatchObject({
			found: true,
			importSource: "../components/button",
			importStyle: "default",
		});

		cleanupProjectFixture(project);
	});

	it("should return not found when multiple matching component files exist", () => {
		expect.assertions(1);

		// Arrange
		const project = createProjectFixture("ambiguous-component", {
			"src/components/button.tsx": "export default function Button() { return null; }\n",
			"src/fallback/button.tsx": "export default function Button() { return null; }\n",
			"src/screens/example.tsx": "export function Screen() { return null; }\n",
		});

		// Act
		const discovery = discoverLocalComponent(
			join(project, "src", "screens", "example.tsx"),
			createComponentDefinition(),
		);

		// Assert
		expect(discovery).toStrictEqual({ found: false });

		cleanupProjectFixture(project);
	});
});

// Helpers

function cleanupProjectFixture(project: string): void {
	rmSync(project, { force: true, recursive: true });
}

function createComponentDefinition(): LocalComponentDefinition {
	return {
		componentName: COMPONENT_NAME,
		fileNames: ["button"],
	} as const;
}

function createProjectFixture(name: string, files?: Record<string, string>): string {
	const project = mkdtempSync(join(tmpdir(), `small-rules-local-component-${name}-`));
	writeFileSync(join(project, "package.json"), '{"name":"fixture","type":"module"}\n');

	for (const [relativePath, contents] of Object.entries(files ?? { "src/screen.tsx": "export {};\n" })) {
		const absolutePath = join(project, relativePath);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, contents);
	}

	return project;
}
