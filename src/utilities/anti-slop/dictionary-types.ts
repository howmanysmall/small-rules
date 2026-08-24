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
const OPEN_DICTIONARY = "open dictionary";

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
			const { name } = declaration.id;
			if (aliases.has(name)) shadowedBuiltIns.add(name);
			else aliases.set(name, declaration);

			if (BUILT_INS.has(name)) shadowedBuiltIns.add(name);
			continue;
		}

		if (declaration?.type === "TSInterfaceDeclaration") {
			const { name } = declaration.id;
			const declarations = interfaces.get(name) ?? [];
			declarations.push(declaration);
			interfaces.set(name, declarations);
			if (BUILT_INS.has(name)) shadowedBuiltIns.add(name);
			continue;
		}

		if (declaration?.type === "TSEnumDeclaration") {
			const { name } = declaration.id;
			if (BUILT_INS.has(name)) shadowedBuiltIns.add(name);
			continue;
		}

		if (
			(declaration?.type === "ClassDeclaration" || declaration?.type === "FunctionDeclaration") &&
			declaration.id !== null &&
			BUILT_INS.has(declaration.id.name)
		) {
			shadowedBuiltIns.add(declaration.id.name);
		}
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
		const argument = parameters_[index] ?? parameter.default ?? undefined;
		if (argument === undefined) return undefined;
		next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next));
	}
	return next;
}

function unsafeUnionValue(
	types: ReadonlyArray<ESTree.TSType>,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | UnsafeValueKind {
	for (const member of types) {
		if (unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== undefined) return "union";
	}
	return undefined;
}

function unsafeIntersectionValue(
	types: ReadonlyArray<ESTree.TSType>,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | UnsafeValueKind {
	let firstUnsafe: undefined | UnsafeValueKind;
	let allUnsafe = types.length > 0;
	for (const member of types) {
		const unsafe = unsafeDirectValue(member, environment, substitutions, resolvingAliases);
		if (unsafe === "any") return "any";

		if (unsafe === undefined) allUnsafe = false;
		else firstUnsafe ??= unsafe;
	}
	return allUnsafe ? firstUnsafe : undefined;
}

function unsafeReferenceValue(
	type: ESTree.TSTypeReference,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | UnsafeValueKind {
	const name = typeReferenceName(type);
	if (name === undefined) return undefined;

	const substitution = substitutions.get(name);
	if (substitution !== undefined) {
		return isUnappliedReferenceTo(substitution, name)
			? undefined
			: unsafeDirectValue(substitution, environment, substitutions, resolvingAliases);
	}

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = type.typeArguments?.params[0];
		return wrapped === undefined
			? undefined
			: unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases);
	}

	const interfaceDeclarations = environment.interfaces.get(name);
	if (interfaceDeclarations !== undefined) {
		return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : undefined;
	}

	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return undefined;

	const nextSubstitutions = aliasSubstitution(alias, type, substitutions);
	if (nextSubstitutions === undefined) return undefined;

	return unsafeDirectValue(
		alias.typeAnnotation,
		environment,
		nextSubstitutions,
		new Set([...resolvingAliases, name]),
	);
}

function unsafeDirectValue(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | UnsafeValueKind {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return "unknown";
	if (unwrapped.type === "TSAnyKeyword") return "any";
	if (unwrapped.type === "TSObjectKeyword") return "object";
	if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped)) return "empty-object";
	if (unwrapped.type === "TSUnionType") {
		return unsafeUnionValue(unwrapped.types, environment, substitutions, resolvingAliases);
	}
	if (unwrapped.type === "TSIntersectionType") {
		return unsafeIntersectionValue(unwrapped.types, environment, substitutions, resolvingAliases);
	}
	return unwrapped.type === "TSTypeReference"
		? unsafeReferenceValue(unwrapped, environment, substitutions, resolvingAliases)
		: undefined;
}

function indexValueType(annotation: ESTree.TSTypeAnnotation | null): ESTree.TSType | undefined {
	return annotation === null ? undefined : annotation.typeAnnotation;
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
			if (member.type !== "TSIndexSignature") continue;

			const valueType = indexValueType(member.typeAnnotation);
			if (valueType === undefined) continue;

			valueTypes.push({ substitutions, type: valueType });
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
			: resolveDictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
	}

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? []
			: resolveDictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
	}

	if (name === "Record" && isBuiltIn(name, environment)) {
		const value = unwrapped.typeArguments?.params[1];
		return value === undefined ? [] : [{ substitutions, type: value }];
	}

	if ((name === "Pick" || name === "Omit") && isBuiltIn(name, environment)) {
		const source = unwrapped.typeArguments?.params[0];
		return source === undefined
			? []
			: resolveDictionaryValueTypes(source, environment, substitutions, resolvingAliases);
	}

	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return [];
	const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
	if (nextSubstitutions === undefined) return [];
	const nextResolving = new Set([...resolvingAliases, name]);
	return resolveDictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function resolveDictionaryValueTypes(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): ReadonlyArray<ResolvedValueType> {
	return dictionaryValueTypes(type, environment, substitutions, resolvingAliases);
}

export function classifyUnsafeDictionaryValue(
	valueType: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	const unsafeValue = unsafeDirectValue(valueType, environment, new Map(), new Set());
	return unsafeValue === undefined ? undefined : { kind: "unsafe-dictionary", unsafeValue };
}

export function classifyUnsafeDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	const valueTypes = dictionaryValueTypes(type, environment, new Map(), new Set());
	for (const valueType of valueTypes) {
		const unsafeValue = unsafeDirectValue(valueType.type, environment, valueType.substitutions, new Set());
		if (unsafeValue !== undefined) return { kind: "unsafe-dictionary", unsafeValue };
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
		if (unwrapped.members.some((member) => member.type === "TSIndexSignature")) return { kind: OPEN_DICTIONARY };
		return unwrapped.members.length > 0 ? { kind: "anonymous object" } : undefined;
	}

	if (unwrapped.type === "TSMappedType") return { kind: OPEN_DICTIONARY };
	if (unwrapped.type !== "TSTypeReference") return undefined;

	const name = typeReferenceName(unwrapped);
	if (name === undefined) return undefined;

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined ? undefined : classifyWideningTarget(wrapped, environment);
	}

	if (name === "Record" && isBuiltIn(name, environment)) return { kind: OPEN_DICTIONARY };

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
		return unwrapped.types.every((member) => resolveBroadMappedKey(member, environment, substitutions));
	}
	if (unwrapped.type !== "TSTypeReference") return false;

	const name = typeReferenceName(unwrapped);
	if (name === undefined) return false;

	const substitution = substitutions.get(name);
	if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
		return resolveBroadMappedKey(substitution, environment, substitutions);
	}

	return name === "PropertyKey" && isBuiltIn(name, environment);
}

function resolveBroadMappedKey(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
): boolean {
	return isBroadMappedKey(type, environment, substitutions);
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
			? { kind: OPEN_DICTIONARY }
			: undefined;
	}

	if (unwrapped.type === "TSMappedType") {
		return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
			? { kind: OPEN_DICTIONARY }
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
			: resolveAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
	}

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? undefined
			: resolveAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
	}
	if (name === "Record" && isBuiltIn(name, environment)) return { kind: OPEN_DICTIONARY };

	const alias = environment.aliases.get(name);
	if (alias === undefined || resolvingAliases.has(name)) return undefined;

	const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
	if (nextSubstitutions === undefined) return undefined;

	const nextResolving = new Set([...resolvingAliases, name]);
	return resolveAliasBroadTarget(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function resolveAliasBroadTarget(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: SubstitutionEnvironment,
	resolvingAliases: ReadonlySet<string>,
): undefined | WideningTarget {
	return classifyAliasBroadTarget(type, environment, substitutions, resolvingAliases);
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
