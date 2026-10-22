import {
	CLASS_DECLARATION,
	EMPTY_STATEMENT,
	EXPORT_ALL_DECLARATION,
	isExportDefaultDeclaration,
	isExportNamedDeclaration,
	isImportDeclaration,
	isImportSpecifier,
	isTsDeclareFunction,
	isTsImportEqualsDeclaration,
	isTsInterfaceDeclaration,
	isTsTypeAliasDeclaration,
	TS_ENUM_DECLARATION,
	TS_MODULE_DECLARATION,
	VARIABLE_DECLARATION,
} from "@small-rules/oxlint-utilities";
import { Minimatch } from "minimatch";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

type Statement = ESTree.Program["body"][number];

/** Declarations that erase when they carry `declare`. */
type DeclarableDeclaration =
	| ESTree.Class
	| ESTree.TSEnumDeclaration
	| ESTree.TSModuleDeclaration
	| ESTree.VariableDeclaration;

const DECLARABLE_TYPES = new Set<string>([
	CLASS_DECLARATION,
	TS_ENUM_DECLARATION,
	TS_MODULE_DECLARATION,
	VARIABLE_DECLARATION,
]);
const DEFAULT_FILES = ["**/packages/*/src/lib/**/*-types.ts"] as const;
const MATCH_OPTIONS = { dot: true } as const;

const matchers = new Map<string, Minimatch>();

function getMatcher(pattern: string): Minimatch {
	let matcher = matchers.get(pattern);
	if (matcher === undefined) {
		matcher = new Minimatch(pattern, MATCH_OPTIONS);
		matchers.set(pattern, matcher);
	}

	return matcher;
}

function isTypeFile(filename: string, files: ReadonlyArray<string>): boolean {
	const path = filename.replaceAll("\\", "/");
	return files.some((pattern) => getMatcher(pattern).match(path));
}

function isDeclarable(node: ESTree.Node): node is DeclarableDeclaration {
	return DECLARABLE_TYPES.has(node.type);
}

function isTypeOnlyDeclaration(declaration: ESTree.Node): boolean {
	// A function signature without a body, from `declare` or an overload, erases.
	if (
		isTsDeclareFunction(declaration) ||
		isTsInterfaceDeclaration(declaration) ||
		isTsTypeAliasDeclaration(declaration)
	) {
		return true;
	}

	if (isTsImportEqualsDeclaration(declaration)) return declaration.importKind === "type";
	return isDeclarable(declaration) && declaration.declare === true;
}

function isTypeOnlyImport(declaration: ESTree.ImportDeclaration): boolean {
	if (declaration.importKind === "type") return true;

	return (
		declaration.specifiers.length > 0 &&
		declaration.specifiers.every((specifier) => isImportSpecifier(specifier) && specifier.importKind === "type")
	);
}

function isTypeOnlyExport(declaration: ESTree.ExportNamedDeclaration): boolean {
	if (declaration.declaration !== null) return isTypeOnlyDeclaration(declaration.declaration);
	if (declaration.exportKind === "type") return true;
	return declaration.specifiers.length > 0 && declaration.specifiers.every(({ exportKind }) => exportKind === "type");
}

function isTypeOnlyStatement(statement: Statement): boolean {
	if (statement.type === EMPTY_STATEMENT) return true;
	if (isImportDeclaration(statement)) return isTypeOnlyImport(statement);
	if (isExportNamedDeclaration(statement)) return isTypeOnlyExport(statement);
	if (statement.type === EXPORT_ALL_DECLARATION) return statement.exportKind === "type";
	if (isExportDefaultDeclaration(statement)) return isTsInterfaceDeclaration(statement.declaration);
	return isTypeOnlyDeclaration(statement);
}

const noRuntimeInTypeFiles = createRule("no-runtime-in-type-files", "general", {
	create(context): Visitor {
		const [options] = context.options;
		if (!isTypeFile(context.filename, options?.files ?? DEFAULT_FILES)) return {};

		return {
			Program({ body }): void {
				for (const statement of body) {
					if (!isTypeOnlyStatement(statement)) {
						context.report({ messageId: "noRuntimeInTypeFile", node: statement });
					}
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow runtime code in files that hold only types.",
		},
		messages: {
			noRuntimeInTypeFile:
				"Type files are exempt from runtime tests because they must erase completely. Move this runtime code to a tested source module.",
		},
		schema: [
			{
				additionalProperties: false,
				default: { files: DEFAULT_FILES },
				properties: {
					files: {
						default: DEFAULT_FILES,
						description:
							"Glob patterns for the files that may hold only declarations that erase, matched against the full path",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noRuntimeInTypeFiles;
