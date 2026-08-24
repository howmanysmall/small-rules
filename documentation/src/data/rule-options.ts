import { Predicate } from "effect";

import smallRules from "$small-rules";

import type { RuleName } from "./rule-manifest";

export type { RuleName } from "./rule-manifest";

type JsonValue = boolean | null | number | ReadonlyArray<JsonValue> | string | { readonly [key: string]: JsonValue };

type SchemaRecord = Readonly<Record<string, JsonValue>>;
type SchemaInput = JsonValue | undefined;
type ComplexJsonValue = Readonly<Record<string, JsonValue>> | ReadonlyArray<JsonValue>;

interface ComplexDefaultValueDocumentation {
	readonly copyValue: string;
	readonly displayValue: string;
	readonly kind: "complex";
	readonly summary: string;
}

interface InlineDefaultValueDocumentation {
	readonly displayValue: string;
	readonly kind: "inline";
}

export type DefaultValueDocumentation = ComplexDefaultValueDocumentation | InlineDefaultValueDocumentation;

export interface ObjectOption {
	readonly name: string;
	readonly defaultValue: DefaultValueDocumentation;
	readonly description: string | undefined;
	readonly required: boolean;
	readonly type: string;
}

export interface RuleOptionsDocumentation {
	readonly config: string;
	readonly options: ReadonlyArray<ObjectOption>;
	readonly schemaSummary: string;
}

function isJsonValue(value: unknown): value is JsonValue {
	if (value === null || Predicate.isBoolean(value) || Predicate.isNumber(value) || Predicate.isString(value)) {
		return true;
	}
	if (Array.isArray(value)) {
		for (const subValue of value) if (!isJsonValue(subValue)) return false;
		return true;
	}
	if (!Predicate.isReadonlyObject(value)) return false;

	for (const subValue of Object.values(value)) if (!isJsonValue(subValue)) return false;
	return true;
}

function isSchemaRecord(value: SchemaInput): value is SchemaRecord {
	return Predicate.isReadonlyObject(value);
}

function isJsonArray(value: SchemaInput): value is ReadonlyArray<JsonValue> {
	return Array.isArray(value);
}

function getRuleSchema(ruleName: RuleName): SchemaInput {
	const rule = smallRules.rules[ruleName];
	const { meta } = rule;
	if (meta === undefined) {
		const error = new Error(`Rule "${ruleName}" is missing metadata.`);
		Error.captureStackTrace(error, getRuleSchema);
		throw error;
	}

	return isJsonValue(meta.schema) ? meta.schema : undefined;
}

function formatJson(value: JsonValue): string {
	return JSON.stringify(value, undefined, "\t");
}

function formatInline(value: SchemaInput): string {
	if (value === undefined) return "-";
	if (Predicate.isString(value)) return value;
	return JSON.stringify(value);
}

function isComplexJsonValue(value: JsonValue): value is ComplexJsonValue {
	return Array.isArray(value) || Predicate.isReadonlyObject(value);
}

const camelCaseBoundary = /(?<lowercase>[a-z\d])(?<uppercase>[A-Z])/gu;

function summarizeComplexDefault(name: string, value: ComplexJsonValue): string {
	if (!Array.isArray(value)) return `${Object.keys(value).length} fields`;
	if (value.length === 1) return "1 item";

	const itemLabel = name.endsWith("s") ? name.replace(camelCaseBoundary, "$<lowercase> $<uppercase>") : "items";
	return `${value.length} ${itemLabel.toLowerCase()}`;
}

function formatDefaultValue(name: string, schema: SchemaRecord): DefaultValueDocumentation {
	if (isJsonValue(schema.default) && isComplexJsonValue(schema.default)) {
		return {
			copyValue: JSON.stringify(schema.default),
			displayValue: formatJson(schema.default),
			kind: "complex",
			summary: Predicate.isString(schema.defaultLabel)
				? schema.defaultLabel
				: summarizeComplexDefault(name, schema.default),
		};
	}

	return {
		displayValue: Predicate.isString(schema.defaultLabel) ? schema.defaultLabel : formatInline(schema.default),
		kind: "inline",
	};
}

function getSchemaTypeNames(schema: SchemaRecord): ReadonlyArray<string> {
	if (Predicate.isString(schema.type)) return [schema.type];
	if (isJsonArray(schema.type)) return schema.type.filter(Predicate.isString);
	if (schema.items !== undefined) return ["array"];
	if (schema.properties !== undefined || schema.additionalProperties !== undefined) return ["object"];
	return [];
}

function joinTypes(types: ReadonlyArray<string>): string {
	return [...new Set(types)].join(" | ");
}

const exactStringPlaceholders = new Map([
	["additionalAssertionFunctions", "expectPresent"],
	["additionalExpectCallNames", "expect"],
	["additionalHoistableComponents", "IconSprite"],
	["additionalStaticFactories", "Vector3"],
	["allow", "oxlint-disable"],
	["allowPropertyAccess", "Roact"],
	["alternatives", "begin"],
	["bannedInstances", "Part"],
	["bannedTypes", "Readonly"],
	["closer", "cleanup"],
	["constructors", "Instance"],
	["directive-no-restricted-disable", "no-console"],
	["eventsImportPaths", "server/networking"],
	["ignore", "oxlint-disable"],
	["ignoreComponents", "LegacyPanel"],
	["ignoreHooks", "useEntity"],
	["ignoreShorthands", "props"],
	["loopExitCalls", "task.wait"],
	["name", "useCustomEffect"],
	["onlyHooks", "useState"],
	["opener", "setup"],
	["openerAlternatives", "begin"],
	["staticGlobalFactories", "Vector3"],
	["yieldingFunctions", "task.wait"],
]);

const partialStringPlaceholders = [
	{ match: "class", value: "Part" },
	{ match: "factory", value: "useMemo" },
	{ match: "importpath", value: "@rbxts/react" },
	{ match: "rule", value: "no-console" },
];

const objectPlaceholders = new Map<string, JsonValue>([
	["allow", { name: "ValidationError" }],
	["bannedProperties", { UISizeConstraint: { MaxSize: "Use a different constraint shape." } }],
	["classes", { Log: "@rbxts/rbxts-sleitnick-log" }],
]);

function getRuleConfigOverride(ruleName: RuleName): JsonValue | undefined {
	switch (ruleName) {
		case "prevent-abbreviations": {
			return "error";
		}

		case "require-named-effect-functions": {
			return [
				"error",
				{
					environment: "roblox-ts",
					hooks: [
						{ name: "useEffect", allowAsync: false },
						{ name: "useLayoutEffect", allowAsync: false },
						{ name: "useInsertionEffect", allowAsync: false },
					],
				},
			];
		}

		case "require-paired-calls": {
			return [
				"error",
				{
					allowConditionalClosers: false,
					allowMultipleOpeners: true,
					maxNestingDepth: 0,
					pairs: [
						{
							alternatives: ["finish"],
							closer: "cleanup",
							opener: "setup",
							openerAlternatives: ["begin"],
							platform: "roblox",
							requireSync: false,
							yieldingFunctions: ["task.wait"],
						},
					],
				},
			];
		}

		case "require-react-component-keys": {
			return [
				"error",
				{
					allowRootKeys: false,
					ignoreCallExpressions: [
						"ReactTree.mount",
						"CreateReactStory",
						"createReactStory",
						"createPlatformStory",
					],
					iterationMethods: [
						"map",
						"filter",
						"forEach",
						"flatMap",
						"reduce",
						"reduceRight",
						"some",
						"every",
						"find",
						"findIndex",
					],
					memoizationHooks: ["useCallback", "useMemo"],
				},
			];
		}

		case "use-exhaustive-dependencies": {
			return [
				"error",
				{
					hooks: [
						{
							name: "useCustomEffect",
							closureIndex: 0,
							dependenciesIndex: 1,
							stableResult: false,
						},
					],
					reportMissingDependenciesArray: true,
					reportUnnecessaryDependencies: true,
					reportUnnecessaryStableDependencies: false,
					resolveExpressionDependencies: true,
				},
			];
		}

		default: {
			return undefined;
		}
	}
}

function getObjectSchemaType(schema: SchemaRecord): string {
	if (isSchemaRecord(schema.properties)) {
		const required = new Set(isJsonArray(schema.required) ? schema.required.filter(Predicate.isString) : []);
		const properties = Object.entries(schema.properties).map(([propertyName, propertySchema]) => {
			const optional = required.has(propertyName) ? "" : "?";
			const propertyType = isSchemaRecord(propertySchema) ? getSchemaType(propertySchema) : "unknown";
			return `${propertyName}${optional}: ${propertyType}`;
		});
		return `{ ${properties.join("; ")} }`;
	}

	if (isSchemaRecord(schema.additionalProperties)) {
		return `Record<string, ${getSchemaType(schema.additionalProperties)}>`;
	}

	return "Record<string, unknown>";
}

function getSchemaType(schema: SchemaRecord): string {
	if (schema.const !== undefined) return JSON.stringify(schema.const);
	if (isJsonArray(schema.enum)) return schema.enum.map((entry) => JSON.stringify(entry)).join(" | ");
	if (isJsonArray(schema.oneOf)) {
		return schema.oneOf.map((entry) => (isSchemaRecord(entry) ? getSchemaType(entry) : "unknown")).join(" | ");
	}
	if (isJsonArray(schema.anyOf)) {
		return schema.anyOf.map((entry) => (isSchemaRecord(entry) ? getSchemaType(entry) : "unknown")).join(" | ");
	}

	const typeNames = getSchemaTypeNames(schema);
	if (typeNames.includes("array")) {
		if (isJsonArray(schema.items)) {
			return `[${schema.items.map((item) => (isSchemaRecord(item) ? getSchemaType(item) : "unknown")).join(", ")}]`;
		}
		return `Array<${isSchemaRecord(schema.items) ? getSchemaType(schema.items) : "unknown"}>`;
	}
	if (typeNames.includes("object")) return getObjectSchemaType(schema);
	if (typeNames.length > 0) return joinTypes(typeNames);

	return "unknown";
}

function createStringPlaceholder(hint: string | undefined): string {
	const exactPlaceholder = hint === undefined ? undefined : exactStringPlaceholders.get(hint);
	if (exactPlaceholder !== undefined) return exactPlaceholder;

	const normalizedHint = hint?.toLowerCase();
	const partialPlaceholder = partialStringPlaceholders.find(({ match }) => normalizedHint?.includes(match) === true);
	return partialPlaceholder?.value ?? "value";
}

function getExplicitPlaceholder(schema: SchemaRecord, hint: string | undefined): JsonValue | undefined {
	if (isJsonValue(schema.default)) return schema.default;
	if (isJsonArray(schema.enum) && schema.enum.length > 0) {
		const [firstEnumValue] = schema.enum;
		if (isJsonValue(firstEnumValue)) return firstEnumValue;
	}
	if (isJsonArray(schema.anyOf)) {
		const matchingSchema = schema.anyOf.find(
			(entry) =>
				isSchemaRecord(entry) &&
				// oxlint-disable-next-line react-doctor/js-set-map-lookups -- schema type lists are tiny; allocating a Set per branch costs more.
				getSchemaTypeNames(entry).includes("object") &&
				hint !== undefined &&
				objectPlaceholders.has(hint),
		);
		return createPlaceholder(matchingSchema ?? schema.anyOf[0], hint);
	}
	if (isJsonArray(schema.oneOf)) {
		const [firstSchema] = schema.oneOf;
		return createPlaceholder(firstSchema, hint);
	}

	return undefined;
}

function createNumberPlaceholder(schema: SchemaRecord): number {
	if (Predicate.isNumber(schema.default)) return schema.default;
	if (Predicate.isNumber(schema.minimum)) return schema.minimum;
	return 0;
}

function createObjectPlaceholder(schema: SchemaRecord, hint: string | undefined): JsonValue {
	const knownPlaceholder = hint === undefined ? undefined : objectPlaceholders.get(hint);
	if (knownPlaceholder !== undefined) return knownPlaceholder;
	if (!isSchemaRecord(schema.properties)) return {};

	const placeholder: Record<string, JsonValue> = {};
	for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
		placeholder[propertyName] = createPlaceholder(propertySchema, propertyName);
	}
	return placeholder;
}

function createPlaceholder(schema: SchemaInput, hint?: string): JsonValue {
	if (!isSchemaRecord(schema)) return {};
	const explicitPlaceholder = getExplicitPlaceholder(schema, hint);
	if (explicitPlaceholder !== undefined) return explicitPlaceholder;

	const typeNames = getSchemaTypeNames(schema);
	if (typeNames.includes("array")) return schema.items === undefined ? [] : [createPlaceholder(schema.items, hint)];
	if (typeNames.includes("boolean")) return false;
	if (typeNames.includes("integer") || typeNames.includes("number")) return createNumberPlaceholder(schema);
	if (typeNames.includes("object")) return createObjectPlaceholder(schema, hint);
	if (typeNames.includes("string")) return createStringPlaceholder(hint);
	return {};
}

function createObjectOptions(schema: SchemaRecord): ReadonlyArray<ObjectOption> {
	if (!isSchemaRecord(schema.properties)) return [];

	const required = new Set(isJsonArray(schema.required) ? schema.required.filter(Predicate.isString) : []);

	return Object.entries(schema.properties).map(([name, optionSchema]) => {
		const option = isSchemaRecord(optionSchema) ? optionSchema : {};
		return {
			name,
			defaultValue: formatDefaultValue(name, option),
			description: Predicate.isString(option.description) ? option.description : undefined,
			required: required.has(name),
			type: getSchemaType(option),
		};
	});
}

function createOptionsValue(schema: SchemaInput): JsonValue | undefined {
	if (isJsonArray(schema)) {
		const [firstOptionSchema] = schema;
		if (firstOptionSchema === undefined) return undefined;
		return createPlaceholder(firstOptionSchema);
	}

	if (schema === undefined) return undefined;
	return createPlaceholder(schema);
}

function createConfiguration(ruleName: RuleName, schema: SchemaInput): string {
	const override = getRuleConfigOverride(ruleName);
	if (override !== undefined) {
		return formatJson({
			jsPlugins: ["@pobammer-ts/small-rules"],
			rules: { [`small-rules/${ruleName}`]: override },
		});
	}

	const optionsValue = createOptionsValue(schema);
	let ruleConfig: JsonValue = optionsValue === undefined ? "error" : ["error", optionsValue];

	if (isSchemaRecord(schema) && schema.type === "array") {
		ruleConfig = ["error", createPlaceholder(schema.items, ruleName)];
	}

	return formatJson({
		jsPlugins: ["@pobammer-ts/small-rules"],
		rules: { [`small-rules/${ruleName}`]: ruleConfig },
	});
}

function getSchemaSummary(schema: SchemaInput): string {
	if (schema === undefined) return "This rule does not accept options.";
	if (isJsonArray(schema)) {
		if (schema.length === 0) return "This rule does not accept options.";
		return "This rule accepts one options object after the severity.";
	}
	if (isSchemaRecord(schema) && schema.type === "array") {
		return "This rule accepts positional array options after the severity.";
	}
	return "This rule exposes a custom options schema.";
}

export function getRuleOptionsDocumentation(ruleName: RuleName): RuleOptionsDocumentation {
	const schema = getRuleSchema(ruleName);
	const optionSchema = isJsonArray(schema) ? schema[0] : schema;

	return {
		config: createConfiguration(ruleName, schema),
		options:
			isSchemaRecord(optionSchema) && optionSchema.type === "object" ? createObjectOptions(optionSchema) : [],
		schemaSummary: getSchemaSummary(schema),
	};
}
