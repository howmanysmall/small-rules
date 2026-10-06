import { readFileSync } from "node:fs";
import nodePath from "node:path";
import {
	isFunctionDeclarationRaw,
	isIdentifier,
	isLogicalExpression,
	isReturnStatement,
	isStringLiteral,
	isTsAsExpression,
	isTsSatisfiesExpression,
	isVariableDeclaration,
} from "@small-rules/oxlint-utilities";
import { parse } from "yuku-parser";

import { isNodeTypeName } from "./node-types.ts";
import { isOfType, listBundledSources } from "./source-files.ts";

import type { ESTree } from "oxlint-plugin-utilities";

export interface SharedConstant {
	readonly name: string;
	readonly specifier: string;
}

/** An exported function whose whole body is one `return` of an expression. */
export interface SharedFunction {
	readonly name: string;
	readonly body: ESTree.Expression;
	readonly parameters: ReadonlyArray<string>;
	readonly specifier: string;
}

export interface SharedGuard extends SharedFunction {
	/** The guard's whole body: one `&&` or `||` chain. */
	readonly body: ESTree.LogicalExpression;
}

export interface UtilitiesIndex {
	readonly getConstants: (value: string) => ReadonlyArray<SharedConstant>;
	/** The value of an exported string constant, node type constants included. */
	readonly getConstantValue: (name: string) => string | undefined;
	readonly getFunction: (name: string) => SharedFunction | undefined;
	readonly getGuards: () => ReadonlyArray<SharedGuard>;
	/**
	 * The import specifier of the module at `filename`, if it is one of the
	 * indexed modules.
	 */
	readonly getSpecifierOf: (filename: string) => string | undefined;
}

export interface UtilitiesModule {
	/**
	 * Where the module lives, to recognize it when it is the file being linted.
	 */
	readonly filename?: string;
	readonly source: string;
	/** What other files import the module as. */
	readonly specifier: string;
}

export interface UtilitiesLocation {
	readonly directory: string;
	/** Import specifier for a file, given its path without extension. */
	readonly toSpecifier: (relativePath: string) => string;
}

export interface UtilitiesIndexLoaderOptions {
	readonly locations: ReadonlyArray<UtilitiesLocation>;
	/** How long an index is reused before the files are read again. */
	readonly maxAgeMilliseconds: number;
	readonly now?: () => number;
}

const NO_CONSTANTS: ReadonlyArray<SharedConstant> = [];
const SOURCE_EXTENSION = /\.tsx?$/v;

function stripTypeAssertions(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (isTsAsExpression(current) || isTsSatisfiesExpression(current)) current = current.expression;
	return current;
}

function collectConstants(
	{ declarations, kind }: ESTree.VariableDeclaration,
	specifier: string,
	{ constants, valuesByName }: IndexCollections,
): void {
	if (kind !== "const") return;

	for (const { id, init } of declarations) {
		if (init === null || !isIdentifier(id)) continue;

		const value = stripTypeAssertions(init);
		if (!isStringLiteral(value)) continue;

		valuesByName.set(id.name, value.value);
		// Node type constants belong to `prefer-node-type-constant`.
		if (isNodeTypeName(value.value)) continue;

		const constant = { name: id.name, specifier };
		const existing = constants.get(value.value);
		if (existing === undefined) constants.set(value.value, [constant]);
		else existing.push(constant);
	}
}

function getSharedFunction(
	{ id, body, params: parameterPatterns }: ESTree.Function,
	specifier: string,
): SharedFunction | undefined {
	if (id === null || body?.body.length !== 1) return undefined;

	const parameters = new Array<string>();
	for (const parameter of parameterPatterns) {
		if (!isIdentifier(parameter)) return undefined;
		parameters.push(parameter.name);
	}

	const [statement] = body.body;
	if (!isReturnStatement(statement) || statement.argument === null) return undefined;

	return { name: id.name, body: statement.argument, parameters, specifier };
}

function isSharedGuard(sharedFunction: SharedFunction): sharedFunction is SharedGuard {
	return isLogicalExpression(sharedFunction.body);
}

/**
 * Indexes what shared utility modules export: string constants by value, and
 * guards whose whole body is one logical chain.
 *
 * @param modules - Source text of each module with its import specifier.
 * @returns Lookups over the exported constants and guards.
 */
interface IndexCollections {
	readonly constants: Map<string, Array<SharedConstant>>;
	readonly functions: Map<string, SharedFunction>;
	readonly guards: Array<SharedGuard>;
	readonly valuesByName: Map<string, string>;
}

function indexDeclaration(
	declaration: ESTree.Declaration | null,
	specifier: string,
	collections: IndexCollections,
): void {
	if (isVariableDeclaration(declaration)) {
		collectConstants(declaration, specifier, collections);
		return;
	}
	if (!isFunctionDeclarationRaw(declaration)) return;

	const sharedFunction = getSharedFunction(declaration, specifier);
	if (sharedFunction === undefined) return;

	collections.functions.set(sharedFunction.name, sharedFunction);
	if (isSharedGuard(sharedFunction)) collections.guards.push(sharedFunction);
}

export function indexUtilities(modules: Iterable<UtilitiesModule>): UtilitiesIndex {
	const collections: IndexCollections = {
		constants: new Map(),
		functions: new Map(),
		guards: [],
		valuesByName: new Map(),
	};

	const specifiersByFile = new Map<string, string>();
	for (const { filename, source, specifier } of modules) {
		if (filename !== undefined) specifiersByFile.set(nodePath.resolve(filename), specifier);
		const { program } = parse(source, { lang: "ts", preserveParens: false, sourceType: "module" });
		for (const statement of program.body) {
			if (isOfType(statement, "ExportNamedDeclaration")) {
				indexDeclaration(statement.declaration, specifier, collections);
			}
		}
	}

	const { constants, functions, guards, valuesByName } = collections;
	return {
		getConstants: (value) => constants.get(value) ?? NO_CONSTANTS,
		getConstantValue: (name) => valuesByName.get(name),
		getFunction: (name) => functions.get(name),
		getGuards: () => guards,
		getSpecifierOf: (filename) => specifiersByFile.get(nodePath.resolve(filename)),
	};
}

function readModules(locations: ReadonlyArray<UtilitiesLocation>): Array<UtilitiesModule> {
	const modules = new Array<UtilitiesModule>();
	for (const { directory, toSpecifier } of locations) {
		for (const relativePath of listBundledSources(directory)) {
			const filename = nodePath.join(directory, relativePath);
			const source = readFileSync(filename, "utf8");
			const specifier = toSpecifier(relativePath.replaceAll(nodePath.sep, "/").replace(SOURCE_EXTENSION, ""));
			modules.push({ filename, source, specifier });
		}
	}
	return modules;
}

/**
 * Reads and indexes the shared utility modules, reusing the index for a short
 * time so editing a utility updates the lint without restarting it.
 *
 * @param options - Where the modules live and how long an index is reused.
 * @returns A function returning the current index.
 */
export function createUtilitiesIndexLoader({
	locations,
	maxAgeMilliseconds,
	now = Date.now,
}: UtilitiesIndexLoaderOptions): () => UtilitiesIndex {
	let index: undefined | UtilitiesIndex;
	let indexedAt = 0;

	return () => {
		const time = now();
		if (index === undefined || time - indexedAt >= maxAgeMilliseconds) {
			index = indexUtilities(readModules(locations));
			indexedAt = time;
		}
		return index;
	};
}
