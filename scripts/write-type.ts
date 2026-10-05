#!/usr/bin/env bun

import nodePath from "node:path";
import { argv, cwd } from "node:process";
import typescript, { EmitHint, factory, sys, TypeFormatFlags } from "typescript";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

import type {
	Declaration,
	ParseConfigFileHost,
	ParsedCommandLine,
	Printer,
	SourceFile,
	Type,
	TypeAliasDeclaration,
	TypeChecker,
	TypeNode,
} from "typescript";

const scriptName = getScriptName(true);

const TYPE_FORMAT_FLAGS =
	TypeFormatFlags.NoTruncation |
	TypeFormatFlags.InTypeAlias |
	TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
	TypeFormatFlags.WriteArrayAsGenericType;

const TRAILING_SEMICOLON_REGEXP = /;$/u;

const configurationHost: ParseConfigFileHost = {
	...sys,
	onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
		throw new Error(typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
	},
};

function parseConfiguration(filePath: string): ParsedCommandLine {
	const parsed = typescript.getParsedCommandLineOfConfigFile(filePath, undefined, configurationHost);
	if (parsed === undefined) throw new Error(`Could not parse "${filePath}".`);
	return parsed;
}

function resolveProjectOptions(filePath: string): ParsedCommandLine {
	const rootConfigPath = typescript.findConfigFile(nodePath.dirname(filePath), (path) => sys.fileExists(path));
	if (rootConfigPath === undefined) {
		return { errors: [], fileNames: [], options: { allowJs: true, noEmit: true } };
	}

	const rootConfig = parseConfiguration(rootConfigPath);
	const references = rootConfig.projectReferences ?? [];
	const candidates = [rootConfig];
	for (const reference of references) {
		candidates.push(parseConfiguration(typescript.resolveProjectReferencePath(reference)));
	}

	return candidates.find(({ fileNames }) => fileNames.includes(filePath)) ?? rootConfig;
}

function findDeclaration(sourceFile: SourceFile, typeName: string): Declaration | undefined {
	for (const statement of sourceFile.statements) {
		if (
			(typescript.isTypeAliasDeclaration(statement) ||
				typescript.isInterfaceDeclaration(statement) ||
				typescript.isClassDeclaration(statement) ||
				typescript.isEnumDeclaration(statement)) &&
			statement.name?.text === typeName
		) {
			return statement;
		}
	}
	return undefined;
}

function createExpandedTypeNode(
	type: Type,
	declaration: TypeAliasDeclaration,
	checker: TypeChecker,
): TypeNode | undefined {
	if (!type.isUnion()) {
		return checker.typeToTypeNode(type, declaration, TYPE_FORMAT_FLAGS);
	}

	const members = new Array<TypeNode>();
	for (const member of type.types) {
		const node = checker.typeToTypeNode(member, declaration, TYPE_FORMAT_FLAGS);
		if (node !== undefined) members.push(node);
	}
	return factory.createUnionTypeNode(members);
}

function writeTypeAlias(
	declaration: TypeAliasDeclaration,
	checker: TypeChecker,
	printer: Printer,
	sourceFile: SourceFile,
	shallow: boolean,
): string {
	const type = checker.getTypeAtLocation(declaration.name);
	const typeNode =
		(shallow
			? checker.typeToTypeNode(type, declaration, TYPE_FORMAT_FLAGS)
			: createExpandedTypeNode(type, declaration, checker)) ?? declaration.type;
	const alias = factory.createTypeAliasDeclaration(undefined, declaration.name, declaration.typeParameters, typeNode);
	return printer.printNode(EmitHint.Unspecified, alias, sourceFile).replace(TRAILING_SEMICOLON_REGEXP, "");
}

function writeType(filePath: string, typeName: string, shallow: boolean): string {
	const absolutePath = nodePath.resolve(cwd(), filePath);
	const { fileNames, options } = resolveProjectOptions(absolutePath);
	const program = typescript.createProgram({
		options,
		rootNames: fileNames.includes(absolutePath) ? fileNames : [absolutePath],
	});
	const sourceFile = program.getSourceFile(absolutePath);
	if (sourceFile === undefined) throw new Error(`Could not load "${filePath}".`);

	const declaration = findDeclaration(sourceFile, typeName);
	if (declaration === undefined) throw new Error(`Could not find a type named "${typeName}" in "${filePath}".`);

	if (typescript.isTypeAliasDeclaration(declaration)) {
		const printer = typescript.createPrinter({ removeComments: true });
		return writeTypeAlias(declaration, program.getTypeChecker(), printer, sourceFile, shallow);
	}

	return declaration.getText(sourceFile);
}

const command = createBaseCommand(scriptName, "1.1.0", "Writes out a TypeScript type's entire definition.")
	.argument("<file:file>", "The file containing the type to write out.")
	.argument("<type-name:string>", "The name of the type to write out.")
	.option("-s, --shallow", "Keep nested type alias names instead of expanding unions into their members.", {
		default: false,
	})
	.action(({ shallow }, filePath, typeName) => {
		console.log(writeType(filePath, typeName, shallow));
	});

await command.parse(argv.slice(2));
