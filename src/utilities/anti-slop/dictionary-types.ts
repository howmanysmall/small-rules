// Vendored from src/shared/dictionary-types.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation.

import type { ESTree } from "oxlint-plugin-utilities";

const BUILTIN_TYPE_NAMES = {
	NonNullable: true,
	Partial: true,
	Readonly: true,
	Record: true,
	Required: true,
} as const;

const TRANSPARENT_TYPE_NAMES = {
	NonNullable: true,
	Partial: true,
	Readonly: true,
	Required: true,
} as const;

/** A dictionary value category that provides no concrete contract. */
export type UnsafeDictionaryValue = "any" | "empty-object" | "object" | "union" | "unknown";

/** A broad annotation category that discards a value's known structure. */
export type WideningTargetKind = "anonymous object" | "generic container" | "object" | "open dictionary" | "unknown";

/** Top-level declarations used to resolve local dictionary types. */
export interface TypeEnvironment {
	readonly aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>;
	readonly interfaces: ReadonlyMap<string, ReadonlyArray<ESTree.TSInterfaceDeclaration>>;
	readonly shadowedBuiltIns: ReadonlySet<string>;
}

const OPEN_DICTIONARY: WideningTargetKind = "open dictionary";

interface UnsafeValueEvaluation {
	readonly id: number;
	readonly type: ESTree.TSType;
}

interface UnsafeValueBatch {
	readonly evaluations: ReadonlyArray<UnsafeValueEvaluation>;
	readonly nextEvaluationId: number;
}

interface DictionaryValueResolution {
	readonly valueTypes: ReadonlyArray<ESTree.TSType>;
}

interface UnsafeValueCompound {
	readonly id: number;
	readonly memberIds: ReadonlyArray<number>;
	readonly operator: "intersection" | "union";
}

type UnsafeValueResolution =
	| {
			readonly kind: "compound";
			readonly members: ReadonlyArray<ESTree.TSType>;
			readonly operator: UnsafeValueCompound["operator"];
	  }
	| {
			readonly kind: "value";
			readonly value: undefined | UnsafeDictionaryValue;
	  };

function declaredStatement(statement: ESTree.Statement): ESTree.Node | undefined {
	if (statement.type !== "ExportNamedDeclaration" && statement.type !== "ExportDefaultDeclaration") return statement;
	return statement.declaration ?? undefined;
}

function isBuiltIn(name: string, environment: TypeEnvironment): boolean {
	return Object.hasOwn(BUILTIN_TYPE_NAMES, name) && !environment.shadowedBuiltIns.has(name);
}

function referenceName(type: ESTree.TSType): string | undefined {
	return type.type === "TSTypeReference" && type.typeName.type === "Identifier" ? type.typeName.name : undefined;
}

function unwrap(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (
		current.type === "TSParenthesizedType" ||
		(current.type === "TSTypeOperator" && current.operator === "readonly")
	) {
		current = current.typeAnnotation;
	}
	return current;
}

function typeArgument(type: ESTree.TSTypeReference, index: number): ESTree.TSType | undefined {
	return type.typeArguments?.params.at(index);
}

function isEmptyInterface(declarations: ReadonlyArray<ESTree.TSInterfaceDeclaration> | undefined): boolean {
	if (declarations?.length !== 1) return false;
	const [declaration] = declarations;
	if (declaration === undefined || declaration.extends.length > 0) return false;
	return declaration.body.body.length === 0;
}

function unsafePrimitiveValue(type: ESTree.TSType): undefined | UnsafeDictionaryValue {
	if (type.type === "TSUnknownKeyword") return "unknown";
	if (type.type === "TSAnyKeyword") return "any";
	if (type.type === "TSObjectKeyword") return "object";
	if (type.type === "TSTypeLiteral" && type.members.length === 0) return "empty-object";
	return undefined;
}

function unsafeCompoundValue(type: ESTree.TSType): undefined | UnsafeValueResolution {
	if (type.type === "TSUnionType") {
		return { kind: "compound", members: type.types, operator: "union" };
	}
	if (type.type === "TSIntersectionType") {
		return { kind: "compound", members: type.types, operator: "intersection" };
	}
	return undefined;
}

function resolveTransparentUnsafeReference(
	type: ESTree.TSTypeReference,
	name: string,
	environment: TypeEnvironment,
): ESTree.TSType | undefined | UnsafeValueResolution {
	if (!Object.hasOwn(TRANSPARENT_TYPE_NAMES, name) || !isBuiltIn(name, environment)) return undefined;
	const argument = typeArgument(type, 0);
	return argument === undefined ? { kind: "value", value: undefined } : unwrap(argument);
}

function resolveUnsafeAlias(
	name: string,
	environment: TypeEnvironment,
	visitedAliases: Set<string>,
): ESTree.TSType | UnsafeValueResolution {
	if (isEmptyInterface(environment.interfaces.get(name))) return { kind: "value", value: "empty-object" };

	const alias = environment.aliases.get(name);
	if (alias === undefined || alias.typeParameters || visitedAliases.has(name)) {
		return { kind: "value", value: undefined };
	}
	visitedAliases.add(name);
	return unwrap(alias.typeAnnotation);
}

function resolveUnsafeReference(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	visitedAliases: Set<string>,
): ESTree.TSType | UnsafeValueResolution {
	const name = referenceName(type);
	if (name === undefined || type.type !== "TSTypeReference") return { kind: "value", value: undefined };

	const transparentReference = resolveTransparentUnsafeReference(type, name, environment);
	if (transparentReference !== undefined) return transparentReference;
	return resolveUnsafeAlias(name, environment, visitedAliases);
}

function resolveUnsafeValue(type: ESTree.TSType, environment: TypeEnvironment): UnsafeValueResolution {
	const visitedAliases = new Set<string>();
	let current = unwrap(type);

	while (true) {
		const primitiveValue = unsafePrimitiveValue(current);
		if (primitiveValue !== undefined) return { kind: "value", value: primitiveValue };

		const compoundValue = unsafeCompoundValue(current);
		if (compoundValue !== undefined) return compoundValue;

		const reference = resolveUnsafeReference(current, environment, visitedAliases);
		if ("kind" in reference) return reference;
		current = reference;
	}
}

function intersectionUnsafeValue(
	memberIds: ReadonlyArray<number>,
	values: ReadonlyMap<number, undefined | UnsafeDictionaryValue>,
): undefined | UnsafeDictionaryValue {
	let unsafeMemberValue: undefined | UnsafeDictionaryValue;
	let hasConcreteValue = false;

	for (const memberId of memberIds) {
		const value = values.get(memberId);
		if (value === "any") return "any";
		if (value === undefined) {
			hasConcreteValue = true;
			continue;
		}
		unsafeMemberValue ??= value;
	}

	return hasConcreteValue ? undefined : unsafeMemberValue;
}

function compoundUnsafeValue(
	compound: UnsafeValueCompound,
	values: ReadonlyMap<number, undefined | UnsafeDictionaryValue>,
): undefined | UnsafeDictionaryValue {
	if (compound.operator === "union") {
		return compound.memberIds.some((memberId) => values.get(memberId) !== undefined) ? "union" : undefined;
	}
	return intersectionUnsafeValue(compound.memberIds, values);
}

function resolveUnsafeValueBatch(
	evaluations: ReadonlyArray<UnsafeValueEvaluation>,
	environment: TypeEnvironment,
	compounds: Array<UnsafeValueCompound>,
	values: Map<number, undefined | UnsafeDictionaryValue>,
	nextEvaluationId: number,
): UnsafeValueBatch {
	const nestedEvaluations = new Array<UnsafeValueEvaluation>();
	let nextId = nextEvaluationId;

	for (const evaluation of evaluations) {
		const resolution = resolveUnsafeValue(evaluation.type, environment);
		if (resolution.kind === "value") {
			values.set(evaluation.id, resolution.value);
			continue;
		}

		const memberIds = new Array<number>();
		for (const member of resolution.members) {
			memberIds.push(nextId);
			nestedEvaluations.push({ id: nextId, type: member });
			nextId += 1;
		}
		compounds.push({ id: evaluation.id, memberIds, operator: resolution.operator });
	}

	return { evaluations: nestedEvaluations, nextEvaluationId: nextId };
}

function unsafeValue(type: ESTree.TSType, environment: TypeEnvironment): undefined | UnsafeDictionaryValue {
	let evaluations: ReadonlyArray<UnsafeValueEvaluation> = [{ id: 0, type }];
	const compounds = new Array<UnsafeValueCompound>();
	const values = new Map<number, undefined | UnsafeDictionaryValue>();
	let nextEvaluationId = 1;

	while (evaluations.length > 0) {
		const { evaluations: nextEvaluations, nextEvaluationId: nextId } = resolveUnsafeValueBatch(
			evaluations,
			environment,
			compounds,
			values,
			nextEvaluationId,
		);
		evaluations = nextEvaluations;
		nextEvaluationId = nextId;
	}

	for (const compound of compounds.toReversed()) {
		values.set(compound.id, compoundUnsafeValue(compound, values));
	}

	return values.get(0);
}

function directDictionaryValueTypes(type: ESTree.TSType): ReadonlyArray<ESTree.TSType> | undefined {
	if (type.type === "TSTypeLiteral") {
		return type.members.flatMap((member) => {
			if (member.type !== "TSIndexSignature") return [];
			return [member.typeAnnotation.typeAnnotation];
		});
	}
	if (type.type === "TSMappedType") {
		const annotation = type.typeAnnotation;
		return annotation ? [annotation] : [];
	}
	return undefined;
}

function resolveTransparentDictionaryReference(
	type: ESTree.TSTypeReference,
	name: string,
	environment: TypeEnvironment,
): DictionaryValueResolution | ESTree.TSType | undefined {
	if (!Object.hasOwn(TRANSPARENT_TYPE_NAMES, name) || !isBuiltIn(name, environment)) return undefined;
	const argument = typeArgument(type, 0);
	return argument === undefined ? { valueTypes: [] } : unwrap(argument);
}

/**
 * Classifies a direct dictionary value contract.
 * @param type - The candidate dictionary value type.
 * @param environment - Aliases and interfaces visible to the value.
 * @returns The unsafe value category, if one exists.
 */
export function classifyUnsafeDictionaryValue(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionaryValue {
	return unsafeValue(type, environment);
}

function resolveDictionaryAlias(
	name: string,
	environment: TypeEnvironment,
	visitedAliases: Set<string>,
): DictionaryValueResolution | ESTree.TSType {
	const alias = environment.aliases.get(name);
	if (alias === undefined || visitedAliases.has(name)) return { valueTypes: [] };
	visitedAliases.add(name);
	return unwrap(alias.typeAnnotation);
}

function resolveDictionaryReference(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	visitedAliases: Set<string>,
): DictionaryValueResolution | ESTree.TSType {
	const name = referenceName(type);
	if (name === undefined || type.type !== "TSTypeReference") return { valueTypes: [] };
	if (name === "Record" && isBuiltIn(name, environment)) {
		const value = typeArgument(type, 1);
		return { valueTypes: value === undefined ? [] : [value] };
	}

	const transparentReference = resolveTransparentDictionaryReference(type, name, environment);
	if (transparentReference !== undefined) return transparentReference;
	return resolveDictionaryAlias(name, environment, visitedAliases);
}

function dictionaryValueTypes(type: ESTree.TSType, environment: TypeEnvironment): ReadonlyArray<ESTree.TSType> {
	const visitedAliases = new Set<string>();
	let current = unwrap(type);

	while (true) {
		const directValueTypes = directDictionaryValueTypes(current);
		if (directValueTypes !== undefined) return directValueTypes;

		const reference = resolveDictionaryReference(current, environment, visitedAliases);
		if ("valueTypes" in reference) return reference.valueTypes;
		current = reference;
	}
}

function collectTypeDeclaration(
	declaration: ESTree.Node,
	aliases: Map<string, ESTree.TSTypeAliasDeclaration>,
	interfaces: Map<string, Array<ESTree.TSInterfaceDeclaration>>,
	shadowedBuiltIns: Set<string>,
): void {
	if (declaration.type === "ImportDeclaration") {
		for (const specifier of declaration.specifiers) {
			/* v8 ignore next -- the istanbul conversion emits an empty implicit-else arm for this branch. @preserve */
			if (Object.hasOwn(BUILTIN_TYPE_NAMES, specifier.local.name)) {
				shadowedBuiltIns.add(specifier.local.name);
			}
		}
		return;
	}
	if (declaration.type === "TSTypeAliasDeclaration") {
		const { name } = declaration.id;
		aliases.set(name, declaration);
		if (Object.hasOwn(BUILTIN_TYPE_NAMES, name)) shadowedBuiltIns.add(name);
		return;
	}
	if (declaration.type === "TSInterfaceDeclaration") {
		const { name } = declaration.id;
		const declarations = interfaces.get(name) ?? [];
		declarations.push(declaration);
		interfaces.set(name, declarations);
	}
}

/**
 * Collects the module-level declarations used to resolve local dictionary aliases.
 * @param program - The parsed module.
 * @returns Aliases, interfaces, and shadowed built-ins declared by the module.
 */
export function createTypeEnvironment(program: ESTree.Program): TypeEnvironment {
	const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();
	const interfaces = new Map<string, Array<ESTree.TSInterfaceDeclaration>>();
	const shadowedBuiltIns = new Set<string>();

	for (const statement of program.body) {
		const declaration = declaredStatement(statement);
		if (declaration !== undefined) {
			collectTypeDeclaration(declaration, aliases, interfaces, shadowedBuiltIns);
		}
	}

	return { aliases, interfaces, shadowedBuiltIns };
}

/**
 * Classifies a dictionary value contract that offers no concrete value evidence.
 * @param type - The candidate dictionary contract.
 * @param environment - The aliases and interfaces visible to the contract.
 * @returns The unsafe value category, if one exists.
 */
export function classifyUnsafeDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | UnsafeDictionaryValue {
	for (const valueType of dictionaryValueTypes(type, environment)) {
		const unsafe = unsafeValue(valueType, environment);
		if (unsafe !== undefined) return unsafe;
	}
	return undefined;
}

function wideningTargetFromType(type: ESTree.TSType): undefined | WideningTargetKind {
	if (type.type === "TSUnknownKeyword") return "unknown";
	if (type.type === "TSObjectKeyword") return "object";
	if (type.type === "TSMappedType") return OPEN_DICTIONARY;
	if (type.type !== "TSTypeLiteral") return undefined;
	if (type.members.some((member) => member.type === "TSIndexSignature")) return OPEN_DICTIONARY;
	return type.members.length > 0 ? "anonymous object" : undefined;
}

/**
 * Classifies a broad annotation that erases known structural evidence.
 * @param type - The annotation to classify.
 * @param environment - The aliases visible to the annotation.
 * @returns The widening target category, if the annotation is broad.
 */
export function classifyWideningTarget(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): undefined | WideningTargetKind {
	const visitedAliases = new Set<string>();
	let current = unwrap(type);

	while (true) {
		const wideningTarget = wideningTargetFromType(current);
		if (wideningTarget !== undefined) return wideningTarget;

		const name = referenceName(current);
		if (name === undefined || current.type !== "TSTypeReference") return undefined;
		if (name === "Record" && isBuiltIn(name, environment)) return OPEN_DICTIONARY;

		const alias = environment.aliases.get(name);
		if (alias === undefined) return undefined;
		if (alias.typeParameters) return "generic container";
		if (visitedAliases.has(name)) return undefined;
		visitedAliases.add(name);
		current = unwrap(alias.typeAnnotation);
	}
}

/**
 * Checks whether an expression visibly carries a precise value shape.
 * @param expression - The expression to inspect.
 * @returns Whether the expression is syntactically known evidence.
 */
export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
	const current = unwrapExpression(expression);
	return (
		current.type === "ObjectExpression" ||
		current.type === "ArrayExpression" ||
		current.type === "ArrowFunctionExpression" ||
		current.type === "ClassExpression" ||
		current.type === "FunctionExpression" ||
		current.type === "Literal" ||
		current.type === "NewExpression" ||
		current.type === "TemplateLiteral" ||
		current.type === "UnaryExpression"
	);
}

function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSNonNullExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion"
	) {
		current = current.expression;
	}
	return current;
}
