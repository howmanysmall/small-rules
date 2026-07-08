// oxlint-disable small-rules/prefer-pascal-case-enums -- Roblox data types are weird.

import { readFile } from "node:fs/promises";
import { type } from "arktype";

import { downloadGitHubFileAsync } from "./github-utilities";

import type { Octokit } from "@octokit/rest";

const DATABASE_URL = "https://github.com/rojo-rbx/rbx-dom/raw/master/rbx_reflection_database/database.msgpack";

enum RobloxDataType {
	Attributes = "Attributes",
	Axes = "Axes",
	BinaryString = "BinaryString",
	Bool = "Bool",
	BrickColor = "BrickColor",
	CFrame = "CFrame",
	Color3 = "Color3",
	Color3Uint8 = "Color3uint8",
	ColorSequence = "ColorSequence",
	Content = "Content",
	ContentId = "ContentId",
	Faces = "Faces",
	Float16 = "Float16",
	Float32 = "Float32",
	Float64 = "Float64",
	Font = "Font",
	Int8 = "Int8",
	Int16 = "Int16",
	Int32 = "Int32",
	Int64 = "Int64",
	MaterialColors = "MaterialColors",
	NetAssetRef = "NetAssetRef",
	NumberRange = "NumberRange",
	NumberSequence = "NumberSequence",
	OptionalCFrame = "OptionalCFrame",
	PhysicalProperties = "PhysicalProperties",
	Ray = "Ray",
	Rect = "Rect",
	Ref = "Ref",
	Region3 = "Region3",
	Region3int16 = "Region3int16",
	SecurityCapabilities = "SecurityCapabilities",
	SharedString = "SharedString",
	String = "String",
	Tags = "Tags",
	UDim = "UDim",
	UDim2 = "UDim2",
	UniqueId = "UniqueId",
	Vector2 = "Vector2",
	Vector2int16 = "Vector2int16",
	Vector3 = "Vector3",
	Vector3int16 = "Vector3int16",
}
const isRobloxDataType = type.enumerated(...Object.values(RobloxDataType));

enum DatabaseScriptability {
	Custom = "Custom",
	None = "None",
	Read = "Read",
	ReadWrite = "ReadWrite",
	Write = "Write",
}
const isDatabaseScriptability = type.enumerated(...Object.values(DatabaseScriptability));

enum DatabasePropertyTag {
	Deprecated = "Deprecated",
	Hidden = "Hidden",
	NotBrowsable = "NotBrowsable",
	NotReplicated = "NotReplicated",
	NotScriptable = "NotScriptable",
	ReadOnly = "ReadOnly",
	WriteOnly = "WriteOnly",
}
const isDatabasePropertyTag = type.enumerated(...Object.values(DatabasePropertyTag));

export async function downloadDatabaseAsync(octokit: Octokit, existingFilePath?: string): Promise<Uint8Array> {
	if (existingFilePath !== undefined) {
		try {
			return new Uint8Array(await readFile(existingFilePath));
		} catch {
			// Fall back to download if file doesn't exist or can't be read
		}
	}

	try {
		return await downloadGitHubFileAsync(octokit, {
			owner: "UpliftGames",
			path: "database.msgpack",
			repository: "rbx-reflection-database",
		});
	} catch {
		// Fall back to direct download if GitHub API fails
	}

	const response = await fetch(DATABASE_URL);
	if (!response.ok) {
		const error = new Error(`Failed to download database: ${response.status} ${response.statusText}`);
		Error.captureStackTrace(error, downloadDatabaseAsync);
		throw error;
	}

	return new Uint8Array(await response.arrayBuffer());
}

// oxlint-disable-next-line unicorn/prefer-string-raw -- we hate it for ArkType
const isEnumType = type("/^Enum\\.\\w+$/");
const isDataType = isEnumType.or(isRobloxDataType);

const isDatabaseProperty = type({
	"+": "reject",
	dataType: isDataType,
	name: "string",
	scriptability: isDatabaseScriptability,
	tags: isDatabasePropertyTag.array().readonly(),
}).readonly();
type DatabaseProperty = typeof isDatabaseProperty.infer;

const isDatabaseClass = type({
	"+": "reject",
	defaultProperties: type("Record<string, unknown>").readonly(),
	name: "string",
	properties: type.Record("string", isDatabaseProperty).readonly(),
	superclass: "string | null",
}).readonly();
type DatabaseClass = typeof isDatabaseClass.infer;

const isRawPropertyTuple = type([
	"string",
	isDatabaseScriptability,
	type({ Enum: "string" }).or({ Value: isRobloxDataType }).readonly(),
	isDatabasePropertyTag.array().readonly().or("null | undefined"),
	"unknown",
]).readonly();
const isRawClassTuple = type([
	"string",
	type("string[]").readonly(),
	"string | null",
	type.Record("string", isRawPropertyTuple).readonly(),
	type("Record<string, unknown>").readonly(),
]).readonly();

const isRawDatabase = type([
	type(["number", "number", "number", "number"]).readonly(),
	type.Record("string", isRawClassTuple).readonly(),
	"unknown",
]).readonly();

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapValue(value: unknown): unknown {
	if (!isRecord(value)) return value;

	const keys = Object.keys(value);
	if (keys.length !== 1) return value;

	const [key] = keys;
	return key === undefined ? value : value[key];
}

type EnumLookup = ReadonlyMap<string, ReadonlyMap<number, string>>;

export function parseDatabase(raw: unknown, allowedClasses?: ReadonlySet<string>): ReadonlyMap<string, DatabaseClass> {
	const [, rawClasses, rawEnums] = isRawDatabase.assert(raw);

	const enumLookup = buildEnumLookup(rawEnums);
	const rawClassMap = new Map(Object.entries(rawClasses));
	const classes = new Map<string, DatabaseClass>();

	for (const [className, [name, , superclass, ,]] of rawClassMap) {
		if (allowedClasses !== undefined && !allowedClasses.has(className.toLowerCase())) continue;

		const merged = mergeSuperclassImplementation(className, rawClassMap);
		const defaultMap = resolveDefaults(merged.defaults, merged.propertyDefaults, enumLookup);
		const propertyMap = buildPropertyMap(merged.propertyDefaults);

		classes.set(className, { defaultProperties: defaultMap, name, properties: propertyMap, superclass });
	}

	return classes;
}

function buildEnumLookup(rawEnums: unknown): EnumLookup {
	const lookup = new Map<string, Map<number, string>>();
	if (typeof rawEnums !== "object" || rawEnums === null) return lookup;

	for (const [enumType, [, items]] of Object.entries(rawEnums)) {
		if (!isRecord(items)) continue;
		const reverse = new Map<number, string>();
		for (const [name, value] of Object.entries(items)) if (typeof value === "number") reverse.set(value, name);
		lookup.set(enumType, reverse);
	}
	return lookup;
}

function isDataTypeObject(value: unknown): value is { readonly Enum: string } | { readonly Value: string } {
	return isRecord(value) && ("Enum" in value || "Value" in value);
}

function isStringOrUndefined(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

function getDataTypeString(value: unknown): string {
	if (isDataTypeObject(value)) return "Enum" in value ? `Enum.${value.Enum}` : value.Value;
	return "string";
}

// Let's define clean internal interfaces so we can burn the raw index lookups (`[3]`, `[4]`) with fire.
interface RawClassData {
	readonly defaults: Record<string, unknown>;
	readonly properties: Record<string, unknown>;
	readonly superclass: string | undefined;
}

type NormalizedPropertyDefault = [
	resolvedType: string,
	propertyName: string,
	scriptability: string,
	tags: ReadonlyArray<string>,
];

function parseRawClassData(classData: ReadonlyArray<unknown>): RawClassData | undefined {
	const superclass = isStringOrUndefined(classData[2]) ? classData[2] : undefined;
	// oxlint-disable-next-line prefer-destructuring -- ugly.
	const properties = classData[3];
	// oxlint-disable-next-line prefer-destructuring -- ugly.
	const defaults = classData[4];

	return isRecord(properties) && isRecord(defaults) ? { defaults, properties, superclass } : undefined;
}

function getInheritanceChain(
	startClassName: string,
	allClasses: ReadonlyMap<string, ReadonlyArray<unknown>>,
): ReadonlyArray<RawClassData> {
	const chain = new Array<RawClassData>();
	let currentName: string | undefined = startClassName;

	while (currentName !== undefined) {
		const rawData = allClasses.get(currentName);
		if (rawData === undefined) break;

		const parsed = parseRawClassData(rawData);
		if (parsed === undefined) break;

		chain.push(parsed);
		currentName = parsed.superclass;
	}

	return chain.toReversed();
}

function normalizeProperty(propertyTuple: unknown): NormalizedPropertyDefault | undefined {
	if (!Array.isArray(propertyTuple) || propertyTuple.length < 3) return undefined;

	const propertyName = typeof propertyTuple[0] === "string" ? propertyTuple[0] : "";
	const scriptability = typeof propertyTuple[1] === "string" ? propertyTuple[1] : "None";
	const resolvedType = getDataTypeString(propertyTuple[2]);
	const tags = Array.isArray(propertyTuple[3])
		? propertyTuple[3].filter((tag): tag is string => typeof tag === "string")
		: [];

	return [resolvedType, propertyName, scriptability, tags];
}

function mergeSuperclassImplementation(
	className: string,
	allClasses: ReadonlyMap<string, ReadonlyArray<unknown>>,
): {
	readonly propertyDefaults: Record<string, NormalizedPropertyDefault>;
	readonly defaults: Record<string, unknown>;
} {
	const propertyDefs: Record<string, NormalizedPropertyDefault> = {};
	const defaults: Record<string, unknown> = {};

	const inheritanceChain = getInheritanceChain(className, allClasses);

	for (const { properties, defaults: classDefaults } of inheritanceChain) {
		// 1. Merge properties
		for (const [key, rawTuple] of Object.entries(properties)) {
			const normalized = normalizeProperty(rawTuple);
			if (normalized !== undefined) propertyDefs[key] = normalized;
		}

		// 2. Merge defaults (subclasses override superclasses, or keep original if applying root-first)
		for (const [propertyName, value] of Object.entries(classDefaults)) {
			if (!(propertyName in defaults)) {
				defaults[propertyName] = value;
			}
		}
	}

	return { defaults, propertyDefaults: propertyDefs };
}

type PropertyDefaults = Record<string, [string, string, string, ReadonlyArray<string>]>;

function resolveEnumValue(innerValue: unknown, dataType: string, enumLookup: EnumLookup): string | undefined {
	if (typeof innerValue !== "number") return undefined;

	const enumType = dataType.slice(5);
	const enumMap = enumLookup.get(enumType);
	if (enumMap === undefined) return undefined;

	const enumName = enumMap.get(innerValue);
	return enumName === undefined ? undefined : `Enum.${enumType}.${enumName}`;
}

function resolveDefaults(
	rawDefaults: Record<string, unknown>,
	propertyDefaults: PropertyDefaults,
	enumLookup: EnumLookup,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [propertyName, value] of Object.entries(rawDefaults)) {
		const innerValue = unwrapValue(value);
		const property = propertyDefaults[propertyName];
		if (property !== undefined) {
			const [dataType] = property;
			if (dataType.startsWith("Enum.")) {
				const resolved = resolveEnumValue(innerValue, dataType, enumLookup);
				if (resolved !== undefined) {
					result[propertyName] = resolved;
					continue;
				}
			}
		}
		result[propertyName] = innerValue;
	}
	return result;
}

function buildPropertyMap(propertyDefaults: PropertyDefaults): Record<string, DatabaseProperty> {
	const result: Record<string, DatabaseProperty> = {};
	for (const [key, [dataType, name, scriptability, tags]] of Object.entries(propertyDefaults)) {
		result[key] = isDatabaseProperty.assert({ dataType, name, scriptability, tags });
	}
	return result;
}

interface ExtractOptions {
	readonly filterClasses?: ReadonlyArray<string> | undefined;
	readonly quiet?: boolean | undefined;
}

function toLowerCase(value: string): string {
	return value.toLowerCase();
}

const SKIP_PROPERTIES = new Set(["Parent", "Sandboxed", "UniqueId"]);
const NUMBER_DATA_TYPES: ReadonlySet<string> = new Set([
	RobloxDataType.Float16,
	RobloxDataType.Float32,
	RobloxDataType.Float64,
	RobloxDataType.Int16,
	RobloxDataType.Int32,
	RobloxDataType.Int64,
	RobloxDataType.Int8,
]);
const COMMA_SEPARATED_TYPES: ReadonlySet<string> = new Set([
	RobloxDataType.CFrame,
	RobloxDataType.Color3,
	RobloxDataType.Rect,
	RobloxDataType.UDim,
	RobloxDataType.UDim2,
	RobloxDataType.Vector2,
	RobloxDataType.Vector3,
]);

function parseComponents(value: string): ReadonlyArray<number | string> {
	const components = new Array<number | string>();
	let size = 0;

	for (const component of value.replaceAll("[", "").replaceAll("]", "").split(", ")) {
		const trimmed = component.trim();
		const toNumber = Number(trimmed);
		if (!Number.isNaN(toNumber) && toNumber !== Number.POSITIVE_INFINITY && toNumber !== Number.NEGATIVE_INFINITY) {
			components[size++] = toNumber;
		} else components[size++] = trimmed;
	}

	return components;
}

function normalizeNumberValue(value: unknown): CanonicalValue | undefined {
	if (typeof value === "number") {
		if (value === Number.POSITIVE_INFINITY) return { type: "number", value: "inf" };
		if (value === Number.NEGATIVE_INFINITY) return { type: "number", value: "-inf" };
		return { type: "number", value };
	}

	const asString = String(value);
	if (asString === "inf" || asString === "-inf") return { type: "number", value: asString };

	const asNumber = Number(asString);
	if (!Number.isNaN(asNumber)) return { type: "number", value: asNumber };
	return undefined;
}

function isStringOrNumber(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

function normalizeComponent(component: string | number): number | string {
	if (typeof component === "number") {
		if (component === Number.POSITIVE_INFINITY) return "inf";
		if (component === Number.NEGATIVE_INFINITY) return "-inf";
		return component;
	}

	const asNumber = Number(component);
	return Number.isNaN(asNumber) ? component : asNumber;
}

interface CanonicalValue {
	readonly enumType?: string | undefined;
	readonly type: string;
	readonly value: unknown;
}

function makeCanonicalValue(dataType: string, value: unknown): CanonicalValue | undefined {
	if (NUMBER_DATA_TYPES.has(dataType)) return normalizeNumberValue(value);

	if (dataType === "Bool") return { type: "bool", value: Boolean(value) };
	if (dataType === "String") return { type: "string", value: String(value) };
	if (COMMA_SEPARATED_TYPES.has(dataType)) {
		if (Array.isArray(value)) {
			return {
				type: dataType,
				value: (value as ReadonlyArray<unknown>)
					.flat(Number.POSITIVE_INFINITY)
					.map((component) =>
						normalizeComponent(isStringOrNumber(component) ? component : String(component)),
					),
			};
		}
		return { type: dataType, value: parseComponents(String(value)) };
	}

	if (dataType.startsWith("Enum.")) {
		const asString = String(value);
		if (asString.startsWith("Enum.")) {
			return {
				enumType: dataType.slice(5),
				type: "Enum",
				value: asString.slice(dataType.length + 1),
			};
		}
		return {
			enumType: dataType.slice(5),
			type: "Enum",
			value: "",
		};
	}
	return undefined;
}

function shouldSkipProperty(propertyName: string, scriptability: DatabaseScriptability): boolean {
	return (
		SKIP_PROPERTIES.has(propertyName) ||
		(scriptability !== DatabaseScriptability.ReadWrite && scriptability !== DatabaseScriptability.Write)
	);
}

type ClassDefault = Record<string, CanonicalValue>;

function extractClassDefaults(
	className: string,
	{ defaultProperties, properties }: DatabaseClass,
	quiet?: boolean,
): ClassDefault | undefined {
	const classEntry: ClassDefault = {};
	let hasDefaults = false;

	for (const [propertyName, { dataType, scriptability }] of Object.entries(properties)) {
		if (shouldSkipProperty(propertyName, scriptability)) continue;

		const defaultValue = defaultProperties[propertyName];
		if (defaultValue === undefined) continue;

		const canonicalValue = makeCanonicalValue(dataType, defaultValue);
		if (canonicalValue !== undefined) {
			classEntry[propertyName] = canonicalValue;
			hasDefaults = true;
			continue;
		}

		if (quiet !== true) {
			console.warn(`Skipping ${className}.${propertyName} (${dataType}) — no canonical value mapping`);
		}
	}

	return hasDefaults ? classEntry : undefined;
}

export function extractDefaults(
	classes: ReadonlyMap<string, DatabaseClass>,
	{ filterClasses, quiet }: ExtractOptions = {},
): Record<string, ClassDefault> {
	const result: Record<string, ClassDefault> = {};
	const filterSet = filterClasses ? new Set(filterClasses.map(toLowerCase)) : undefined;

	for (const [className, databaseClass] of classes) {
		if (filterSet !== undefined && !filterSet.has(className.toLowerCase())) continue;
		const classEntry = extractClassDefaults(className, databaseClass, quiet);
		if (classEntry !== undefined) result[className] = classEntry;
	}

	return result;
}
