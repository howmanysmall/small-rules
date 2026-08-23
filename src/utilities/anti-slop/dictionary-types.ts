// Vendored from src/shared/dictionary-types.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to local path aliases and the repository ESTree re-export,
// omitted the unused `isPopulatedObjectExpression` export, and replaced
// upstream's TypeScript assertions and recursive substitution resolution with
// no-cast iterative equivalents. Classification semantics otherwise match the
// pinned commit.

import type { ESTree } from "oxlint-plugin-utilities";

const BUILT_INS = new Set(["NonNullable", "Omit", "Partial", "Pick", "PropertyKey", "Readonly", "Record", "Required"]);
const TRANSPARENT_WRAPPERS = new Set(["NonNullable", "Partial", "Readonly", "Required"]);

type SubstitutionEnvironment = ReadonlyMap<string, ESTree.TSType>;

interface ResolvedValueType {
	readonly substitutions: SubstitutionEnvironment;
	readonly type: ESTree.TSType;
}

export interface TypeEnvironment {
	readonly aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>;
	readonly interfaces: ReadonlyMap<string, ReadonlyArray<ESTree.TSInterfaceDeclaration>>;
	readonly shadowedBuiltIns: ReadonlySet<string>;
}

export interface UnsafeDictionary {
	readonly kind: "unsafe-dictionary";
	readonly unsafeValue: "any" | "empty-object" | "object" | "union" | "unknown";
}

export type UnsafeValueKind = UnsafeDictionary["unsafeValue"];

export type WideningTargetKind = "anonymous object" | "generic container" | "object" | "open dictionary" | "unknown";

export interface WideningTarget {
	readonly kind: WideningTargetKind;
}

function declaredStatement(statement: ESTree.Statement): ESTree.Node | undefined {
	if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") {
		return statement.declaration ?? undefined;
	}
	return statement;
}

export function createTypeEnvironment(program: ESTree.Program): TypeEnvironment {
	const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();
	const interfaces = new Map<string, Array<ESTree.TSInterfaceDeclaration>>();
	const shadowedBuiltIns = new Set<string>();

	for (const statement of program.body) {
		const declaration = declaredStatement(statement);

		if (declaration?.type === "ImportDeclaration") {
			for (const specifier of declaration.specifiers) {
				if (BUILT_INS.has(specifier.local.name)) shadowedBuiltIns.add(specifier.local.name);
			}
			continue;
		}

		if (declaration?.type === "TSTypeAliasDeclaration") {
			if (aliases.has(declaration.id.name)) {
				shadowedBuiltIns.add(declaration.id.name);
			} else {
				aliases.set(declaration.id.name, declaration);
			}
			if (BUILT_INS.has(declaration.id.name)) shadowedBuiltIns.add(declaration.id.name);
			continue;
		}

		if (declaration?.type === "TSInterfaceDeclaration") {
			const declarations = interfaces.get(declaration.id.name) ?? [];
			declarations.push(declaration);
			interfaces.set(declaration.id.name, declarations);
			if (BUILT_INS.has(declaration.id.name)) shadowedBuiltIns.add(declaration.id.name);
			continue;
		}

		if (declaration?.type === "TSEnumDeclaration") {
			if (BUILT_INS.has(declaration.id.name)) shadowedBuiltIns.add(declaration.id.name);
			continue;
		}

		if (
			(declaration?.type === "ClassDeclaration" || declaration?.type === "FunctionDeclaration") &&
			declaration.id !== null &&
			BUILT_INS.has(declaration.id.name)
		)
			shadowedBuiltIns.add(declaration.id.name);
	}

	return { aliases, interfaces, shadowedBuiltIns };
}

function typeReferenceName(type: ESTree.TSTypeReference): string | undefined {
	return type.typeName.type === "Identifier" ? type.typeName.name : undefined;
}

function isBuiltIn(name: string, environment: TypeEnvironment): boolean {
	return BUILT_INS.has(name) && !environment.shadowedBuiltIns.has(name);
}

function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (
		current.type === "TSParenthesizedType" ||
		(current.type === "TSTypeOperator" && current.operator === "readonly")
	) {
		current = current.typeAnnotation;
	}
	return current;
}

function isUnappliedReferenceTo(type: ESTree.TSType, name: string): boolean {
	const unwrapped = unwrapTransparentType(type);
	return (
		unwrapped.type === "TSTypeReference" &&
		typeReferenceName(unwrapped) === name &&
		(unwrapped.typeArguments?.params.length ?? 0) === 0
	);
}

function isNeverType(type: ESTree.TSType): boolean {
	return unwrapTransparentType(type).type === "TSNeverKeyword";
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
	return (
		member.type === "TSPropertySignature" &&
		member.optional &&
		member.typeAnnotation !== null &&
		isNeverType(member.typeAnnotation.typeAnnotation)
	);
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
	return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}

function isEffectivelyEmptyInterface(declarations: ReadonlyArray<ESTree.TSInterfaceDeclaration>): boolean {
	if (declarations.length !== 1) return false;
	const [type] = declarations;
	return (
		type?.extends.length === 0 && (type.body.body.length === 0 || type.body.body.every(isEffectivelyEmptyMember))
	);
}

/**
 * Resolves substitution arguments through dependent default type parameters.
 */
function resolvedSubstitutionArgument(type: ESTree.TSType, base: SubstitutionEnvironment): ESTree.TSType {
	let current = type;
	let resolving = "";
	for (;;) {
		const unwrapped = unwrapTransparentType(current);
		if (unwrapped.type !== "TSTypeReference") return current;
		const name = typeReferenceName(unwrapped);
		if (name === undefined || name === resolving) return current;
		const substitution = base.get(name);
		if (substitution === undefined) return current;
		resolving = name;
		current = substitution;
	}
}

function aliasSubstitution(
	alias: ESTree.TSTypeAliasDeclaration,
	type: ESTree.TSTypeReference,
	base: SubstitutionEnvironment,
): SubstitutionEnvironment | undefined {
	const parameters = alias.typeParameters?.params ?? [];
	const parameters_ = type.typeArguments?.params ?? [];
	const next = new Map(base);
	for (const [index, parameter] of parameters.entries()) {
		const argument = parameters_[index] ?? parameter.default;
		if (argument === null || argument === undefined) return undefined;
		next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next));
	}
	return next;
}

function unsafeDirectValue(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): null | UnsafeValueKind {
	const unwrapped = unwrapTransparentType(type);
	switch (true) {
		case unwrapped.type === "TSUnknownKeyword":
			return "unknown";
		case unwrapped.type === "TSAnyKeyword":
			return "any";
		case unwrapped.type === "TSObjectKeyword":
			return "object";
		case unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped):
			return "empty-object";
		default:
			break;
	}
	if (unwrapped.type === "TSUnionType") {
		for (const member of unwrapped.types) {
			if (unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== null) return "union";
		}
		return null;
	}
	if (unwrapped.type === "TSIntersectionType") {
		let firstUnsafe: null | UnsafeValueKind = null;
		let allUnsafe = unwrapped.types.length > 0;
		for (const member of unwrapped.types) {
			const unsafe = unsafeDirectValue(member, environment, substitutions, resolvingAliases);
			if (unsafe === "any") return "any";
			if (unsafe === null) allUnsafe = false;
			else firstUnsafe ??= unsafe;
		}
		return allUnsafe ? firstUnsafe : null;
	}
	if (unwrapped.type !== "TSTypeReference") return null;
	const name = typeReferenceName(unwrapped);
	if (name === undefined) return null;
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined ? null : unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases);
	}
	const substitution = substitutions.get(name);
	if (substitution !== undefined) {
		return isUnappliedReferenceTo(substitution, name)
			? null
			: unsafeDirectValue(substitution, environment, substitutions, resolvingAliases);
	}
	const interfaceDeclarations = environment.interfaces.get(name);
	if (interfaceDeclarations !== undefined) {
		return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : null;
	}
	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return null;
	const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
	if (nextSubstitutions === undefined) return null;
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(name);
	return unsafeDirectValue(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function dictionaryValueTypes(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): ReadonlyArray<ResolvedValueType> {
	const unwrapped = unwrapTransparentType(type);

	if (unwrapped.type === "TSTypeLiteral") {
		const valueTypes = new Array<ResolvedValueType>();
		for (const member of unwrapped.members) {
			if (member.type === "TSIndexSignature" && member.typeAnnotation !== null) {
				valueTypes.push({ substitutions, type: member.typeAnnotation.typeAnnotation });
			}
		}
		return valueTypes;
	}

	if (unwrapped.type === "TSMappedType") {
		return unwrapped.typeAnnotation === null ? [] : [{ substitutions, type: unwrapped.typeAnnotation }];
	}

	if (unwrapped.type !== "TSTypeReference") return [];
	const name = typeReferenceName(unwrapped);
	if (name === undefined) return [];

	const substitution = substitutions.get(name);
	if (substitution !== undefined) {
		return isUnappliedReferenceTo(substitution, name)
			? []
			: dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
	}

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined ? [] : dictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
	}

	if (name === "Record" && isBuiltIn(name, environment)) {
		const value = unwrapped.typeArguments?.params[1];
		return value === undefined ? [] : [{ substitutions, type: value }];
	}

	if ((name === "Pick" || name === "Omit") && isBuiltIn(name, environment)) {
		const source = unwrapped.typeArguments?.params[0];
		return source === undefined ? [] : dictionaryValueTypes(source, environment, substitutions, resolvingAliases);
	}

	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return [];
	const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
	if (nextSubstitutions === undefined) return [];
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(name);
	return dictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

export function classifyUnsafeDictionaryValue(
	valueType: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	const unsafeValue = unsafeDirectValue(valueType, environment, new Map(), new Set());
	return unsafeValue === null ? undefined : { kind: "unsafe-dictionary", unsafeValue };
}

export function classifyUnsafeDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	for (const valueType of dictionaryValueTypes(type, environment, new Map(), new Set())) {
		const unsafeValue = unsafeDirectValue(valueType.type, environment, valueType.substitutions, new Set());
		if (unsafeValue !== null) return { kind: "unsafe-dictionary", unsafeValue };
	}
	return undefined;
}

function resolvesToDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): boolean {
	return dictionaryValueTypes(type, environment, substitutions, resolvingAliases).length > 0;
}

export function classifyWideningTarget(type: ESTree.TSType, environment: TypeEnvironment): undefined | WideningTarget {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
	if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
	if (unwrapped.type === "TSTypeLiteral") {
		if (unwrapped.members.some((member) => member.type === "TSIndexSignature")) return { kind: "open dictionary" };
		return unwrapped.members.length > 0 ? { kind: "anonymous object" } : undefined;
	}
	if (unwrapped.type === "TSMappedType") return { kind: "open dictionary" };
	if (unwrapped.type !== "TSTypeReference") return undefined;
	const name = typeReferenceName(unwrapped);
	if (name === undefined) return undefined;
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined ? undefined : classifyWideningTarget(wrapped, environment);
	}
	if (name === "Record" && isBuiltIn(name, environment)) return { kind: "open dictionary" };
	const alias = environment.aliases.get(name);
	if (alias === undefined) return undefined;
	const substitutions = aliasSubstitution(alias, unwrapped, new Map());
	if (substitutions === undefined) return undefined;
	if ((alias.typeParameters?.params.length ?? 0) > 0) {
		return resolvesToDictionary(alias.typeAnnotation, environment, substitutions, new Set([name]))
			? { kind: "generic container" }
			: undefined;
	}
	return classifyAliasBroadTarget(alias.typeAnnotation, environment, substitutions, new Set([name]));
}

function isBroadMappedKey(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
): boolean {
	const unwrapped = unwrapTransparentType(type);
	if (
		unwrapped.type === "TSStringKeyword" ||
		unwrapped.type === "TSNumberKeyword" ||
		unwrapped.type === "TSSymbolKeyword"
	) {
		return true;
	}
	if (unwrapped.type === "TSUnionType") {
		return unwrapped.types.every((member) => isBroadMappedKey(member, environment, substitutions));
	}
	if (unwrapped.type !== "TSTypeReference") return false;
	const name = typeReferenceName(unwrapped);
	if (name === undefined) return false;
	const substitution = substitutions.get(name);
	if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
		return isBroadMappedKey(substitution, environment, substitutions);
	}
	return name === "PropertyKey" && isBuiltIn(name, environment);
}

function classifyAliasBroadTarget(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | WideningTarget {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
	if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
	if (unwrapped.type === "TSTypeLiteral") {
		return unwrapped.members.some((member) => member.type === "TSIndexSignature")
			? { kind: "open dictionary" }
			: undefined;
	}
	if (unwrapped.type === "TSMappedType") {
		return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
			? { kind: "open dictionary" }
			: undefined;
	}
	if (unwrapped.type !== "TSTypeReference") return undefined;
	const name = typeReferenceName(unwrapped);
	if (name === undefined) return undefined;
	const substitution = substitutions.get(name);
	/* v8 ignore next -- This helper only receives aliases without type parameters, so substitutions are always empty. @preserve */
	if (substitution !== undefined) {
		return isUnappliedReferenceTo(substitution, name)
			? undefined
			: classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
	}
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? undefined
			: classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
	}
	if (name === "Record" && isBuiltIn(name, environment)) return { kind: "open dictionary" };
	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return undefined;
	const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
	if (nextSubstitutions === undefined) return undefined;
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(name);
	return classifyAliasBroadTarget(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
	let current = expression;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSTypeAssertion" ||
		current.type === "TSNonNullExpression" ||
		current.type === "TSSatisfiesExpression"
	) {
		current = current.expression;
	}
	if (current.type === "ObjectExpression") return true;
	return (
		current.type === "ArrayExpression" ||
		current.type === "ArrowFunctionExpression" ||
		current.type === "ClassExpression" ||
		current.type === "FunctionExpression" ||
		current.type === "NewExpression" ||
		current.type === "Literal" ||
		current.type === "TemplateLiteral" ||
		current.type === "UnaryExpression"
	);
}
