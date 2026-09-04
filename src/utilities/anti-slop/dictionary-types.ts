// Vendored from src/shared/dictionary-types.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: adapted to local path aliases and ESTree re-exports; omitted
// `isPopulatedObjectExpression`; uses shared opaque captured-resolution frames
// and lexical interface merges; resolves substitutions before built-ins; adds
// `keyof any` broad-key support; and keeps mapped-key walks iterative/no-cast.

import {
	continueTypeResolution,
	createTypeAliasEnvironment,
	createTypeResolution,
	hasVisibleTypeBinding,
	resolveTypeReference,
	visibleInterfaceDeclarations,
	visibleTypeAlias,
} from "$oxc-utilities/anti-slop/type-alias-resolution";
import {
	isAnyLiteral,
	isArrayExpression,
	isArrowFunctionExpression,
	isClassExpression,
	isFunctionExpression,
	isIdentifierName,
	isNewExpression,
	isObjectExpression,
	isParenthesizedExpression,
	isTemplateLiteral,
	isTsAnyKeyword,
	isTsAsExpression,
	isTsIndexSignature,
	isTsIntersectionType,
	isTsMappedType,
	isTsNeverKeyword,
	isTsNonNullExpression,
	isTsNumberKeyword,
	isTsObjectKeyword,
	isTsParenthesizedType,
	isTsPropertySignature,
	isTsSatisfiesExpression,
	isTsStringKeyword,
	isTsSymbolKeyword,
	isTsTypeAssertion,
	isTsTypeLiteral,
	isTsTypeOperator,
	isTsTypeReference,
	isTsUnionType,
	isTsUnknownKeyword,
	isUnaryExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

import type { TypeAliasEnvironment, TypeResolution } from "$oxc-utilities/anti-slop/type-alias-resolution";

const BUILT_INS = new Set(["NonNullable", "Omit", "Partial", "Pick", "PropertyKey", "Readonly", "Record", "Required"]);
const TRANSPARENT_WRAPPERS = new Set(["NonNullable", "Partial", "Readonly", "Required"]);
const OPEN_DICTIONARY = "open dictionary";

export interface TypeEnvironment {
	readonly typeAliases: TypeAliasEnvironment;
}

type UnsafeValueKind = "any" | "empty-object" | "object" | "union" | "unknown";
export interface UnsafeDictionary {
	readonly kind: "unsafe-dictionary";
	readonly unsafeValue: UnsafeValueKind;
}

type WideningTargetKind = "anonymous object" | "generic container" | "object" | "open dictionary" | "unknown";
export interface WideningTarget {
	readonly kind: WideningTargetKind;
}

export function createTypeEnvironment(
	program: ESTree.Program,
	visitorKeys: SourceCode["visitorKeys"],
): TypeEnvironment {
	return { typeAliases: createTypeAliasEnvironment(program, visitorKeys) };
}

function getTypeReferenceName(type: ESTree.TSTypeReference): string | undefined {
	return isIdentifierName(type.typeName) ? type.typeName.name : undefined;
}

function isBuiltIn(name: string, use: ESTree.TSTypeReference, environment: TypeEnvironment): boolean {
	return BUILT_INS.has(name) && !hasVisibleTypeBinding(name, use, environment.typeAliases);
}

function unwrapTransparentResolution(resolution: TypeResolution): TypeResolution {
	let current = resolution;
	while (
		isTsParenthesizedType(current.type) ||
		(isTsTypeOperator(current.type) && current.type.operator === "readonly")
	) {
		current = continueTypeResolution(current, current.type.typeAnnotation);
	}
	return current;
}

function isNeverType(type: ESTree.TSType): boolean {
	return isTsNeverKeyword(unwrapTransparentResolution(createTypeResolution(type)).type);
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
	return (
		isTsPropertySignature(member) &&
		member.optional &&
		member.typeAnnotation !== null &&
		isNeverType(member.typeAnnotation.typeAnnotation)
	);
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
	return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}

function isEffectivelyEmptyInterface(declarations: ReadonlyArray<ESTree.TSInterfaceDeclaration>): boolean {
	return declarations.every(
		(declaration) =>
			declaration.extends.length === 0 &&
			(declaration.body.body.length === 0 || declaration.body.body.every(isEffectivelyEmptyMember)),
	);
}

function unsafeGetUnionValue(
	resolution: TypeResolution,
	type: ESTree.TSUnionType,
	environment: TypeEnvironment,
): undefined | UnsafeValueKind {
	for (const member of type.types) {
		if (unsafeDirectValue(continueTypeResolution(resolution, member), environment) !== undefined) return "union";
	}
	return undefined;
}

function unsafeGetIntersectionValue(
	resolution: TypeResolution,
	type: ESTree.TSIntersectionType,
	environment: TypeEnvironment,
): undefined | UnsafeValueKind {
	let firstUnsafe: undefined | UnsafeValueKind;
	let allUnsafe = type.types.length > 0;
	for (const member of type.types) {
		const unsafe = unsafeDirectValue(continueTypeResolution(resolution, member), environment);
		if (unsafe === "any") return "any";
		if (unsafe === undefined) allUnsafe = false;
		else firstUnsafe ??= unsafe;
	}
	return allUnsafe ? firstUnsafe : undefined;
}

function unsafeGetReferenceValue(
	resolution: TypeResolution,
	type: ESTree.TSTypeReference,
	environment: TypeEnvironment,
): undefined | UnsafeValueKind {
	const name = getTypeReferenceName(type);
	if (name === undefined) return undefined;
	const resolved = resolveTypeReference(resolution, environment.typeAliases);
	if (resolved !== undefined) return unsafeDirectValue(resolved, environment);
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, type, environment)) {
		const wrapped = type.typeArguments?.params[0];
		return wrapped === undefined
			? undefined
			: unsafeDirectValue(continueTypeResolution(resolution, wrapped), environment);
	}
	const declarations = visibleInterfaceDeclarations(name, type, environment.typeAliases);
	return declarations !== undefined && isEffectivelyEmptyInterface(declarations) ? "empty-object" : undefined;
}

function unsafeDirectValue(resolution: TypeResolution, environment: TypeEnvironment): undefined | UnsafeValueKind {
	const unwrapped = unwrapTransparentResolution(resolution);
	if (isTsUnknownKeyword(unwrapped.type)) return "unknown";
	if (isTsAnyKeyword(unwrapped.type)) return "any";
	if (isTsObjectKeyword(unwrapped.type)) return "object";
	if (isTsTypeLiteral(unwrapped.type) && isEffectivelyEmptyTypeLiteral(unwrapped.type)) return "empty-object";
	if (isTsUnionType(unwrapped.type)) return unsafeGetUnionValue(unwrapped, unwrapped.type, environment);
	if (isTsIntersectionType(unwrapped.type)) return unsafeGetIntersectionValue(unwrapped, unwrapped.type, environment);
	return isTsTypeReference(unwrapped.type)
		? unsafeGetReferenceValue(unwrapped, unwrapped.type, environment)
		: undefined;
}

function getIndexValueType(annotation: ESTree.TSTypeAnnotation | null): ESTree.TSType | undefined {
	return annotation === null ? undefined : annotation.typeAnnotation;
}

function getDictionaryValueTypesFromLiteral(
	resolution: TypeResolution,
	type: ESTree.TSTypeLiteral,
): ReadonlyArray<TypeResolution> {
	const valueTypes = new Array<TypeResolution>();
	for (const member of type.members) {
		if (!isTsIndexSignature(member)) continue;
		const valueType = getIndexValueType(member.typeAnnotation);
		if (valueType === undefined) continue;
		valueTypes.push(continueTypeResolution(resolution, valueType));
	}
	return valueTypes;
}

function getDictionaryValueTypesFromBuiltInReference(
	resolution: TypeResolution,
	type: ESTree.TSTypeReference,
	name: string,
	environment: TypeEnvironment,
): ReadonlyArray<TypeResolution> | undefined {
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, type, environment)) {
		const wrapped = type.typeArguments?.params[0];
		return wrapped === undefined
			? []
			: getDictionaryValueTypes(continueTypeResolution(resolution, wrapped), environment);
	}
	if (name === "Record" && isBuiltIn(name, type, environment)) {
		const value = type.typeArguments?.params[1];
		return value === undefined ? [] : [continueTypeResolution(resolution, value)];
	}
	if ((name === "Pick" || name === "Omit") && isBuiltIn(name, type, environment)) {
		const source = type.typeArguments?.params[0];
		return source === undefined
			? []
			: getDictionaryValueTypes(continueTypeResolution(resolution, source), environment);
	}
	return undefined;
}

function getDictionaryValueTypesFromReference(
	resolution: TypeResolution,
	type: ESTree.TSTypeReference,
	environment: TypeEnvironment,
): ReadonlyArray<TypeResolution> {
	const name = getTypeReferenceName(type);
	if (name === undefined) return [];
	const resolved = resolveTypeReference(resolution, environment.typeAliases);
	if (resolved !== undefined) return getDictionaryValueTypes(resolved, environment);
	const builtInResult = getDictionaryValueTypesFromBuiltInReference(resolution, type, name, environment);
	if (builtInResult !== undefined) return builtInResult;
	return [];
}

function getDictionaryValueTypes(
	resolution: TypeResolution,
	environment: TypeEnvironment,
): ReadonlyArray<TypeResolution> {
	const unwrapped = unwrapTransparentResolution(resolution);
	if (isTsTypeLiteral(unwrapped.type)) return getDictionaryValueTypesFromLiteral(unwrapped, unwrapped.type);
	if (isTsMappedType(unwrapped.type)) {
		return unwrapped.type.typeAnnotation === null
			? []
			: [continueTypeResolution(unwrapped, unwrapped.type.typeAnnotation)];
	}
	return isTsTypeReference(unwrapped.type)
		? getDictionaryValueTypesFromReference(unwrapped, unwrapped.type, environment)
		: [];
}

export function classifyUnsafeDictionaryValue(
	valueType: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	const unsafeValue = unsafeDirectValue(createTypeResolution(valueType), environment);
	return unsafeValue === undefined ? undefined : { kind: "unsafe-dictionary", unsafeValue };
}

export function classifyUnsafeDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionary {
	const valueTypes = getDictionaryValueTypes(createTypeResolution(type), environment);
	for (const valueType of valueTypes) {
		const unsafeValue = unsafeDirectValue(valueType, environment);
		if (unsafeValue !== undefined) return { kind: "unsafe-dictionary", unsafeValue };
	}
	return undefined;
}

function hasBroadRecordKey(
	resolution: TypeResolution,
	type: ESTree.TSTypeReference,
	environment: TypeEnvironment,
): boolean {
	const key = type.typeArguments?.params[0];
	return key === undefined || isBroadMappedKey(continueTypeResolution(resolution, key), environment);
}

function isDirectBroadMappedKey(type: ESTree.TSType): boolean {
	if (isTsStringKeyword(type) || isTsNumberKeyword(type) || isTsSymbolKeyword(type)) return true;
	return isTsTypeOperator(type) && type.operator === "keyof" && isTsAnyKeyword(type.typeAnnotation);
}

function isBroadMappedKey(resolution: TypeResolution, environment: TypeEnvironment): boolean {
	const pending: Array<TypeResolution> = [resolution];
	for (const frame of pending) {
		const unwrapped = unwrapTransparentResolution(frame);
		if (isDirectBroadMappedKey(unwrapped.type)) return true;
		if (isTsUnionType(unwrapped.type)) {
			for (const member of unwrapped.type.types) {
				// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
				pending.push(continueTypeResolution(unwrapped, member));
			}
			continue;
		}
		if (!isTsTypeReference(unwrapped.type)) continue;
		const resolved = resolveTypeReference(unwrapped, environment.typeAliases);
		if (resolved !== undefined) {
			// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
			pending.push(resolved);
			continue;
		}
		const name = getTypeReferenceName(unwrapped.type);
		if (name === "PropertyKey" && isBuiltIn(name, unwrapped.type, environment)) return true;
	}
	return false;
}

function classifyNonReferenceWidening(
	resolution: TypeResolution,
	environment: TypeEnvironment,
	named: boolean,
): undefined | WideningTarget {
	if (isTsUnknownKeyword(resolution.type)) return { kind: "unknown" };
	if (isTsObjectKeyword(resolution.type)) return { kind: "object" };
	if (isTsTypeLiteral(resolution.type)) {
		if (resolution.type.members.some(isTsIndexSignature)) return { kind: OPEN_DICTIONARY };
		return !named && resolution.type.members.length > 0 ? { kind: "anonymous object" } : undefined;
	}
	if (isTsMappedType(resolution.type)) {
		return !named || isBroadMappedKey(continueTypeResolution(resolution, resolution.type.constraint), environment)
			? { kind: OPEN_DICTIONARY }
			: undefined;
	}
	return undefined;
}

function genericAliasTarget(
	alias: ESTree.TSTypeAliasDeclaration | undefined,
	target: undefined | WideningTarget,
	allowed: boolean,
): undefined | WideningTarget {
	return allowed && (alias?.typeParameters?.params.length ?? 0) > 0 && target?.kind === OPEN_DICTIONARY
		? { kind: "generic container" }
		: target;
}

function classifyWideningReferenceResolution(
	resolution: TypeResolution,
	type: ESTree.TSTypeReference,
	environment: TypeEnvironment,
	named: boolean,
	genericContainerAllowed: boolean,
): undefined | WideningTarget {
	const name = getTypeReferenceName(type);
	if (name === undefined) return undefined;
	const alias = visibleTypeAlias(name, type, environment.typeAliases);
	const resolved = resolveTypeReference(resolution, environment.typeAliases);
	if (resolved !== undefined) {
		const target = classifyWideningResolution(resolved, environment, true, false);
		return genericAliasTarget(alias, target, genericContainerAllowed);
	}
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, type, environment)) {
		const wrapped = type.typeArguments?.params[0];
		return wrapped === undefined
			? undefined
			: classifyWideningResolution(
					continueTypeResolution(resolution, wrapped),
					environment,
					named,
					genericContainerAllowed,
				);
	}
	if (name === "Record" && isBuiltIn(name, type, environment)) {
		return hasBroadRecordKey(resolution, type, environment) ? { kind: OPEN_DICTIONARY } : undefined;
	}
	return undefined;
}

function classifyWideningResolution(
	resolution: TypeResolution,
	environment: TypeEnvironment,
	named: boolean,
	genericContainerAllowed: boolean,
): undefined | WideningTarget {
	const unwrapped = unwrapTransparentResolution(resolution);
	return isTsTypeReference(unwrapped.type)
		? classifyWideningReferenceResolution(unwrapped, unwrapped.type, environment, named, genericContainerAllowed)
		: classifyNonReferenceWidening(unwrapped, environment, named);
}

export function classifyWideningTarget(type: ESTree.TSType, environment: TypeEnvironment): undefined | WideningTarget {
	return classifyWideningResolution(createTypeResolution(type), environment, false, true);
}

export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
	let current = expression;
	while (
		isParenthesizedExpression(current) ||
		isTsAsExpression(current) ||
		isTsTypeAssertion(current) ||
		isTsNonNullExpression(current) ||
		isTsSatisfiesExpression(current)
	) {
		current = current.expression;
	}
	if (isObjectExpression(current)) return true;
	return (
		isArrayExpression(current) ||
		isArrowFunctionExpression(current) ||
		isClassExpression(current) ||
		isFunctionExpression(current) ||
		isNewExpression(current) ||
		isAnyLiteral(current) ||
		isTemplateLiteral(current) ||
		isUnaryExpression(current)
	);
}
